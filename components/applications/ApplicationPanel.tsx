"use client";

import { useState } from "react";
import { DecisionSection } from "@/components/approvals/DecisionSection";
import { CommunicationsSection } from "@/components/communications/CommunicationsSection";
import { EvaluationsSection } from "@/components/evaluations/EvaluationsSection";
import { InterviewsSection } from "@/components/interviews/InterviewsSection";
import { JoiningSection } from "@/components/joining/JoiningSection";
import { ScreeningSection } from "@/components/screening/ScreeningSection";
import {
  SectionTabPanel,
  SectionTabs,
  type SectionTab,
} from "@/components/ui/SectionTabs";
import type { MessageContextInput } from "@/lib/communications/build-context";
import { awaitingStep, type ApplicationApproval } from "@/lib/types/approvals";
import {
  isOverdue,
  type ApplicationJoining,
  type JoiningChecklistItem,
} from "@/lib/types/joining";
import { ownEvaluationState } from "@/lib/types/domain";
import type {
  ApplicationStage,
  ApplicationSummary,
  Communication,
  CommunicationEvent,
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
 * Everything about one application, as seven sibling views rather than one
 * page.
 *
 * Pipeline, Screening, Interviews, Evaluations, Decision, Messages and Joining
 * are all answers to
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
 *
 * Decision sits between Evaluations and Messages (Phase 5) because that is the
 * order the work happens in: the panel writes feedback, somebody signs the hire
 * off, and only then does the candidate get told. It is a tab rather than a
 * section of the Pipeline tab because it answers a different question — "should
 * we hire this person, and who has agreed" rather than "where is this
 * application" — and because the approval chain has an action on it for people
 * (department heads, HR leadership) who never touch the pipeline controls.
 *
 * Joining sits last (Phase 6) because it is the last thing that happens, and it
 * is deliberately the lightest tab here: a checkbox list with an undo, not an
 * approval. It is always rendered rather than gated on the JOINING stage — the
 * same way Screening renders before anyone has screened — so the strip's
 * membership never changes under the reader. See `JoiningSection` for the full
 * argument.
 */

/** Everything the five non-pipeline sections need, gathered per application. */
export interface ApplicationDetail {
  screening: ScreeningAssessment | null;
  interviews: InterviewRound[];
  /** One per interview round, already filtered for the viewer — see
   *  `app/(dashboard)/_mock-evaluations.ts` on why the filtering happens
   *  before this data reaches the client at all. */
  evaluationRounds: InterviewEvaluationRound[];
  communications: Communication[];
  /** The approval chain and any request on it, already resolved for the viewer
   *  (Phase 5). Null when the application's requisition could not be read. */
  approval: ApplicationApproval | null;
  /** The joining checklist plus the dates it is read against (Phase 6). */
  joining: ApplicationJoining;
  /** Requisition fields the application summary does not carry. */
  department: string;
  businessUnit: string;
}

export interface ApplicationSectionsConfig {
  templates: readonly MessageTemplate[];
  panelMembers: readonly (PersonRef & { role: string })[];
  /** Everyone who can own a joining checklist item — recruiting plus IT,
   *  Administration and HR, who own half the spec's own list. */
  joiningOwners: readonly (PersonRef & { role: string })[];
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
  viewerId,
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
  /** DEV-ONLY `?as=` override id, forwarded to the approval server actions so
   *  the mock write path can resolve the same viewer the page rendered with.
   *  Drops out with the mock data — see `_mock-evaluations.ts`. */
  viewerId?: string;
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
  const [joiningItems, setJoiningItems] = useState<JoiningChecklistItem[]>(
    detail.joining.items,
  );

  /**
   * Set only when the user jumps here from a round on the Interviews tab, so
   * they land on that round rather than on the list. Cleared on any
   * user-initiated tab change, so coming back to Evaluations later starts at
   * the list again.
   */
  const [evaluationFocusId, setEvaluationFocusId] = useState<string | null>(
    null,
  );

  /**
   * Set only when the user jumps to Messages from the Decision tab's
   * post-approval prompt, so the draft form opens with the right purpose
   * already chosen. Cleared as soon as that form closes, and on any
   * user-initiated tab change.
   */
  const [draftEvent, setDraftEvent] = useState<CommunicationEvent | null>(null);

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

  /**
   * The Joining dot follows the rule the Evaluations and Decision dots already
   * set: it fires only when *this viewer* is the one holding something up — an
   * item they own that is late or blocked. A dot that lit up for Administration's
   * overdue ID card on every recruiter's screen would be a dot everyone learns
   * to ignore, and chasing other people's joining items is the recruiter
   * dashboard's job (spec Sec 8, "Joining actions").
   */
  const owesJoiningItem = joiningItems.some(
    (item) =>
      item.owner.id === currentUser.id &&
      item.status !== "DONE" &&
      (item.status === "BLOCKED" || isOverdue(item, detail.joining.today)),
  );

  const approvalRequest = detail.approval?.request ?? null;
  const approvalSteps = approvalRequest?.steps.length;
  const currentApprovalStep = awaitingStep(approvalRequest);
  const awaitsViewer =
    currentApprovalStep !== null &&
    detail.approval?.viewerDecidableStepId === currentApprovalStep.id;

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
      id: "decision",
      label: "Decision",
      /* The count is the chain's steps, so "Decision 3" reads as "three people
         have to sign this off" — and an unconfigured or unstarted chain shows
         no count at all rather than a misleading zero. The attention dot means
         one specific thing: the chain is blocked on *you*. Same rule as the
         Evaluations dot — a dot that fires for other people's outstanding work
         is a dot everyone learns to ignore. */
      count: approvalSteps,
      attention: awaitsViewer,
    },
    {
      id: "messages",
      label: "Messages",
      count: communications.length,
      attention: needsAttention,
    },
    {
      id: "joining",
      /* Seventh and last, because it is the last thing that happens. Always
         present rather than gated on the JOINING stage — see the header comment
         on `JoiningSection` for why. `0` is a real answer here ("no checklist
         started"), which is exactly what `SectionTab.count` renders. */
      label: "Joining",
      count: joiningItems.length,
      attention: owesJoiningItem,
    },
  ];

  function openSection(id: string) {
    setEvaluationFocusId(null);
    setDraftEvent(null);
    setSection(id);
  }

  function openEvaluationsFor(interviewId: string) {
    setEvaluationFocusId(interviewId);
    setSection("evaluations");
  }

  function draftMessageFor(event: CommunicationEvent) {
    setDraftEvent(event);
    setSection("messages");
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
        id="decision"
        idPrefix={application.id}
        active={section === "decision"}
      >
        <DecisionSection
          application={application}
          approval={detail.approval}
          rounds={evaluationRounds}
          screening={screening}
          communications={communications}
          viewerId={viewerId}
          onOpenScreening={() => openSection("screening")}
          onOpenEvaluations={openEvaluationsFor}
          onOpenPipeline={() => openSection("pipeline")}
          onDraftMessage={draftMessageFor}
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
          draftEvent={draftEvent}
          onDraftEventHandled={() => setDraftEvent(null)}
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

      <SectionTabPanel
        id="joining"
        idPrefix={application.id}
        active={section === "joining"}
      >
        <JoiningSection
          applicationId={application.id}
          stage={application.stage}
          joining={detail.joining}
          items={joiningItems}
          owners={config.joiningOwners}
          assignedRecruiter={application.assignedRecruiter}
          viewerId={viewerId}
          onChange={setJoiningItems}
        />
      </SectionTabPanel>
    </div>
  );
}
