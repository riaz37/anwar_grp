import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { ProjectHealth, ProjectStage } from "@prisma/client";
import {
  ListChecks,
  Flag,
  TriangleAlert,
  FolderKanban,
  CalendarClock,
  Inbox,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { isMilestoneOverdue } from "@/lib/project-health";
import { formatDate, todayIsoDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/StatusPill";
import { alias } from "@/components/shell/icons";
import {
  HomeCard,
  HomeCardFooter,
  HomeCardHeader,
  HomeEmptyState,
} from "@/components/dashboard/home/HomeCard";
import { StatStrip, type Stat } from "@/components/dashboard/home/StatStrip";
import {
  UpcomingList,
  type UpcomingItem,
} from "@/components/dashboard/home/UpcomingList";
import { ProjectList } from "@/components/dashboard/home/ProjectList";

/** How many dated items are pulled before the five-row cut. */
const UPCOMING_FETCH_LIMIT = 40;
const UPCOMING_SHOWN = 5;

/* Stat/panel glyphs go through the shell's alias factory so they inherit the
   1.5px optical weight the rest of the app's icons use (see shell/icons.tsx). */
const TaskStatIcon = alias(ListChecks, { size: 14 });
const MilestoneStatIcon = alias(Flag, { size: 14 });
const OverdueStatIcon = alias(TriangleAlert, { size: 14 });
const ProjectStatIcon = alias(FolderKanban, { size: 14 });
const ScheduleIcon = alias(CalendarClock, { size: 16 });
const AttentionIcon = alias(TriangleAlert, { size: 16 });
const PortfolioIcon = alias(FolderKanban, { size: 16 });
const EmptyIcon = alias(Inbox, { size: 16 });

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

/** Entrance stagger, capped well inside DESIGN.md §8's 500ms band. */
function step(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const canSeeManagement = hasProjectPermission(
    session.role,
    "VIEW_MANAGEMENT_DASHBOARD",
  );

  /** Owner / analyst / developer on a project that hasn't completed. */
  const myProjectWhere = {
    currentStage: { not: ProjectStage.COMPLETED },
    OR: [
      { ownerId: session.userId },
      { analystId: session.userId },
      { developerId: session.userId },
    ],
  };

  const [
    openTaskCount,
    openMilestoneCount,
    overdueCount,
    myProjectCount,
    myProjects,
    upcomingTasks,
    upcomingMilestones,
  ] = await Promise.all([
    prisma.projectTask.count({
      where: { ownerId: session.userId, status: { not: "DONE" } },
    }),
    prisma.milestone.count({
      where: { ownerId: session.userId, status: { not: "DONE" } },
    }),
    // Same rule as `isMilestoneOverdue`/the task deadline check, expressed as a
    // count so the header figure covers everything assigned — not just the
    // five rows the "Coming up" list has room for.
    Promise.all([
      prisma.projectTask.count({
        where: {
          ownerId: session.userId,
          status: { not: "DONE" },
          deadline: { lt: now },
        },
      }),
      prisma.milestone.count({
        where: {
          ownerId: session.userId,
          status: { not: "DONE" },
          dueDate: { lt: now },
        },
      }),
    ]).then(([tasks, milestones]) => tasks + milestones),
    // The list below is capped at five rows, so the stat reads its own count
    // rather than `myProjects.length` — a figure that silently stopped at 5.
    prisma.project.count({ where: myProjectWhere }),
    prisma.project.findMany({
      where: myProjectWhere,
      select: {
        id: true,
        name: true,
        health: true,
        currentStage: true,
        expectedDeliveryDate: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.projectTask.findMany({
      where: {
        ownerId: session.userId,
        status: { not: "DONE" },
        deadline: { not: null },
      },
      select: {
        id: true,
        action: true,
        deadline: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { deadline: "asc" },
      take: UPCOMING_FETCH_LIMIT,
    }),
    prisma.milestone.findMany({
      where: { ownerId: session.userId, status: { not: "DONE" } },
      select: {
        id: true,
        name: true,
        dueDate: true,
        status: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: UPCOMING_FETCH_LIMIT,
    }),
  ]);

  const attentionProjects = canSeeManagement
    ? await prisma.project.findMany({
        where: { health: { in: [ProjectHealth.BLOCKED, ProjectHealth.DELAYED] } },
        select: { id: true, name: true, health: true, currentStage: true },
        take: 5,
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const upcoming: UpcomingItem[] = [
    ...upcomingTasks.map((t) => ({
      id: t.id,
      kind: "task" as const,
      label: t.action,
      projectId: t.project.id,
      projectName: t.project.name,
      dueDate: t.deadline as Date,
      overdue: (t.deadline as Date).getTime() < now.getTime(),
    })),
    ...upcomingMilestones.map((m) => ({
      id: m.id,
      kind: "milestone" as const,
      label: m.name,
      projectId: m.project.id,
      projectName: m.project.name,
      dueDate: m.dueDate,
      overdue: isMilestoneOverdue(m),
    })),
  ]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, UPCOMING_SHOWN);

  const firstName = session.name.split(" ")[0];

  const stats: readonly Stat[] = [
    /* Labels are single nouns so all four fit the 2-up phone cell on one
       line; the hint underneath carries the qualifier. */
    {
      key: "tasks",
      label: "Tasks",
      value: openTaskCount,
      hint: "Open and assigned to you",
      icon: <TaskStatIcon />,
    },
    {
      key: "milestones",
      label: "Milestones",
      value: openMilestoneCount,
      hint: "Open outcomes you own",
      icon: <MilestoneStatIcon />,
    },
    {
      key: "overdue",
      label: "Overdue",
      value: overdueCount,
      hint: "Past their due date",
      icon: <OverdueStatIcon />,
      tone: "danger",
    },
    {
      key: "projects",
      label: "Projects",
      value: myProjectCount,
      hint: "Active, you own or build",
      icon: <ProjectStatIcon />,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Your workload, what's due next, and anything across the portfolio waiting on a decision."
        meta={
          /* Hidden on phones: the header row puts meta and the CTA on one
             line, and holding both squeezes the description to a column. */
          <span className="annotation hidden font-data tabular-nums sm:inline">
            {formatDate(todayIsoDate(now))}
          </span>
        }
        actions={
          <ButtonLink href="/my-work" variant="primary">
            Open my work
          </ButtonLink>
        }
      />

      {/* One strip, four figures: the numbers describe a single workload, so
          they share a container instead of floating as separate widgets. */}
      <div className="rise-in mt-ds-7xl" style={step(0)}>
        <StatStrip stats={stats} />
      </div>

      {/* Management first: for a role that can see the whole portfolio, "what
          is stuck" outranks "what is mine". Other roles never render this
          panel, so their page goes straight to their own queue. */}
      {canSeeManagement && (
        <HomeCard className="rise-in mt-ds-5xl" style={step(1)}>
          <HomeCardHeader
            title="Needs attention"
            icon={
              <AttentionIcon
                className={
                  attentionProjects.length > 0
                    ? "text-danger-high"
                    : "text-text-low"
                }
              />
            }
            meta={
              attentionProjects.length > 0 ? (
                <Pill
                  tone="error"
                  label={`${attentionProjects.length} project${attentionProjects.length === 1 ? "" : "s"}`}
                />
              ) : (
                <span className="annotation">All clear</span>
              )
            }
          />

          {attentionProjects.length === 0 ? (
            <HomeEmptyState
              icon={<EmptyIcon />}
              title="Nothing is blocked or delayed"
              action={
                <ButtonLink href="/dashboard" variant="ghost">
                  Open the management dashboard
                </ButtonLink>
              }
            >
              Projects land here the moment a blocker is raised or a milestone
              slips past its due date.
            </HomeEmptyState>
          ) : (
            <>
              <ProjectList projects={attentionProjects} />
              <HomeCardFooter>
                <ButtonLink href="/dashboard" variant="ghost">
                  Open the management dashboard
                </ButtonLink>
              </HomeCardFooter>
            </>
          )}
        </HomeCard>
      )}

      <div className="mt-ds-5xl grid grid-cols-1 items-start gap-ds-5xl lg:grid-cols-12">
        <HomeCard className="rise-in lg:col-span-7" style={step(2)}>
          <HomeCardHeader
            title="Coming up"
            icon={<ScheduleIcon className="text-text-low" />}
            meta={<span className="annotation">Next 5 by due date</span>}
          />

          {upcoming.length === 0 ? (
            <HomeEmptyState
              icon={<EmptyIcon />}
              title="Nothing dated is waiting on you"
              action={
                <ButtonLink href="/my-work" variant="ghost">
                  Review my open work
                </ButtonLink>
              }
            >
              Tasks and milestones appear here as soon as someone sets a
              deadline on one assigned to you.
            </HomeEmptyState>
          ) : (
            <>
              <UpcomingList items={upcoming} now={now} />
              <HomeCardFooter>
                <ButtonLink href="/my-work" variant="ghost">
                  See every item assigned to me
                </ButtonLink>
              </HomeCardFooter>
            </>
          )}
        </HomeCard>

        <HomeCard className="rise-in lg:col-span-5" style={step(3)}>
          <HomeCardHeader
            title="Your projects"
            icon={<PortfolioIcon className="text-text-low" />}
            meta={
              myProjectCount > 0 ? (
                <span className="annotation font-data tabular-nums">
                  {myProjects.length} of {myProjectCount}
                </span>
              ) : undefined
            }
          />

          {myProjects.length === 0 ? (
            <HomeEmptyState
              icon={<EmptyIcon />}
              title="You're not on an active project yet"
              action={
                <ButtonLink href="/projects" variant="ghost">
                  Browse the portfolio
                </ButtonLink>
              }
            >
              Projects show up here once you&rsquo;re named as their owner,
              analyst, or developer.
            </HomeEmptyState>
          ) : (
            <>
              <ProjectList projects={myProjects} />
              <HomeCardFooter>
                <ButtonLink href="/projects" variant="ghost">
                  View the full portfolio
                </ButtonLink>
              </HomeCardFooter>
            </>
          )}
        </HomeCard>
      </div>
    </>
  );
}
