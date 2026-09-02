"use client";

import { useState } from "react";
import { CommunicationsSection } from "@/components/communications/CommunicationsSection";
import { InterviewsSection } from "@/components/interviews/InterviewsSection";
import { ScreeningSection } from "@/components/screening/ScreeningSection";
import {
  SectionTabPanel,
  SectionTabs,
  type SectionTab,
} from "@/components/ui/SectionTabs";
import type { MessageContextInput } from "@/lib/communications/build-context";
import type {
  ApplicationStage,
  ApplicationSummary,
  Communication,
  EvaluationFormRef,
  InterviewRound,
  MessageTemplate,
  PersonRef,
  ScreeningAssessment,
  StageHistoryEntry,
} from "@/lib/types/domain";
import { ApplicationOverview } from "./ApplicationOverview";

/**
 * Everything about one application, as four sibling views rather than one
 * page.
 *
 * Pipeline, Screening, Interviews and Messages are all answers to "what is the
 * state of this application" — they belong together, which is why they are
 * sections of the application rather than four places in the left-hand
 * navigation. Stacked vertically they run to six screens of scroll, so they
 * are disclosed as a second-level tab strip (see `components/ui/SectionTabs`
 * for why it looks nothing like the application strip above it).
 *
 * The tab counts and the attention dot mean nothing is hidden by the
 * disclosure: a failed message or an unapproved draft is visible from the
 * Pipeline tab without opening Messages.
 */

/** Everything the three new sections need, gathered per application. */
export interface ApplicationDetail {
  screening: ScreeningAssessment | null;
  interviews: InterviewRound[];
  communications: Communication[];
  /** Requisition fields the application summary does not carry. */
  department: string;
  businessUnit: string;
}

export interface ApplicationSectionsConfig {
  templates: readonly MessageTemplate[];
  panelMembers: readonly (PersonRef & { role: string })[];
  evaluationForms: readonly EvaluationFormRef[];
  candidate: MessageContextInput["candidate"];
  recruiter: MessageContextInput["recruiter"];
  companyName: string;
}

export function ApplicationPanel({
  application,
  history,
  people,
  detail,
  config,
  currentUser,
  onApplied,
}: {
  application: ApplicationSummary;
  history: StageHistoryEntry[];
  people: readonly PersonRef[];
  detail: ApplicationDetail;
  config: ApplicationSectionsConfig;
  currentUser: PersonRef;
  onApplied: (change: {
    stage: ApplicationStage;
    nextAction: string;
    actionOwner: PersonRef;
    dueDate: string;
    version: number;
  }) => void;
}) {
  const [section, setSection] = useState("pipeline");

  /**
   * The three new sections' data lives here rather than inside each section,
   * for two reasons: an inactive tab panel is unmounted (so section-local state
   * would be thrown away on every tab switch), and the Messages tab renders
   * interview dates into message previews — it has to see a round scheduled
   * one tab over.
   *
   * With the real API these become `router.refresh()` after each mutation, or
   * a small cache keyed by application id; the shape of the sections' props
   * does not change either way.
   */
  const [screening, setScreening] = useState(detail.screening);
  const [interviews, setInterviews] = useState(detail.interviews);
  const [communications, setCommunications] = useState(detail.communications);

  const needsAttention = communications.some(
    (message) =>
      message.status === "FAILED" || message.status === "AWAITING_APPROVAL",
  );

  const tabs: readonly SectionTab[] = [
    { id: "pipeline", label: "Pipeline" },
    {
      id: "screening",
      label: "Screening",
      count: screening ? 1 : 0,
    },
    {
      id: "interviews",
      label: "Interviews",
      count: interviews.length,
    },
    {
      id: "messages",
      label: "Messages",
      count: communications.length,
      attention: needsAttention,
    },
  ];

  return (
    <div>
      <SectionTabs
        tabs={tabs}
        activeId={section}
        onChange={setSection}
        idPrefix={application.id}
        label={`Sections of the ${application.requisitionTitle} application`}
      />

      <SectionTabPanel
        id="pipeline"
        idPrefix={application.id}
        active={section === "pipeline"}
      >
        <ApplicationOverview
          application={application}
          history={history}
          people={people}
          onApplied={onApplied}
        />
      </SectionTabPanel>

      <SectionTabPanel
        id="screening"
        idPrefix={application.id}
        active={section === "screening"}
      >
        <ScreeningSection
          applicationId={application.id}
          screening={screening}
          onSaved={setScreening}
        />
      </SectionTabPanel>

      <SectionTabPanel
        id="interviews"
        idPrefix={application.id}
        active={section === "interviews"}
      >
        <InterviewsSection
          applicationId={application.id}
          interviews={interviews}
          onChange={setInterviews}
          panelMembers={config.panelMembers}
          evaluationForms={config.evaluationForms}
          currentUser={currentUser}
        />
      </SectionTabPanel>

      <SectionTabPanel
        id="messages"
        idPrefix={application.id}
        active={section === "messages"}
      >
        <CommunicationsSection
          applicationId={application.id}
          communications={communications}
          onChange={setCommunications}
          templates={config.templates}
          interviews={interviews}
          currentUser={currentUser}
          context={{
            application,
            candidate: config.candidate,
            department: detail.department,
            businessUnit: detail.businessUnit,
            recruiter: config.recruiter,
            companyName: config.companyName,
          }}
        />
      </SectionTabPanel>
    </div>
  );
}
