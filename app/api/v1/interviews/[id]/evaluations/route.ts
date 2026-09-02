import { NextRequest } from "next/server";
import { z } from "zod";
import { Role, OverallRecommendation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { isPanelistOnInterview } from "@/lib/phase3-scoping";
import { sanitizeScores, parseCriteria } from "@/lib/evaluation-forms";
import { visibleEvaluationsWhere } from "@/lib/evaluation-visibility";

/**
 * GET /api/v1/interviews/:id/evaluations — list evaluations for one
 * interview, filtered through lib/evaluation-visibility.ts's
 * visibleEvaluationsWhere() (blind-until-submit rule — see that file's
 * doc comment for the full role decision). NEVER swap this for a raw
 * `findMany({ where: { interviewId } })`.
 *
 * Access to the interview itself first: same check as
 * interviews/:id/panel — org/department scope via applicationScopeWhere,
 * OR (for PANEL_MEMBER specifically) being an assigned panelist.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const interview = await prisma.interview.findUnique({
      where: { id },
      select: { id: true, applicationId: true },
    });
    if (!interview) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    const inScope = await prisma.application.findFirst({
      where: { id: interview.applicationId, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!inScope) {
      const isPanelist =
        user.role === Role.PANEL_MEMBER && (await isPanelistOnInterview(user, id));
      if (!isPanelist) {
        return fail("NOT_FOUND", "Interview not found.", 404);
      }
    }

    const where = await visibleEvaluationsWhere(user, id);
    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        panelist: { select: { id: true, name: true, role: true } },
        evaluationFormTemplate: { select: { id: true, name: true, roleType: true, criteria: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(evaluations);
  } catch (err) {
    return handleRouteError(err);
  }
}

const upsertEvaluationSchema = z.object({
  // Required on the first (create) call for a panelist's row; optional
  // on later draft-update calls, where the existing row's template
  // carries over unless the caller explicitly changes it.
  evaluationFormTemplateId: z.string().min(1).optional(),
  // Deliberately .optional() with NO default — a bare
  // { submitted: true } call (locking in a draft without resending
  // every field) must not silently wipe previously-saved scores to {}.
  // "scores omitted" (undefined) means "leave scores as they are";
  // "scores: {}" explicitly sent means "clear all scores" — those are
  // different requests and must not collapse into the same one.
  scores: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  strengths: z.string().trim().max(4000).optional(),
  concerns: z.string().trim().max(4000).optional(),
  organizationalSuitability: z.string().trim().max(4000).optional(),
  overallRecommendation: z.nativeEnum(OverallRecommendation).optional(),
  // Setting `submitted: true` is how a draft is locked in — see doc
  // comment below. Defaults to false, i.e. this call just saves/updates
  // a draft.
  submitted: z.boolean().default(false),
});

/**
 * POST /api/v1/interviews/:id/evaluations — create/update the CALLING
 * panelist's OWN evaluation row for this interview (upsert on the
 * interviewId_panelistId unique constraint — there is no way to submit
 * a row on someone else's behalf through this endpoint; `panelistId` is
 * always the session user, never a request body field).
 *
 * Submit semantics (documented choice — a `submitted: true` flag on
 * this same endpoint rather than a separate POST .../submit): keeps the
 * "save draft" and "submit" actions on one route since they share every
 * other field, and avoids a second route whose only job is "read the
 * row, check ownership, set one field" — this route already does all of
 * that. Once `submittedAt` is set (whether via this call or a previous
 * one) the row is immutable, full stop: this handler rejects with 409
 * before touching the row at all, even to just re-save the same draft
 * text.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: interviewId } = await params;
    const body = upsertEvaluationSchema.parse(await req.json());

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { id: true },
    });
    if (!interview) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    const isPanelist = await isPanelistOnInterview(user, interviewId);
    if (!isPanelist) {
      return fail(
        "FORBIDDEN",
        "Only an assigned panelist on this interview may submit an evaluation for it.",
        403,
      );
    }

    const existing = await prisma.evaluation.findUnique({
      where: {
        interviewId_panelistId: { interviewId, panelistId: user.userId },
      },
    });
    if (existing?.submittedAt) {
      return fail(
        "EVALUATION_LOCKED",
        "This evaluation has already been submitted and can no longer be edited.",
        409,
      );
    }

    const templateId = body.evaluationFormTemplateId ?? existing?.evaluationFormTemplateId;
    if (!templateId) {
      return fail(
        "VALIDATION_ERROR",
        "evaluationFormTemplateId is required to start an evaluation.",
        400,
      );
    }
    const template = await prisma.evaluationFormTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return fail("NOT_FOUND", "Evaluation form template not found.", 404);
    }

    const criteria = parseCriteria(template.criteria);
    // body.scores undefined -> caller isn't touching scores this call
    // (e.g. a bare { submitted: true } to lock in an already-saved
    // draft) -> keep whatever is already on the row (or {} on first
    // create). body.scores === {} (explicitly sent) IS sanitized and
    // DOES clear the row, since that's a deliberate "no criteria
    // scored" submission, not an omission.
    let sanitized: Record<string, number>;
    let droppedKeys: string[] = [];
    if (body.scores !== undefined) {
      ({ sanitized, droppedKeys } = sanitizeScores(criteria, body.scores));
    } else {
      sanitized = (existing?.scores as Record<string, number> | undefined) ?? {};
    }

    const now = new Date();
    const evaluation = await prisma.evaluation.upsert({
      where: {
        interviewId_panelistId: { interviewId, panelistId: user.userId },
      },
      create: {
        interviewId,
        panelistId: user.userId,
        evaluationFormTemplateId: templateId,
        scores: sanitized,
        strengths: body.strengths,
        concerns: body.concerns,
        organizationalSuitability: body.organizationalSuitability,
        overallRecommendation: body.overallRecommendation,
        submittedAt: body.submitted ? now : null,
      },
      update: {
        evaluationFormTemplateId: templateId,
        scores: sanitized,
        strengths: body.strengths,
        concerns: body.concerns,
        organizationalSuitability: body.organizationalSuitability,
        overallRecommendation: body.overallRecommendation,
        submittedAt: body.submitted ? now : null,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: body.submitted ? "EVALUATION_SUBMIT" : "EVALUATION_SAVE_DRAFT",
      entityType: "Evaluation",
      entityId: evaluation.id,
      metadata: { interviewId, droppedScoreKeys: droppedKeys },
    });

    return ok(evaluation, { meta: { droppedScoreKeys: droppedKeys } });
  } catch (err) {
    return handleRouteError(err);
  }
}
