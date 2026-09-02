"use client";

import { useState } from "react";
import { CommunicationsSection } from "@/components/communications/CommunicationsSection";
import { EvaluationsSection } from "@/components/evaluations/EvaluationsSection";
import { InterviewsSection } from "@/components/interviews/InterviewsSection";
import { ScreeningSection } from "@/components/screening/ScreeningSection";
import {
  SectionTabPanel,
  SectionTabs,
  type SectionTab,
} from "@/components/ui/SectionTabs";
import type { MessageContextInput } from "@/lib/communications/build-context";
import { ownEvaluationState } from "@/lib/types/domain";
import type {
  ApplicationStage,
  ApplicationSummary,
  Communication,
  EvaluationFormRef,
  InterviewEvaluationRound,
  InterviewRound,
  MessageTemplate,
  PersonRef,
  ScreeningAssessment,
  StageHistoryEntry,
  Viewer,
} from "@/lib/types/domain";
import { ApplicationOverview } from "./ApplicationOverview";

/**
 * Everything about one application, as five sibling views rather than one
 * page.
 *
 * Pipeline, Screening, Interviews, Evaluations and Messages are all answers to
 * "what is the state of this application" — they belong together, which is why
 * they are sections of the application rather than five places in the
 * left-hand navigation. Stacked vertically they run well past six screens of
 * scroll, so they are disclosed as a second-level tab strip (see
 * `components/ui/SectionTabs` for why it looks nothing like the application
 * strip above it).
 *
 * The tab counts and the attention dot mean nothing is hidden by the
 * disclosure: a failed message, an unapproved draft, or an evaluation this
 * viewer personally owes is visible from the Pipeline tab without opening the
 * section it belongs to.
 *
 * Evaluations sit beside Interviews rather than inside them (Phase 4): an
 * evaluation belongs to a round, but the two are read by different people at
 * different moments — a recruiter coordinating dates is not the panelist
 * writing feedback — and nesting a second tab strip inside the Interviews tab
 * would put three levels of tabs on one screen.
 */

/** Everything the four non-pipeline sections need, gathered per application. */
export interface ApplicationDetail {
  screening: ScreeningAssessment | null;
  interviews: InterviewRound[];
  /** One per interview round, already filtered for the viewer — see
   *  `app/(dashboard)/_mock-evaluations.ts` on why the filtering happens
   *  before this data reaches the client at all. */
  evaluationRounds: InterviewEvaluationRound[];
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
  /** Widened from `PersonRef` in Phase 4: the evaluation surface is
   *  role-conditional, and "who is looking" is now part of every read. */
  currentUser: Viewer;
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
  const [evaluationRounds, setEvaluationRounds] = useState(
    detail.evaluationRounds,
  );
  const [communications, setCommunications] = useState(detail.communications);

  /**
   * Set only when the user jumps here from a round on the Interviews tab, so
   * they land on that round rather than on the list. Cleared on any
   * user-initiated tab change, so coming back to Evaluations later starts at
   * the list again.
   */
  const [evaluationFocusId, setEvaluationFocusId] = useState<string | null>(
    null,
  );

  const needsAttention = communications.some(
    (message) =>
      message.status === "FAILED" || message.status === "AWAITING_APPROVAL",
  );

  /**
   * The attention dot on Evaluations means one specific thing: *you* owe
   * feedback on a round that has already happened. Deliberately not "somebody
   * owes feedback" — that is the recruiter's dashboard's job (spec Sec 8,
   * "Feedback overdue"), and a dot that fires for other people's outstanding
   * work is a dot everyone learns to ignore.
   */
  const owesEvaluation = evaluationRounds.some(
    (round) =>
      round.viewerIsPanelist &&
      round.status === "COMPLETED" &&
      ownEvaluationState(round.own) !== "SUBMITTED",
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
      id: "evaluations",
      label: "Evaluations",
      count: evaluationRounds.length,
      attention: owesEvaluation,
    },
    {
      id: "messages",
      label: "Messages",
      count: communications.length,
      attention: needsAttention,
    },
  ];

  function openSection(id: string) {
    setEvaluationFocusId(null);
    setSection(id);
  }

  function openEvaluationsFor(interviewId: string) {
    setEvaluationFocusId(interviewId);
    setSection("evaluations");
  }

  return (
    <div>
      <SectionTabs
        tabs={tabs}
        activeId={section}
        onChange={openSection}
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
          evaluationRounds={evaluationRounds}
          onOpenEvaluations={openEvaluationsFor}
        />
      </SectionTabPanel>

      <SectionTabPanel
        id="evaluations"
        idPrefix={application.id}
        active={section === "evaluations"}
      >
        <EvaluationsSection
          rounds={evaluationRounds}
          viewer={currentUser}
          onChange={setEvaluationRounds}
          initialRoundId={evaluationFocusId}
          onOpenScreening={() => openSection("screening")}
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
