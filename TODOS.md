# TODOs — Anwar AI ProjectFlow

Reset 2026-09-03 when the assignment pivoted from Anwar TalentFlow (recruitment
ATS) to Anwar AI ProjectFlow (project governance). The prior TODOs list was
entirely TalentFlow-domain (dashboard rollups, evaluation/joining field
reconciliation) and no longer applies — see git history if any of that
reasoning is ever relevant again.

Two items already inherited from the prior review and re-confirmed for the
new domain (see BUILD_PLAN.md Sec 3 and 6):

## Materialized dashboard rollup tables — still deferred

Same call as before, re-applied to the new Management Dashboard: live
indexed queries now, materialized rollups only once production usage shows
they're actually slow. Not worth building for assignment/MVP scale.

## Full UI test coverage — known, accepted gap

Vitest covers stage-gate transition logic, health computation, delay-reason
enforcement, and RBAC (the highest-risk pure-logic code) plus API
integration tests for the prototype journey. Full UI test coverage is out of
reach in the assignment timeframe — flagged, not silently skipped.
