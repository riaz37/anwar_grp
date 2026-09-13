# Agent Demo Question Set (Loom recording)

Verified against live data in Supabase project `jwmcxgacgjgjosxlazuu` on 2026-09-13.
Ask in order — each demonstrates a distinct tool.

## 1. Basic status lookup
> What's the current status of Ceramics Price Recommendation Engine?

Shows `listProjects` (name → id resolution) + `getProjectStatus`.
Expect: AT_RISK, stage BUSINESS_TESTING_UAT, delivery 2026-09-24, milestone
"Schedule review checkpoint" flagged at-risk (due within 3 days).

## 2. Dependencies
> What's blocking Ceramics Price Recommendation Engine, and what does it depend on?

Shows `getProjectDependencies`.
Expect: task "Collect UAT feedback from the pricing committee" depends on
milestone "UAT sign-off," both IN_PROGRESS.

## 3. Portfolio-wide triage
> What's currently flagged across all my projects, ranked by severity?

Shows `listOpenFlags` with no project id — reasons over the whole portfolio.
Expect: Site Safety Incident Classifier (overdue "UAT sign-off" + ownership
gap), Steel Quality Defect Classifier (overdue "Labeled dataset ready"),
Steel Order Backlog Predictor and Contract Clause Extraction Tool
(ownership gaps).

## 4. Ownership / RACI
> Who's accountable for Site Safety Incident Classifier, and are there any ownership gaps?

Shows `getProjectRaci`.
Expect: real ownership-gap flag — "No Consulted or Informed stakeholders
while the project is in BUSINESS_TESTING_UAT."

## 5. Keyword search
> Has anyone flagged UAT sign-off as an issue anywhere?

Shows `searchDocuments`. Note live that this is keyword match, not semantic.
Expect: hits the overdue-milestone flag text on Site Safety Incident
Classifier.

## 6. Action — sends a real email (record last)
> Email the owner and team lead that Ceramics Price Recommendation Engine is at risk pending UAT sign-off.

Shows `notifyProjectStakeholders` — the only write/action tool. Point this
at a project or inbox you're fine sending a real email to before recording.
