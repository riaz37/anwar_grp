"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/StatusPill";
import { SegmentedTrack, type TrackSegment } from "@/components/ui/SegmentedTrack";
import { SectionTabs, SectionTabPanel } from "@/components/ui/SectionTabs";
import { daysSince, formatDate } from "@/lib/format";
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  STAGE_LABELS,
  STAGE_ORDER,
} from "./projectTone";
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
} from "./types";
import { ProjectOverviewPanel } from "./ProjectOverviewPanel";
import { ProjectPeoplePanel } from "./ProjectPeoplePanel";
import { ProjectStageGatesPanel } from "./ProjectStageGatesPanel";
import { ProjectMilestonesTasksPanel } from "./ProjectMilestonesTasksPanel";
import { ProjectBlockersPanel } from "./ProjectBlockersPanel";
import { ProjectFilesPanel } from "./ProjectFilesPanel";

export function ProjectWorkspace({
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
  const [activeTab, setActiveTab] = useState("overview");

  function refresh() {
    router.refresh();
  }

  const currentIndex = STAGE_ORDER.indexOf(project.currentStage);
  const segments: TrackSegment[] = STAGE_ORDER.map((stage, index) => ({
    key: stage,
    label: STAGE_LABELS[stage],
    fill:
      index < currentIndex
        ? "bg-success"
        : index === currentIndex
          ? "bg-accent"
          : "bg-border",
    spokenState:
      index < currentIndex ? "completed" : index === currentIndex ? "current stage" : undefined,
    emphasised: index === currentIndex,
  }));

  return (
    <>
      <PageHeader
        title={project.name}
        backHref="/projects"
        backLabel="Back to portfolio"
        eyebrow={`${project.businessUnit.name} / ${project.department.name}`}
        meta={
          <span className="flex items-center gap-sm">
            <Pill tone={HEALTH_TONE[project.health]} label={HEALTH_LABELS[project.health]} />
          </span>
        }
      />

      <div className="mt-md flex flex-col gap-sm">
        <SegmentedTrack segments={segments} ariaLabel="Project stage" labelsFrom="lg" />
        <div className="flex flex-wrap items-center gap-x-lg gap-y-2xs text-body-sm text-muted">
          <span>
            Stage: <span className="font-medium text-text">{STAGE_LABELS[project.currentStage]}</span>
          </span>
          <span>
            Gate readiness:{" "}
            <span className="font-data font-medium tabular-nums text-text">
              {readiness.percent}%
            </span>{" "}
            ({readiness.checked}/{readiness.total})
          </span>
          <span>
            Expected delivery:{" "}
            <span className="font-data font-medium tabular-nums text-text">
              {formatDate(project.expectedDeliveryDate.slice(0, 10))}
            </span>
          </span>
          {latestUpdate && (
            <span>
              Latest update:{" "}
              <span className="font-medium text-text">{latestUpdate.label}</span>
              {" — "}
              {daysSince(latestUpdate.at)} day{daysSince(latestUpdate.at) === 1 ? "" : "s"} ago
            </span>
          )}
        </div>
      </div>

      <div className="mt-lg">
        <SectionTabs
          label="Project sections"
          idPrefix="project"
          activeId={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "people", label: "People" },
            { id: "gates", label: "Stage & Gates" },
            { id: "milestones", label: "Milestones & Tasks", count: milestones.length + tasks.length },
            {
              id: "blockers",
              label: "Blockers",
              count: blockers.filter((b) => !b.resolvedAt).length,
              attention: blockers.some((b) => !b.resolvedAt),
            },
            { id: "files", label: "Files", count: documents.length },
          ]}
        />

        <SectionTabPanel id="overview" idPrefix="project" active={activeTab === "overview"}>
          <ProjectOverviewPanel
            project={project}
            scopeChanges={scopeChanges}
            currentUserRole={currentUserRole}
            onChanged={refresh}
          />
        </SectionTabPanel>

        <SectionTabPanel id="people" idPrefix="project" active={activeTab === "people"}>
          <ProjectPeoplePanel
            project={project}
            users={users}
            currentUserRole={currentUserRole}
            onChanged={refresh}
          />
        </SectionTabPanel>

        <SectionTabPanel id="gates" idPrefix="project" active={activeTab === "gates"}>
          <ProjectStageGatesPanel
            projectId={project.id}
            currentStage={project.currentStage}
            checklistItems={checklistItems}
            stageHistory={stageHistory}
            currentUserRole={currentUserRole}
            onChanged={refresh}
          />
        </SectionTabPanel>

        <SectionTabPanel id="milestones" idPrefix="project" active={activeTab === "milestones"}>
          <ProjectMilestonesTasksPanel
            projectId={project.id}
            milestones={milestones}
            tasks={tasks}
            delayReasons={delayReasons}
            users={users}
            currentUserRole={currentUserRole}
            onChanged={refresh}
          />
        </SectionTabPanel>

        <SectionTabPanel id="blockers" idPrefix="project" active={activeTab === "blockers"}>
          <ProjectBlockersPanel
            projectId={project.id}
            blockers={blockers}
            currentUserRole={currentUserRole}
            onChanged={refresh}
          />
        </SectionTabPanel>

        <SectionTabPanel id="files" idPrefix="project" active={activeTab === "files"}>
          <ProjectFilesPanel projectId={project.id} documents={documents} onChanged={refresh} />
        </SectionTabPanel>
      </div>
    </>
  );
}
