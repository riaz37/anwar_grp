import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isProjectParticipant } from "@/lib/project-authz";
import { PORTFOLIO_WIDE_ROLES } from "@/lib/project-permissions";
import { computeChecklistReadiness } from "@/lib/checklist-engine";
import { isMilestoneAtRisk, isMilestoneOverdue } from "@/lib/project-health";
import { ProjectDetailView } from "@/components/projects/detail/ProjectDetailView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session) return { title: "Project" };

  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, ownerId: true, analystId: true, developerId: true, departmentId: true },
  });
  if (!project) return { title: "Project" };

  // Same participant scoping as the page body — the title must not leak
  // a project's name to a signed-in user who isn't on it.
  if (!PORTFOLIO_WIDE_ROLES.has(session.role) && !isProjectParticipant(session, project)) {
    return { title: "Project" };
  }

  return { title: project.name };
}

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  // A signed-out visitor belongs at the sign-in screen, not on a 404 — the
  // page exists, they just can't see it yet. (The `(dashboard)` layout already
  // redirects; this keeps the page correct if it is ever rendered elsewhere.)
  if (!session) redirect("/login");

  // Participant-scoped: mirrors GET /api/v1/projects/[id]. Renders 404
  // rather than 403 so a non-participant can't distinguish "doesn't
  // exist" from "exists but you can't see it."
  if (!PORTFOLIO_WIDE_ROLES.has(session.role)) {
    const participantCheck = await prisma.project.findUnique({
      where: { id },
      select: { ownerId: true, analystId: true, developerId: true, departmentId: true },
    });
    if (!participantCheck || !isProjectParticipant(session, participantCheck)) {
      notFound();
    }
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      analyst: { select: { id: true, name: true, role: true } },
      developer: { select: { id: true, name: true, role: true } },
      businessUnit: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      milestones: { orderBy: { dueDate: "asc" }, include: { owner: { select: { id: true, name: true } } } },
      tasks: { orderBy: { deadline: "asc" }, include: { owner: { select: { id: true, name: true } } } },
      blockers: {
        orderBy: { createdAt: "desc" },
        include: {
          raisedBy: { select: { id: true, name: true } },
          resolvedBy: { select: { id: true, name: true } },
          responsiblePerson: { select: { id: true, name: true } },
        },
      },
      scopeChanges: {
        orderBy: { createdAt: "desc" },
        include: { requestedBy: { select: { id: true, name: true } } },
      },
      gateChecklistItems: true,
      delayReasons: {
        orderBy: { createdAt: "desc" },
        include: { recordedBy: { select: { id: true, name: true } } },
      },
      stageHistory: {
        orderBy: { changedAt: "desc" },
        include: { actor: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  if (!project) notFound();

  const currentStageItems = project.gateChecklistItems.filter(
    (item) => item.stage === project.currentStage,
  );
  const readiness = await computeChecklistReadiness(project.id, project.currentStage);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const documentRows = await prisma.document.findMany({
    where: { ownerType: "PROJECT", ownerId: project.id },
    orderBy: { createdAt: "desc" },
  });
  const uploaderIds = [...new Set(documentRows.map((d) => d.uploadedById))];
  const uploaders = uploaderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true },
      })
    : [];
  const uploaderNameById = new Map(uploaders.map((u) => [u.id, u.name]));

  // "Latest update": the most recent of the last stage transition, the last
  // blocker event, or the last milestone completion — whichever is newest.
  const candidateEvents: { label: string; at: Date }[] = [];
  if (project.stageHistory[0]) {
    candidateEvents.push({
      label: `Stage advanced to ${project.stageHistory[0].toStage}`,
      at: project.stageHistory[0].changedAt,
    });
  }
  for (const b of project.blockers) {
    candidateEvents.push({
      label: b.resolvedAt ? "Blocker resolved" : "Blocker raised",
      at: b.resolvedAt ?? b.createdAt,
    });
  }
  for (const m of project.milestones) {
    if (m.completedAt) {
      candidateEvents.push({ label: `Milestone "${m.name}" completed`, at: m.completedAt });
    }
  }
  candidateEvents.sort((a, b) => b.at.getTime() - a.at.getTime());
  const latestUpdate = candidateEvents[0] ?? null;

  return (
    <ProjectDetailView
      currentUserRole={session.role}
      project={{
        id: project.id,
        name: project.name,
        businessProblem: project.businessProblem,
        expectedOutcome: project.expectedOutcome,
        currentStage: project.currentStage,
        health: project.health,
        expectedDeliveryDate: project.expectedDeliveryDate.toISOString(),
        version: project.version,
        owner: project.owner,
        analyst: project.analyst,
        developer: project.developer,
        businessUnit: project.businessUnit,
        department: project.department,
      }}
      readiness={readiness}
      latestUpdate={
        latestUpdate ? { label: latestUpdate.label, at: latestUpdate.at.toISOString() } : null
      }
      checklistItems={currentStageItems.map((item) => ({
        id: item.id,
        label: item.label,
        required: item.required,
        checked: item.checked,
      }))}
      stageHistory={project.stageHistory.map((h) => ({
        id: h.id,
        fromStage: h.fromStage,
        toStage: h.toStage,
        actorName: h.actor.name,
        changedAt: h.changedAt.toISOString(),
        notes: h.notes,
      }))}
      milestones={project.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        ownerId: m.owner.id,
        ownerName: m.owner.name,
        dueDate: m.dueDate.toISOString(),
        status: m.status,
        overdue: isMilestoneOverdue(m),
        atRisk: isMilestoneAtRisk(m),
      }))}
      tasks={project.tasks.map((t) => ({
        id: t.id,
        action: t.action,
        ownerId: t.owner.id,
        ownerName: t.owner.name,
        deadline: t.deadline ? t.deadline.toISOString() : null,
        status: t.status,
        relatedMilestoneId: t.relatedMilestoneId,
      }))}
      blockers={project.blockers.map((b) => ({
        id: b.id,
        description: b.description,
        impact: b.impact,
        requiredAction: b.requiredAction,
        responsiblePersonId: b.responsiblePerson.id,
        responsiblePersonName: b.responsiblePerson.name,
        dateIdentified: b.dateIdentified.toISOString(),
        raisedByName: b.raisedBy.name,
        createdAt: b.createdAt.toISOString(),
        resolvedAt: b.resolvedAt ? b.resolvedAt.toISOString() : null,
        resolvedByName: b.resolvedBy?.name ?? null,
        resolutionNotes: b.resolutionNotes,
      }))}
      scopeChanges={project.scopeChanges.map((s) => ({
        id: s.id,
        reason: s.reason,
        deliveryImpact: s.deliveryImpact,
        requestedByName: s.requestedBy.name,
        previousExpectedDeliveryDate: s.previousExpectedDeliveryDate
          ? s.previousExpectedDeliveryDate.toISOString()
          : null,
        newExpectedDeliveryDate: s.newExpectedDeliveryDate
          ? s.newExpectedDeliveryDate.toISOString()
          : null,
        createdAt: s.createdAt.toISOString(),
      }))}
      delayReasons={project.delayReasons.map((d) => ({
        id: d.id,
        category: d.category,
        note: d.note,
        milestoneId: d.milestoneId,
        recordedByName: d.recordedBy.name,
        createdAt: d.createdAt.toISOString(),
      }))}
      documents={documentRows.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.createdAt.toISOString(),
        uploadedBy: uploaderNameById.get(d.uploadedById) ?? "Unknown",
      }))}
      users={users}
    />
  );
}
