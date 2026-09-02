import "server-only";
import type {
  EvaluationCriterion,
  EvaluationDraftInput,
  EvaluationFormTemplate,
  EvaluationRecord,
  EvaluationSummaryView,
  InterviewEvaluationRound,
  InterviewRound,
  OverallRecommendation,
  PanelFeedbackView,
  PanelRecommendation,
  PersonRef,
  UserRole,
  Viewer,
} from "@/lib/types/domain";
import { meanScore } from "@/lib/types/domain";
import { personById, systemRoleOf } from "./_mock-reference";

/**
 * TEMPORARY mock data for Interview Evaluation (spec Sec 6 > Interview
 * Evaluation + Decisions and Approvals; BUILD_PLAN.md Sec 3.1 item 4).
 *
 * `import "server-only"` is load-bearing, not hygiene. This module holds every
 * panelist's evaluation for every round, including ones the viewer is not
 * allowed to see. If it were importable from a client component, Next would
 * bundle the whole fixture into the browser and the blind-until-submit gate
 * would be a lie that dev-tools disproves in ten seconds. Everything crossing
 * to the client goes through `getEvaluationRounds()` below, which applies the
 * same filter the API applies server-side — so a blinded viewer's payload
 * contains no peer evaluation at all, rather than one that is merely not
 * rendered.
 *
 * SWAP POINTS
 *   app/(dashboard)/candidates/[id]/page.tsx
 *     getEvaluationRounds(interviews, viewer)
 *       -> await fetchEvaluationRounds(interviewIds);
 *          // GET /api/v1/interviews/{id}/evaluations
 *          //   -> the caller's own row + (once their own is submitted, or
 *          //      they are not a PANEL_MEMBER) their peers' rows. The route
 *          //      must shape its query through `visibleEvaluationsWhere()`
 *          //      (lib/evaluation-visibility.ts) — never fetch-then-filter.
 *          // GET /api/v1/interviews/{id}/evaluation-summary
 *          //   -> EvaluationSummaryView, for the roles in SUMMARY_ROLES
 *          //      below only; the route rejects PANEL_MEMBER callers.
 *          // GET /api/v1/evaluation-form-templates?roleType=
 *          //   -> EvaluationFormTemplate[]. The mock nests the round's
 *          //      template in the round payload instead of fetching it
 *          //      separately: a form is useless without its criteria, so a
 *          //      second round trip buys nothing. The route above is what the
 *          //      (deferred) TA_ADMIN template editor will read.
 *
 *   app/(dashboard)/_evaluation-actions.ts
 *     saveEvaluationDraftAction -> POST /api/v1/interviews/{id}/evaluations
 *                                  { ...fields, submitted: false }
 *     submitEvaluationAction    -> POST /api/v1/interviews/{id}/evaluations
 *                                  { ...fields, submitted: true }
 *                                  then re-GET .../evaluations, because the
 *                                  submit response carries the caller's own
 *                                  row only — the peers it just unblinded come
 *                                  from the list route's WHERE clause.
 *
 *          NOTE — the route landed as one upsert endpoint with a `submitted`
 *          flag rather than the separate submit endpoint this UI originally
 *          assumed. Its reasoning (both actions write the same fields; the
 *          handler already resolves ownership) holds, and the client shape is
 *          unaffected: the form still has two distinct actions with different
 *          weight, and `submitted: true` on a locked row is a 409
 *          (`EVALUATION_LOCKED`), which is exactly what the read-only UI state
 *          mirrors.
 *
 * The fixtures cover every state the UI has to render:
 *   int_8814_r1  three panelists, two submitted, one draft  — the blind gate,
 *                from both sides, plus "missing feedback" in the summary
 *   int_8866_r1  two panelists, both submitted              — the complete,
 *                all-green summary
 *   int_8845_r1  panel assigned, nothing started            — empty state
 *   int_8814_r2  a future round the viewer sits on          — own form, no
 *                peer feedback yet
 */

/* ── Form templates (spec: "configurable for different role types") ──────── */

/**
 * Four templates over the same domain vocabulary, differing in which criteria
 * they carry and what scale they use. The evaluation form component renders
 * whatever is in `criteria` — swapping a round's template changes the form
 * with no code change, which is the whole point of the spec sentence.
 *
 * Keys match `DEFAULT_CRITERIA` in `lib/evaluation-forms.ts` wherever the
 * dimension is the same one, so a mock evaluation's `scores` map is valid
 * against the real `sanitizeScores()` without translation.
 *
 * Deliberate: every criterion *within* one template shares a `scoreMax`.
 * `lib/evaluation-forms.ts` permits mixing them, but the consolidated summary
 * averages raw score values — a flat mean over a 5-point and a 10-point
 * criterion is not a number anyone should act on. Flagged for the backend
 * rather than papered over in the UI; see BUILD_PLAN's Phase 4 notes.
 */
const CRITERIA = {
  relevantExperience: (scoreMax: number): EvaluationCriterion => ({
    key: "relevant_experience",
    label: "Relevant experience",
    description:
      "Depth and closeness of prior work to what this role actually does.",
    scoreMax,
  }),
  technical: (scoreMax: number): EvaluationCriterion => ({
    key: "technical_functional_capability",
    label: "Technical / functional capability",
    description: "Command of the craft the role is hired for.",
    scoreMax,
  }),
  communication: (scoreMax: number): EvaluationCriterion => ({
    key: "communication",
    label: "Communication",
    description: "Clarity, listening, and pitching the right level of detail.",
    scoreMax,
  }),
  problemSolving: (scoreMax: number): EvaluationCriterion => ({
    key: "problem_solving",
    label: "Problem solving",
    description: "How they reason through an unfamiliar problem out loud.",
    scoreMax,
  }),
  leadership: (scoreMax: number): EvaluationCriterion => ({
    key: "leadership",
    label: "Leadership",
    description: "Setting direction, and carrying people with them.",
    scoreMax,
  }),
} as const;

export const MOCK_EVALUATION_TEMPLATES: readonly EvaluationFormTemplate[] = [
  {
    id: "evf_standard",
    name: "Standard technical round",
    roleType: "Technical and engineering roles",
    isActive: true,
    criteria: [
      CRITERIA.relevantExperience(5),
      CRITERIA.technical(5),
      CRITERIA.problemSolving(5),
      CRITERIA.communication(5),
    ],
  },
  {
    id: "evf_functional",
    name: "Functional / commercial round",
    roleType: "Merchandising, commercial and support roles",
    isActive: true,
    criteria: [
      CRITERIA.relevantExperience(5),
      {
        key: "technical_functional_capability",
        label: "Functional capability",
        description:
          "Command of the function's own tools, terms and day-to-day work.",
        scoreMax: 5,
      },
      CRITERIA.communication(5),
      {
        key: "stakeholder_handling",
        label: "Stakeholder handling",
        description:
          "Working across buyers, factories and internal teams without escalation.",
        scoreMax: 5,
      },
    ],
  },
  {
    id: "evf_leadership",
    name: "Leadership round",
    roleType: "Manager level and above",
    // A ten-point scale, unlike every other template here: senior panels want
    // room to separate "solid" from "exceptional", and a five-point scale
    // collapses that distinction. Proves the scale is per-template config, not
    // a constant baked into the form component.
    isActive: true,
    criteria: [
      CRITERIA.leadership(10),
      {
        key: "people_development",
        label: "People development",
        description: "Evidence of growing the people who reported to them.",
        scoreMax: 10,
      },
      {
        key: "strategic_judgement",
        label: "Strategic judgement",
        description:
          "Choosing what not to do, and defending the choice under pressure.",
        scoreMax: 10,
      },
      CRITERIA.communication(10),
    ],
  },
  {
    id: "evf_entry",
    name: "Entry-level screening round",
    roleType: "Entry level and internships",
    // Three criteria, not five — an entry-level panel has no prior work to
    // score, and asking them to rate "relevant experience" out of five
    // produces noise, not signal.
    isActive: true,
    criteria: [
      CRITERIA.communication(5),
      CRITERIA.problemSolving(5),
      {
        key: "learning_attitude",
        label: "Learning attitude",
        description: "How they responded when they did not know something.",
        scoreMax: 5,
      },
    ],
  },
];

export function templateById(id: string | null): EvaluationFormTemplate | null {
  if (!id) return null;
  return MOCK_EVALUATION_TEMPLATES.find((form) => form.id === id) ?? null;
}

/* ── Seeded evaluations ──────────────────────────────────────────────────── */

function timestampDaysAgo(offset: number, hour = 16): string {
  const date = new Date();
  date.setUTCHours(hour, 20, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

interface EvaluationSeed {
  interviewId: string;
  templateId: string;
  panelistId: string;
  scores: Record<string, number>;
  organizationalSuitability: string;
  strengths: string;
  concerns: string;
  overallRecommendation: OverallRecommendation | null;
  /** Days ago the panelist submitted, or null for a still-editable draft. */
  submittedDaysAgo: number | null;
  createdDaysAgo: number;
}

const SEEDS: readonly EvaluationSeed[] = [
  {
    interviewId: "int_8814_r1",
    templateId: "evf_functional",
    panelistId: "usr_hm_1",
    scores: {
      relevant_experience: 4,
      technical_functional_capability: 4,
      communication: 5,
      stakeholder_handling: 3,
    },
    organizationalSuitability:
      "Comes from a similar buyer-driven environment, so the pace here will not surprise her. Fits the way the merchandising floor actually works.",
    strengths:
      "Six years on knit programmes for two of the same buyers we serve. Walked through a costing sheet from memory and caught an error in my example.",
    concerns:
      "Has always worked with a dedicated sampling team. We do not have one, and she would be doing that follow-up herself for the first year.",
    overallRecommendation: "YES",
    submittedDaysAgo: 8,
    createdDaysAgo: 9,
  },
  {
    interviewId: "int_8814_r1",
    templateId: "evf_functional",
    panelistId: "usr_panel_4",
    scores: {
      relevant_experience: 3,
      technical_functional_capability: 4,
      communication: 4,
      stakeholder_handling: 3,
    },
    organizationalSuitability:
      "Reasonable fit. Would want the department head to set expectations on reporting lines early — she is used to a flatter structure.",
    strengths:
      "Strong on fabric and trims detail. Answers were specific rather than general, and she corrected herself where she was unsure.",
    concerns:
      "Little exposure to woven programmes, which is half of what this role covers. Also seemed uncomfortable when pushed on the shipment-delay example.",
    overallRecommendation: "NEUTRAL",
    submittedDaysAgo: 7,
    createdDaysAgo: 8,
  },
  {
    // The draft that makes the blind gate demonstrable from the inside: Tuhin
    // has started but not submitted, so he sees "2 of 3 submitted" and nothing
    // else, while his own partly-scored draft stays editable.
    interviewId: "int_8814_r1",
    templateId: "evf_functional",
    panelistId: "usr_panel_3",
    scores: {
      relevant_experience: 4,
      communication: 4,
    },
    organizationalSuitability: "",
    strengths:
      "Explained the buyer-escalation example clearly and without blaming the factory.",
    concerns: "",
    overallRecommendation: null,
    submittedDaysAgo: null,
    createdDaysAgo: 6,
  },
  {
    interviewId: "int_8866_r1",
    templateId: "evf_standard",
    panelistId: "usr_hm_2",
    scores: {
      relevant_experience: 5,
      technical_functional_capability: 5,
      problem_solving: 4,
      communication: 4,
    },
    organizationalSuitability:
      "Would slot straight into the studio. Already works the way this team does — small briefs, fast turnaround, no hand-holding.",
    strengths:
      "The portfolio was the strongest we have seen for this role. Talked through the trade-offs behind two rejected directions, not just the finished work.",
    concerns: "",
    overallRecommendation: "STRONG_YES",
    submittedDaysAgo: 1,
    createdDaysAgo: 2,
  },
  {
    interviewId: "int_8866_r1",
    templateId: "evf_standard",
    panelistId: "usr_panel_4",
    scores: {
      relevant_experience: 4,
      technical_functional_capability: 5,
      problem_solving: 4,
      communication: 3,
    },
    organizationalSuitability:
      "Fits the studio's way of working. Less certain about the cross-unit presentations this role picks up in the second year.",
    strengths:
      "Technically the best of the shortlist. Rebuilt one of my examples live and improved on it.",
    concerns:
      "Quiet in a group setting. Two of the three buyer presentations this role owns are to a room of fifteen, and I could not tell from this round how that would go.",
    overallRecommendation: "YES",
    submittedDaysAgo: 1,
    createdDaysAgo: 1,
  },
];

function hydrate(seed: EvaluationSeed): EvaluationRecord {
  const template = templateById(seed.templateId);
  return {
    id: `evl_${seed.interviewId}_${seed.panelistId}`,
    interviewId: seed.interviewId,
    panelist: personById(seed.panelistId),
    panelistRole: systemRoleOf(seed.panelistId),
    templateId: seed.templateId,
    templateName: template?.name ?? "—",
    scores: seed.scores,
    organizationalSuitability: seed.organizationalSuitability,
    strengths: seed.strengths,
    concerns: seed.concerns,
    overallRecommendation: seed.overallRecommendation,
    submittedAt:
      seed.submittedDaysAgo === null
        ? null
        : timestampDaysAgo(seed.submittedDaysAgo),
    createdAt: timestampDaysAgo(seed.createdDaysAgo, 9),
    updatedAt: timestampDaysAgo(seed.submittedDaysAgo ?? seed.createdDaysAgo),
  };
}

/**
 * In-memory store so a draft saved (or an evaluation submitted) through the
 * server actions survives the page reload that follows it, in one dev-server
 * process. Replaced wholesale by the database — this is not a cache to keep.
 */
let STORE: readonly EvaluationRecord[] = SEEDS.map(hydrate);

function evaluationsFor(interviewId: string): EvaluationRecord[] {
  return STORE.filter((record) => record.interviewId === interviewId);
}

/* ── Visibility ──────────────────────────────────────────────────────────── */

/**
 * Roles that receive the consolidated results panel.
 *
 * Mirrors the role decision documented in `lib/evaluation-visibility.ts`: the
 * blind rule is about a panel member seeing a *peer's* independent assessment,
 * so `PANEL_MEMBER` is the one role excluded here — they get their own record
 * and, after submitting, their peers' records, but not the aggregate view the
 * spec frames as the recruiter's ("Recruiters should see: panel
 * recommendations, average score, missing feedback…").
 *
 * `TECH_ADMIN` is excluded on a different ground: scores are confidential
 * fields under BUILD_PLAN.md Sec 2.5, hidden from technical administrators by
 * default and reachable only through a break-glass grant (Phase 8).
 * `AUDIT_USER` is included — read-only access to reports is exactly what that
 * role is for (BUILD_PLAN.md Sec 1, assumption 4).
 *
 * DIVERGENCE TO RESOLVE — the landed route
 * (`app/api/v1/interviews/[id]/evaluation-summary/route.ts`) allows
 * `TECH_ADMIN`; this set does not. BUILD_PLAN.md Sec 2.5 says confidential
 * fields — scores explicitly among them — are "hidden by default even from
 * Technical Administrators", reachable only under a break-glass grant that
 * does not exist until Phase 8. Either the route drops `TECH_ADMIN` until then,
 * or this set adds it and the Phase 8 break-glass work removes it again. Not a
 * decision to make silently in a component, so the UI is the stricter of the
 * two for now.
 */
const SUMMARY_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  "TA_ADMIN",
  "RECRUITER",
  "DEPT_HEAD",
  "HIRING_MANAGER",
  "HR_LEADERSHIP",
  "AUDIT_USER",
]);

/**
 * The one rule, in one place — the client-side mirror of
 * `visibleEvaluationsWhere()`.
 *
 * A PANEL_MEMBER sees peers only once their own row carries `submittedAt`.
 * Every other role is a consumer of the consolidated result rather than a
 * competing interviewer, and is never blinded.
 */
function peersVisibleTo(
  viewer: Viewer,
  own: EvaluationRecord | null,
): boolean {
  if (viewer.role !== "PANEL_MEMBER") return true;
  return Boolean(own?.submittedAt);
}

function buildPanelFeedback(
  viewer: Viewer,
  panel: readonly PersonRef[],
  evaluations: readonly EvaluationRecord[],
): PanelFeedbackView {
  const submitted = evaluations.filter((record) => record.submittedAt);
  const own =
    evaluations.find((record) => record.panelist.id === viewer.id) ?? null;
  const counts = {
    submittedCount: submitted.length,
    totalPanelists: panel.length,
  };

  if (!peersVisibleTo(viewer, own)) {
    // No `evaluations` key exists on this variant, so there is nothing to
    // leak: the peer rows are dropped here, on the server, exactly as the API
    // drops them in its WHERE clause.
    return { state: "BLIND", ...counts };
  }

  const submittedIds = new Set(submitted.map((record) => record.panelist.id));
  return {
    state: "OPEN",
    ...counts,
    evaluations: submitted.filter(
      (record) => record.panelist.id !== viewer.id,
    ),
    awaiting: panel.filter((person) => !submittedIds.has(person.id)),
  };
}

function buildSummary(
  interviewId: string,
  panel: readonly PersonRef[],
  evaluations: readonly EvaluationRecord[],
  template: EvaluationFormTemplate | null,
): EvaluationSummaryView {
  const submitted = evaluations.filter((record) => record.submittedAt);
  const submittedIds = new Set(submitted.map((record) => record.panelist.id));

  const panelRecommendations: PanelRecommendation[] = panel.map((person) => {
    const record = evaluations.find(
      (entry) => entry.panelist.id === person.id && entry.submittedAt,
    );
    return {
      panelist: person,
      panelistRole: systemRoleOf(person.id),
      submittedAt: record?.submittedAt ?? null,
      overallRecommendation: record?.overallRecommendation ?? null,
      averageScore: record ? meanScore(record.scores) : null,
    };
  });

  const allScores = submitted.flatMap((record) => Object.values(record.scores));
  const scoreMaxes = new Set(
    (template?.criteria ?? []).map((criterion) => criterion.scoreMax),
  );

  const hiringManager = panelRecommendations.find(
    (entry) =>
      entry.panelistRole === "HIRING_MANAGER" &&
      entry.overallRecommendation !== null,
  );

  return {
    interviewId,
    totalPanelists: panel.length,
    submittedCount: submitted.length,
    missingFeedback: panel.filter((person) => !submittedIds.has(person.id)),
    panelRecommendations,
    averageScore:
      allScores.length === 0
        ? null
        : allScores.reduce((sum, value) => sum + value, 0) / allScores.length,
    // Null rather than a guess when a template mixes scales — an average with
    // no readable denominator is worse than no average at all.
    scoreMax: scoreMaxes.size === 1 ? [...scoreMaxes][0] : null,
    keyConcerns: submitted
      .filter((record) => record.concerns.trim().length > 0)
      .map((record) => ({
        panelist: record.panelist,
        concerns: record.concerns,
      })),
    hiringManagerRecommendation:
      hiringManager && hiringManager.overallRecommendation
        ? {
            panelist: hiringManager.panelist,
            recommendation: hiringManager.overallRecommendation,
          }
        : null,
  };
}

/**
 * Builds one round's evaluation view for one viewer. Everything the browser
 * receives passes through here first.
 */
export function getEvaluationRound(
  interview: InterviewRound,
  viewer: Viewer,
): InterviewEvaluationRound {
  const evaluations = evaluationsFor(interview.id);
  const own =
    evaluations.find((record) => record.panelist.id === viewer.id) ?? null;
  const template = templateById(interview.evaluationFormId);

  return {
    interviewId: interview.id,
    roundNumber: interview.roundNumber,
    title: interview.title,
    scheduledDate: interview.scheduledDate,
    scheduledTime: interview.scheduledTime,
    status: interview.status,
    template,
    totalPanelists: interview.panel.length,
    submittedCount: evaluations.filter((record) => record.submittedAt).length,
    viewerIsPanelist: interview.panel.some(
      (person) => person.id === viewer.id,
    ),
    own,
    panelFeedback: buildPanelFeedback(viewer, interview.panel, evaluations),
    summary: SUMMARY_ROLES.has(viewer.role)
      ? buildSummary(interview.id, interview.panel, evaluations, template)
      : null,
  };
}

export function getEvaluationRounds(
  interviews: readonly InterviewRound[],
  viewer: Viewer,
): InterviewEvaluationRound[] {
  return interviews.map((interview) => getEvaluationRound(interview, viewer));
}

/* ── Mock writes (called only from the server actions) ───────────────────── */

/**
 * Upserts the viewer's own draft. Refuses to touch a submitted row — the
 * client-side read-only treatment is a mirror of this, not the enforcement;
 * the real enforcement is the API route's immutability check once
 * `submittedAt` is set.
 */
export function writeOwnEvaluation(
  input: EvaluationDraftInput,
  viewer: Viewer,
  submit: boolean,
): EvaluationRecord {
  const existing =
    STORE.find(
      (record) =>
        record.interviewId === input.interviewId &&
        record.panelist.id === viewer.id,
    ) ?? null;

  if (existing?.submittedAt) {
    throw new Error("This evaluation has already been submitted.");
  }

  const now = new Date().toISOString();
  const next: EvaluationRecord = {
    id: existing?.id ?? `evl_${input.interviewId}_${viewer.id}`,
    interviewId: input.interviewId,
    panelist: { id: viewer.id, name: viewer.name },
    panelistRole: viewer.role,
    templateId: input.templateId,
    templateName: templateById(input.templateId)?.name ?? "—",
    scores: input.scores,
    organizationalSuitability: input.organizationalSuitability,
    strengths: input.strengths,
    concerns: input.concerns,
    overallRecommendation: input.overallRecommendation,
    submittedAt: submit ? now : null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  STORE = existing
    ? STORE.map((record) => (record.id === existing.id ? next : record))
    : [...STORE, next];

  return next;
}

/* ── Dev-only viewer switcher ────────────────────────────────────────────── */

/**
 * NOT A PRODUCT FEATURE.
 *
 * The evaluation surface looks completely different depending on who is
 * looking, and three of those four views are unreachable from a single seeded
 * session. Rather than build a fake role-switcher into the UI, the Candidate
 * Workspace reads `?as=<userId>` and resolves it here — a page-level query
 * parameter, no control rendered anywhere, and the whole affordance is behind
 * `process.env.NODE_ENV !== "production"` at its one call site.
 *
 * REMOVE when the real session lands: the viewer comes from `getSession()`,
 * and `resolveViewer()` plus its call site in `candidates/[id]/page.tsx` both
 * go. Nothing else imports it.
 *
 * The four demonstrable states, on `/candidates/cand_2201`:
 *   (default)          Sadia Karim, RECRUITER    — consolidated results, all
 *                                                  panel feedback, plus her
 *                                                  own form for round 2
 *   ?as=usr_panel_3    Tuhin Chowdhury, PANEL_MEMBER, own draft
 *                                                — BLIND: his own editable
 *                                                  draft and a bare count
 *   ?as=usr_panel_4    Marufa Begum, PANEL_MEMBER, own submitted
 *                                                — locked own record, peers
 *                                                  revealed, no summary
 *   ?as=usr_hm_1       Kamrul Hasan, HIRING_MANAGER
 *                                                — never blinded, and his own
 *                                                  submitted record is locked
 *
 * Phase 5 reuses the same switch for the Decision tab, where the approve/reject
 * action only appears for the viewer whose role the chain is currently blocked
 * on. On `/candidates/cand_2177`:
 *   (default)          Sadia Karim, RECRUITER    — sees the chain, can start
 *                                                  one, cannot decide
 *   ?as=usr_hrl_1      Rowshan Ara, HR_LEADERSHIP
 *                                                — the chain's current step is
 *                                                  hers: approve/reject shown
 *   ?as=usr_panel_1    Farzana Haque, DEPT_HEAD  — her step is already decided,
 *                                                  so no action
 */
export const MOCK_VIEWERS: readonly Viewer[] = [
  { id: "usr_recruiter_1", name: "Sadia Karim", role: "RECRUITER" },
  { id: "usr_panel_3", name: "Tuhin Chowdhury", role: "PANEL_MEMBER" },
  { id: "usr_panel_4", name: "Marufa Begum", role: "PANEL_MEMBER" },
  { id: "usr_hm_1", name: "Kamrul Hasan", role: "HIRING_MANAGER" },
  { id: "usr_hm_4", name: "Nusrat Jahan", role: "HIRING_MANAGER" },
  { id: "usr_panel_1", name: "Farzana Haque", role: "DEPT_HEAD" },
  { id: "usr_hrl_1", name: "Rowshan Ara", role: "HR_LEADERSHIP" },
  { id: "usr_ta_admin_1", name: "Iftekhar Alam", role: "TA_ADMIN" },
];

export function resolveViewer(userId: string | undefined): Viewer | null {
  if (!userId) return null;
  return MOCK_VIEWERS.find((viewer) => viewer.id === userId) ?? null;
}
