"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/StatusPill";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives/tabs";
import { daysSince } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HEALTH_LABELS, HEALTH_TONE } from "../projectTone";
import type {
  BlockerView,
  ChecklistItemView,
  DelayReasonView,
  DocumentView,
  MilestoneView,
  ProjectDetail,
  RefUser,
  ScopeChangeView,
  StageHistoryView,
  TaskView,
} from "../types";
import { BlockersSection } from "./BlockersSection";
import { FilesSection } from "./FilesSection";
import { GatesSection } from "./GatesSection";
import { OverviewSection } from "./OverviewSection";
import { ProjectRail } from "./ProjectRail";
import { StageMeter } from "./StageMeter";
import { WorkSection } from "./WorkSection";
import { Num } from "./chrome";

/**
 * Single-project workspace.
 *
 * Composition: masthead → pipeline band → two columns. The left column is the
 * work you do (five sections behind one tab bar); the right rail holds the
 * facts that stay true whichever section is open, so the answer to "who owns
 * this and when is it due" never scrolls away.
 *
 * Every section writes through the API and then re-reads the server data.
 * The re-read isn't instant, so it gets a visible, non-blocking pending state
 * — otherwise a saved change looks like nothing happened for a beat.
 */
export function ProjectDetailView({
  currentUserRole,
  project,
  readiness,
  latestUpdate,
  checklistItems,
  stageHistory,
  milestones,
  tasks,
  blockers,
  scopeChanges,
  delayReasons,
  documents,
  users,
}: {
  currentUserRole: Role;
  project: ProjectDetail;
  readiness: { total: number; checked: number; percent: number };
  latestUpdate: { label: string; at: string } | null;
  checklistItems: ChecklistItemView[];
  stageHistory: StageHistoryView[];
  milestones: MilestoneView[];
  tasks: TaskView[];
  blockers: BlockerView[];
  scopeChanges: ScopeChangeView[];
  delayReasons: DelayReasonView[];
  documents: DocumentView[];
  users: RefUser[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [refreshing, startRefresh] = useTransition();

  function refresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  const openBlockers = blockers.filter((b) => !b.resolvedAt).length;
  const latestUpdateAge = latestUpdate ? daysSince(latestUpdate.at) : 0;

  return (
    <>
      <PageHeader
        title={project.name}
        backHref="/projects"
        backLabel="Back to portfolio"
        eyebrow={`${project.businessUnit.name} / ${project.department.name}`}
        meta={
          <div className="flex flex-col items-end gap-ds-xs">
            <Pill
              tone={HEALTH_TONE[project.health]}
              label={HEALTH_LABELS[project.health]}
              size="md"
            />
            {latestUpdate && (
              <p className="text-caption-2 text-text-low">
                Updated <Num>{latestUpdateAge}</Num> day
                {latestUpdateAge === 1 ? "" : "s"} ago
              </p>
            )}
          </div>
        }
      />

      {/* Announced politely rather than blocking: the sections stay usable
          while the server data is re-read. */}
      <div aria-live="polite" className="empty:hidden">
        {refreshing && (
          <p className="mt-ds-md text-caption-2 text-text-low motion-safe:animate-[fade-in_200ms_var(--ease-enter)]">
            Updating project…
          </p>
        )}
      </div>

      {/* The pipeline band is the one contained surface above the fold; the
          sections below it are flat, so the page has a rhythm rather than a
          column of identical cards. */}
      <section
        aria-labelledby="pipeline-title"
        className="mt-ds-5xl rounded-xl border border-outline-low bg-surface-0 px-ds-5xl py-ds-2xl shadow-e1"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-ds-5xl gap-y-ds-xs">
          <h2 id="pipeline-title" className="annotation">
            Pipeline
          </h2>
          <p className="text-body-1 text-muted-foreground">
            Gate readiness{" "}
            <span className="font-data font-semibold tabular-nums text-text-high">
              {readiness.percent}%
            </span>{" "}
            <Num>
              ({readiness.checked}/{readiness.total})
            </Num>
          </p>
        </div>
        <StageMeter current={project.currentStage} className="mt-ds-2xl pb-ds-md" />
      </section>

      <div className="mt-ds-9xl grid items-start gap-ds-9xl lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-ds-7xl">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-0">
          {/* Horizontal scroll rather than a wrapping tab bar: five labels on a
              narrow phone should stay one rail you swipe, not two rows that
              reflow as counts change. */}
          <div className="-mx-ds-md overflow-x-auto border-b border-outline-low template-scroll">
            <TabsList
              className="h-auto! w-max min-w-full justify-start gap-ds-5xl rounded-none bg-transparent p-0 px-ds-md"
              aria-label="Project sections"
            >
              <SectionTab value="overview">Overview</SectionTab>
              <SectionTab value="gates">Stage &amp; gates</SectionTab>
              <SectionTab value="work" count={milestones.length + tasks.length}>
                Milestones &amp; tasks
              </SectionTab>
              <SectionTab value="blockers" count={openBlockers} attention={openBlockers > 0}>
                Blockers
              </SectionTab>
              <SectionTab value="files" count={documents.length}>
                Files
              </SectionTab>
            </TabsList>
          </div>

          <TabsContent value="overview" className="pt-ds-9xl">
            <OverviewSection
              project={project}
              scopeChanges={scopeChanges}
              currentUserRole={currentUserRole}
              onChanged={refresh}
            />
          </TabsContent>

          <TabsContent value="gates" className="pt-ds-9xl">
            <GatesSection
              projectId={project.id}
              currentStage={project.currentStage}
              checklistItems={checklistItems}
              stageHistory={stageHistory}
              readiness={readiness}
              currentUserRole={currentUserRole}
              onChanged={refresh}
            />
          </TabsContent>

          <TabsContent value="work" className="pt-ds-9xl">
            <WorkSection
              projectId={project.id}
              milestones={milestones}
              tasks={tasks}
              delayReasons={delayReasons}
              users={users}
              currentUserRole={currentUserRole}
              onChanged={refresh}
            />
          </TabsContent>

          <TabsContent value="blockers" className="pt-ds-9xl">
            <BlockersSection
              projectId={project.id}
              blockers={blockers}
              users={users}
              currentUserRole={currentUserRole}
              onChanged={refresh}
            />
          </TabsContent>

          <TabsContent value="files" className="pt-ds-9xl">
            <FilesSection
              projectId={project.id}
              documents={documents}
              onChanged={refresh}
            />
          </TabsContent>
        </Tabs>

        <ProjectRail
          project={project}
          users={users}
          currentUserRole={currentUserRole}
          latestUpdate={latestUpdate}
          openBlockerCount={openBlockers}
          onChanged={refresh}
        />
      </div>
    </>
  );
}

/**
 * Tab in the section rail.
 *
 * Built on the Radix trigger (roving tabindex, arrow-key navigation, correct
 * `aria-selected`), restyled to a text rail with its own underline rather than
 * the app's filled segmented control — a filled pill this wide would compete
 * with the accent CTA in the gates section.
 */
function SectionTab({
  value,
  count,
  attention = false,
  children,
}: {
  value: string;
  count?: number;
  attention?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "group/tab relative h-11 flex-none gap-ds-md rounded-none border-0 px-0 text-body-1 font-medium",
        "bg-transparent text-text-med shadow-none! hover:text-text-high",
        "data-[state=active]:bg-transparent! data-[state=active]:font-semibold data-[state=active]:text-text-high",
      )}
    >
      <span>{children}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "rounded-pill px-ds-sm py-[1px] font-data text-caption-1 tabular-nums",
            attention
              ? "bg-danger-wash text-danger-high"
              : "bg-surface-2 text-text-low group-data-[state=active]/tab:text-text-med",
          )}
        >
          {count}
        </span>
      )}
      {/* The active underline. Drawn here rather than left to the primitive's
          `after:` element so it lands exactly on the rail's hairline. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px h-[2px] origin-left scale-x-0 bg-primary-med transition-transform duration-150 ease-[var(--ease-move)] group-data-[state=active]/tab:scale-x-100 motion-reduce:transition-none"
      />
    </TabsTrigger>
  );
}
