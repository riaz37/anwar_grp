import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectHealth, ProjectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { ButtonLink } from "@/components/ui/Button";
import {
  OwnershipQueue,
  type OwnershipGapCategory,
  type OwnershipGapRow,
} from "@/components/dashboard/portfolio/OwnershipQueue";
import {
  ScheduleBoard,
  type ScheduleRow,
} from "@/components/dashboard/portfolio/ScheduleBoard";
import { AgentMonitorTriggerButton } from "@/components/dashboard/portfolio/AgentMonitorTriggerButton";

export const metadata: Metadata = { title: "Management Dashboard" };
export const dynamic = "force-dynamic";

/** Open agent flags shown in the ownership queue before it scrolls. */
const AGENT_FLAG_LIMIT = 25;

const HEALTH_URGENCY: Record<ProjectHealth, number> = {
  BLOCKED: 3,
  DELAYED: 2,
  AT_RISK: 1,
  ON_TRACK: 0,
};

/**
 * The monitor raises an OWNERSHIP_GAP flag for exactly two situations
 * (`lib/raci-engine.ts`'s `getOwnershipGaps`): no Responsible/Accountable
 * owner, or an approved project nobody is Consulted/Informed on. The flag row
 * carries no discriminator — its `narration` is free text — so the category is
 * recovered from the fixed phrasing each branch produces. It decides which
 * inline fix the row offers, never what the row says.
 */
function categorize(reason: string): OwnershipGapCategory {
  return /consulted or informed/i.test(reason) ? "visibility" : "owner";
}

/** The cron's stock fallback sentence when the LLM narrator was unreachable —
 *  an internal detail, not worth repeating on every row. */
const FALLBACK_NARRATION_SUFFIX = / No AI recommendation available.*$/i;

function displayReason(reason: string): string {
  return reason.replace(FALLBACK_NARRATION_SUFFIX, "").trim();
}

/**
 * Management Dashboard — a decision board, not a report.
 *
 * Management has no time to visualise a portfolio, so the page carries the
 * two questions that actually need an answer today and nothing else: which
 * off-track projects are running out of runway (Schedule), and which projects
 * nobody owns or watches (Ownership). Both are real monitor/Prisma data; the
 * ownership rows are fixable in place, so the page is somewhere work is done
 * rather than a launchpad into five other screens.
 */
export default async function ManagementDashboardPage() {
  const session = await getSession();
  if (!session || !hasProjectPermission(session.role, "VIEW_MANAGEMENT_DASHBOARD")) {
    redirect("/home");
  }

  const now = new Date();

  const [openAgentFlags, ganttProjects] = await Promise.all([
    // The monitoring loop's own findings are the single source of truth for
    // ownership gaps (AGENTIC_DASHBOARD_PLAN.md) — never recomputed here.
    prisma.agentFlag.findMany({
      where: { resolvedAt: null, flagType: "OWNERSHIP_GAP" },
      orderBy: { severity: "desc" },
      take: AGENT_FLAG_LIMIT,
      include: {
        project: {
          // `version` feeds the optimistic-lock token the inline owner
          // assignment has to send with its PATCH.
          select: { id: true, name: true, version: true },
        },
      },
    }),
    prisma.project.findMany({
      where: {
        currentStage: { not: ProjectStage.COMPLETED },
        health: { not: ProjectHealth.ON_TRACK },
      },
      select: {
        id: true,
        name: true,
        health: true,
        createdAt: true,
        expectedDeliveryDate: true,
        milestones: {
          where: { status: { not: "DONE" } },
          orderBy: { dueDate: "asc" },
          select: { name: true, dueDate: true },
        },
      },
      orderBy: { expectedDeliveryDate: "asc" },
    }),
  ]);

  const gapRows: OwnershipGapRow[] = openAgentFlags.map((flag) => ({
    flagId: flag.id,
    projectId: flag.project.id,
    projectName: flag.project.name,
    projectVersion: flag.project.version,
    category: categorize(flag.narration),
    reason: displayReason(flag.narration),
  }));

  const scheduleRows: ScheduleRow[] = ganttProjects
    .map((p) => {
      const overdue = p.milestones
        .filter((m) => m.dueDate.getTime() < now.getTime())
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
      const upcoming = p.milestones
        .filter((m) => m.dueDate.getTime() >= now.getTime())
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
      const critical = overdue ?? upcoming ?? null;
      return {
        projectId: p.id,
        name: p.name,
        health: p.health,
        startDate: p.createdAt.toISOString(),
        expectedDeliveryDate: p.expectedDeliveryDate.toISOString(),
        criticalMilestoneName: critical?.name ?? null,
        criticalMilestoneDate: critical?.dueDate.toISOString() ?? null,
        criticalMilestoneOverdue: Boolean(overdue),
      };
    })
    // Most urgent first (blocked > delayed > at-risk), soonest delivery date
    // as the tiebreaker — the row order is the reading order.
    .sort((a, b) => {
      const urgencyDiff = HEALTH_URGENCY[b.health] - HEALTH_URGENCY[a.health];
      if (urgencyDiff !== 0) return urgencyDiff;
      return (
        new Date(a.expectedDeliveryDate).getTime() -
        new Date(b.expectedDeliveryDate).getTime()
      );
    });

  const asOf = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return (
    <div className="flex flex-col gap-ds-9xl">
      {/* The top bar already names the page, so the title here states the
          question rather than repeating the breadcrumb. No standfirst
          paragraph: the two section labels below carry the structure. */}
      <header className="flex flex-wrap items-end justify-between gap-x-ds-5xl gap-y-ds-lg border-b border-outline-med pb-ds-4xl">
        <h1 className="text-balance text-display-1 font-semibold text-text-high">
          Needs a decision today
        </h1>
        <div className="flex items-center gap-ds-5xl">
          <p className="font-data text-caption-2 tabular-nums text-text-low">
            As of {asOf}
          </p>
          <AgentMonitorTriggerButton />
          <ButtonLink href="/projects" variant="secondary">
            Full portfolio
          </ButtonLink>
        </div>
      </header>

      {/* Stacked, not side-by-side: Schedule and Ownership carry unrelated
          row counts (a handful of off-track projects vs. up to two dozen open
          gaps), so a fixed-width column split leaves one side half-empty and
          the other overflowing regardless of how either is styled. Full width
          top-to-bottom lets each section be exactly as tall as its own
          content and nothing else. */}
      <ScheduleBoard nowIso={now.toISOString()} rows={scheduleRows} />
      <OwnershipQueue
        className="border-t border-outline-low pt-ds-9xl"
        currentUserRole={session.role}
        rows={gapRows}
      />
    </div>
  );
}
