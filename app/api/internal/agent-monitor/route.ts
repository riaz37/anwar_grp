import "server-only";
import type { AgentFlagType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeRiskSeverity } from "@/lib/risk-engine";
import { getOwnershipGaps } from "@/lib/raci-engine";
import { upsertFlag, autoResolveStaleFlags, type StillOpenSubject } from "@/lib/agent-flags";
import { generateFlagNarration } from "@/lib/llm-client";
import { sendFlagAlertEmail, type FlagAlertRecipient } from "@/lib/email";
import { ok, fail, handleRouteError } from "@/lib/api-response";

/**
 * A full sweep over the real portfolio (~140 active projects, measured
 * via test/eval) takes 100s+ even with the concurrency fix below, since
 * each project needs several sequential round trips to a cross-region
 * Postgres pooler and any newly-flagged project also triggers an LLM
 * narration call (up to 15s, see lib/llm-client.ts) and an email send.
 * Without this, the route falls back to Vercel's plan default function
 * duration (as low as 10-60s), which would kill the cron invocation
 * mid-sweep on every 15-minute tick. 300s is the Pro-plan ceiling as of
 * this writing — confirm against the actual deployment's plan/tier, and
 * raise `vercel.json`'s function config too if a higher tier allows more.
 */
export const maxDuration = 300;

/** Matches lib/project-health.ts's AT_RISK_WINDOW_DAYS — see RESOLVED item
 * "Stuck/risk threshold" in AGENTIC_DASHBOARD_PLAN.md: "stuck" reuses the
 * same 3-day unit management already reads on the dashboard. */
const STUCK_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;
/** High-severity risks get a shorter grace period — they're preventive,
 * a full 3-day window would defeat the point of a risk register. */
const HIGH_RISK_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface FlagCandidate {
  flagType: AgentFlagType;
  subjectId: string;
  narrationPrompt: string;
  fallbackNarration: string;
  severity: number;
  /** Who this specific flag should email, and why — resolved here since
   * this is the only place that knows who's actually accountable for the
   * flagged item, rather than the previous static "every Management +
   * Team Lead" blast on every flag. */
  recipients: FlagAlertRecipient[];
}

/** The subset of Project fields needed to target recipients and evaluate
 * candidates — selected once per project in runAgentMonitor(). */
interface MonitorProject {
  id: string;
  name: string;
  departmentId: string;
  businessUnitId: string;
  owner: { email: string; name: string };
}

/** The subset of User fields needed to pick a project's relevant Team
 * Lead or address Management — selected once per sweep in
 * runAgentMonitor() rather than per project. */
interface MonitorUser {
  email: string;
  name: string;
  departmentId: string | null;
  businessUnitId: string | null;
}

function daysOverdue(since: Date): number {
  return Math.floor((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
}

/** Picks the Team Lead most relevant to a project: same department first,
 * same business unit as a fallback, otherwise whoever's available — so a
 * project always reaches a real person instead of silently dropping the
 * "team lead" recipient when there's no exact department match. */
function pickRelevantTeamLead(
  project: Pick<MonitorProject, "departmentId" | "businessUnitId">,
  teamLeads: MonitorUser[],
): MonitorUser | null {
  return (
    teamLeads.find((u) => u.departmentId === project.departmentId) ??
    teamLeads.find((u) => u.businessUnitId === project.businessUnitId) ??
    teamLeads[0] ??
    null
  );
}

/** De-dupes recipients by email — a project owner who is also its own
 * Team Lead (small teams) should get one email, not two. */
function dedupeRecipients(recipients: FlagAlertRecipient[]): FlagAlertRecipient[] {
  const byEmail = new Map<string, FlagAlertRecipient>();
  for (const recipient of recipients) {
    if (!byEmail.has(recipient.email)) byEmail.set(recipient.email, recipient);
  }
  return Array.from(byEmail.values());
}

async function collectCandidates(
  project: MonitorProject,
  teamLeads: MonitorUser[],
  managers: MonitorUser[],
): Promise<FlagCandidate[]> {
  const projectId = project.id;
  const projectName = project.name;
  const now = Date.now();
  const candidates: FlagCandidate[] = [];
  const teamLead = pickRelevantTeamLead(project, teamLeads);

  const [stuckMilestones, stuckBlockers, openRisks, ownershipGaps] = await Promise.all([
    prisma.milestone.findMany({
      where: {
        projectId,
        status: { not: "DONE" },
        dueDate: { lt: new Date(now - STUCK_THRESHOLD_MS) },
      },
      include: { owner: { select: { name: true, email: true } } },
    }),
    prisma.blocker.findMany({
      where: {
        projectId,
        resolvedAt: null,
        dateIdentified: { lt: new Date(now - STUCK_THRESHOLD_MS) },
      },
      include: { responsiblePerson: { select: { name: true, email: true } } },
    }),
    prisma.risk.findMany({
      where: {
        projectId,
        status: "OPEN",
        identifiedAt: { lt: new Date(now - HIGH_RISK_THRESHOLD_MS) },
      },
      include: { owner: { select: { name: true, email: true } } },
    }),
    getOwnershipGaps(projectId),
  ]);

  for (const milestone of stuckMilestones) {
    const overdueDays = daysOverdue(milestone.dueDate);
    candidates.push({
      flagType: "STUCK_MILESTONE",
      subjectId: milestone.id,
      narrationPrompt: `Project "${projectName}" has milestone "${milestone.name}" (owned by ${milestone.owner.name}) that is ${overdueDays} days overdue. In 1-2 sentences, explain why this matters and recommend a next action.`,
      fallbackNarration: `"${milestone.name}" is ${overdueDays} days overdue, owned by ${milestone.owner.name}. No AI recommendation available — narration service unreachable.`,
      severity: 2,
      recipients: dedupeRecipients([
        {
          email: milestone.owner.email,
          name: milestone.owner.name,
          relation: `You own the milestone "${milestone.name}" on ${projectName}, which is now ${overdueDays} days overdue.`,
        },
        ...(teamLead
          ? [
              {
                email: teamLead.email,
                name: teamLead.name,
                relation: `A milestone on ${projectName}, in your team's portfolio, is ${overdueDays} days overdue: "${milestone.name}".`,
              },
            ]
          : []),
      ]),
    });
  }

  for (const blocker of stuckBlockers) {
    const openDays = daysOverdue(blocker.dateIdentified);
    candidates.push({
      flagType: "STUCK_BLOCKER",
      subjectId: blocker.id,
      narrationPrompt: `Project "${projectName}" has an unresolved blocker ("${blocker.description}", responsible: ${blocker.responsiblePerson.name}) open for ${openDays} days. In 1-2 sentences, explain why this matters and recommend a next action.`,
      fallbackNarration: `Blocker "${blocker.description}" has been open for ${openDays} days, responsible: ${blocker.responsiblePerson.name}. No AI recommendation available — narration service unreachable.`,
      severity: 2,
      recipients: dedupeRecipients([
        {
          email: blocker.responsiblePerson.email,
          name: blocker.responsiblePerson.name,
          relation: `You're responsible for the blocker "${blocker.description}" on ${projectName}, open for ${openDays} days.`,
        },
        ...(teamLead
          ? [
              {
                email: teamLead.email,
                name: teamLead.name,
                relation: `A blocker on ${projectName}, in your team's portfolio, has been open for ${openDays} days: "${blocker.description}".`,
              },
            ]
          : []),
      ]),
    });
  }

  for (const risk of openRisks) {
    const severity = computeRiskSeverity(risk.likelihood, risk.impact);
    if (severity < 3) continue;
    candidates.push({
      flagType: "HIGH_RISK",
      subjectId: risk.id,
      narrationPrompt: `Project "${projectName}" has an open high-severity risk: "${risk.title}" (likelihood: ${risk.likelihood}, impact: ${risk.impact}, owner: ${risk.owner.name}). In 1-2 sentences, explain why this matters and recommend a mitigation next step.`,
      fallbackNarration: `"${risk.title}" is an open ${risk.likelihood}/${risk.impact} risk, owned by ${risk.owner.name}. No AI recommendation available — narration service unreachable.`,
      severity,
      recipients: dedupeRecipients([
        {
          email: risk.owner.email,
          name: risk.owner.name,
          relation: `You own the risk "${risk.title}" on ${projectName}, which has escalated to high severity (likelihood: ${risk.likelihood}, impact: ${risk.impact}).`,
        },
        ...(teamLead
          ? [
              {
                email: teamLead.email,
                name: teamLead.name,
                relation: `A high-severity risk is open on ${projectName}, in your team's portfolio: "${risk.title}".`,
              },
            ]
          : []),
        ...managers.map((manager) => ({
          email: manager.email,
          name: manager.name,
          relation: `A high-severity risk on ${projectName} needs executive visibility: "${risk.title}" (likelihood: ${risk.likelihood}, impact: ${risk.impact}).`,
        })),
      ]),
    });
  }

  for (const gap of ownershipGaps) {
    candidates.push({
      flagType: "OWNERSHIP_GAP",
      subjectId: gap.subjectId,
      narrationPrompt: `Project "${projectName}" has an ownership gap: ${gap.reason} In 1-2 sentences, explain why this matters and recommend a next action.`,
      fallbackNarration: `${gap.reason} No AI recommendation available — narration service unreachable.`,
      severity: 1,
      recipients: dedupeRecipients([
        {
          email: project.owner.email,
          name: project.owner.name,
          relation: `As the owner of ${projectName}: ${gap.reason}`,
        },
        ...(teamLead
          ? [
              {
                email: teamLead.email,
                name: teamLead.name,
                relation: `As the team lead over ${projectName}: ${gap.reason}`,
              },
            ]
          : []),
      ]),
    });
  }

  return candidates;
}

export interface AgentMonitorSummary {
  projectsEvaluated: number;
  flagsCreated: number;
  flagsUpdated: number;
  flagsResolved: number;
}

/**
 * Runs `task` over `items` with at most `concurrency` in flight at once.
 * Needed because the monitor evaluates every active project (100+ in this
 * portfolio, confirmed via test/eval) and each project's evaluation is a
 * handful of sequential network round trips to a cross-region Postgres
 * pooler — fully sequential across projects (the original implementation)
 * measured at 130s+ per run in test/eval, which exceeds most serverless
 * function time limits and would leave a production cron run silently
 * incomplete for most of the portfolio on every 15-minute tick.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

interface ProjectEvalResult {
  created: number;
  updated: number;
  resolved: number;
}

async function evaluateProject(
  project: MonitorProject,
  teamLeads: MonitorUser[],
  managers: MonitorUser[],
): Promise<ProjectEvalResult> {
  const candidates = await collectCandidates(project, teamLeads, managers);

  let created = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const existing = await prisma.agentFlag.findUnique({
      where: {
        projectId_flagType_subjectId: {
          projectId: project.id,
          flagType: candidate.flagType,
          subjectId: candidate.subjectId,
        },
      },
      select: { narration: true, narrationSource: true, resolvedAt: true },
    });

    const isNewOccurrence = !existing || existing.resolvedAt !== null;

    let narration = existing?.narration ?? candidate.fallbackNarration;
    let narrationSource: "LLM" | "RULE_FALLBACK" = existing?.narrationSource ?? "RULE_FALLBACK";

    if (isNewOccurrence) {
      const result = await generateFlagNarration(candidate.narrationPrompt);
      if (result.source === "LLM" && result.text.trim().length > 0) {
        narration = result.text.trim();
        narrationSource = "LLM";
      } else {
        narration = candidate.fallbackNarration;
        narrationSource = "RULE_FALLBACK";
      }
    }

    await upsertFlag({
      projectId: project.id,
      flagType: candidate.flagType,
      subjectId: candidate.subjectId,
      narration,
      narrationSource,
      severity: candidate.severity,
    });

    if (isNewOccurrence) {
      created += 1;
      await sendFlagAlertEmail({
        projectId: project.id,
        projectName: project.name,
        flagType: candidate.flagType,
        severity: candidate.severity,
        narration,
        recipients: candidate.recipients,
      });
    } else {
      updated += 1;
    }
  }

  const stillOpenSubjectIds: StillOpenSubject[] = candidates.map((candidate) => ({
    flagType: candidate.flagType,
    subjectId: candidate.subjectId,
  }));
  const resolved = await autoResolveStaleFlags(project.id, stillOpenSubjectIds);

  return { created, updated, resolved };
}

/** Bounds how many projects are evaluated concurrently — high enough to
 * turn a 100+ project sequential sweep into a bounded-time run, low
 * enough not to exhaust the pooled Postgres connection limit or hammer
 * the single self-hosted LLM instance with simultaneous narration calls.
 * Each project's collectCandidates() issues 4 queries in parallel, so
 * concurrency here is effectively multiplied by 4 for connection
 * purposes. Confirmed via test/eval: this Prisma client's connection
 * pool caps at 21 (Supabase pooler); a concurrency of 10 (40 needed)
 * reliably hit "Timed out fetching a new connection from the connection
 * pool" (P2024) mid-run. 4 (16 needed) leaves headroom for the app's own
 * concurrent request traffic sharing the same pool. */
const PROJECT_CONCURRENCY = 4;

/**
 * The actual monitoring-loop evaluation, kept separate from the route
 * handler below so Group I's tests can call it directly without going
 * over HTTP or needing the shared-secret header.
 */
export async function runAgentMonitor(): Promise<AgentMonitorSummary> {
  const [projects, teamLeads, managers] = await Promise.all([
    prisma.project.findMany({
      where: { currentStage: { not: "COMPLETED" } },
      select: {
        id: true,
        name: true,
        departmentId: true,
        businessUnitId: true,
        owner: { select: { email: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: "AI_TEAM_LEAD" },
      select: { email: true, name: true, departmentId: true, businessUnitId: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: "MANAGEMENT" },
      select: { email: true, name: true, departmentId: true, businessUnitId: true },
    }),
  ]);

  const results = await mapWithConcurrency(projects, PROJECT_CONCURRENCY, async (project) => {
    try {
      return await evaluateProject(project, teamLeads, managers);
    } catch (err) {
      // One project failing (e.g. deleted between the findMany above and
      // this call — a real TOCTOU window now that projects are evaluated
      // concurrently over a longer wall-clock run) must not abort the
      // whole sweep and leave every other project unevaluated for this
      // tick. Confirmed via test/eval: before this try/catch, a single
      // ProjectNotFoundError thrown by one worker rejected the entire
      // mapWithConcurrency batch.
      console.error(`agent-monitor: failed to evaluate project ${project.id}`, err);
      return { created: 0, updated: 0, resolved: 0 };
    }
  });

  return {
    projectsEvaluated: projects.length,
    flagsCreated: results.reduce((sum, r) => sum + r.created, 0),
    flagsUpdated: results.reduce((sum, r) => sum + r.updated, 0),
    flagsResolved: results.reduce((sum, r) => sum + r.resolved, 0),
  };
}

/**
 * Vercel Cron Jobs trigger this route with a GET request (see vercel.json's
 * `crons` entry); POST is also exposed for manual/local triggering with the
 * same shared-secret header.
 */
async function handleMonitorRequest(req: Request): Promise<Response> {
  try {
    const providedSecret = req.headers.get("x-agent-monitor-secret");
    const expectedSecret = process.env.AGENT_MONITOR_SECRET;
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return fail("UNAUTHENTICATED", "Invalid or missing agent monitor secret.", 401);
    }

    const summary = await runAgentMonitor();
    return ok(summary);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(req: Request) {
  return handleMonitorRequest(req);
}

export async function POST(req: Request) {
  return handleMonitorRequest(req);
}
