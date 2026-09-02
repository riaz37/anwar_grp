# TODOs — Anwar TalentFlow

Deferred items surfaced during /plan-eng-review of the assignment spec
(2026-09-02). Each item was deliberately deferred, not forgotten — see
"Depends on" for the trigger condition that should bring it back.

## Dashboard materialized rollup tables

**What:** A scheduled background job precomputes dashboard aggregates
(open requisitions, recruiter workload, stage ageing, feedback delays,
overdue tasks) into summary tables that the Recruiter/TA-Head/Dept-Head
dashboards (Sec 8) read from, instead of running live aggregation queries.

**Why:** Live, properly indexed queries are cheap at MVP scale (a single
company's pipeline — hundreds to low thousands of open applications) and
avoid the staleness + "silent rollup job failure" risk a precompute
pipeline introduces. This becomes worth building only once real usage
shows live queries are measurably slow.

**Pros:** Faster dashboard reads at scale; decouples read latency from
write-path table size.

**Cons:** Dashboard numbers lag the job's schedule; a failed rollup job
can silently show stale data with no obvious indication; one more moving
part to operate and monitor.

**Context:** Chosen over building this from day one during the eng review
of the assignment spec — see the Performance review section ("Dashboard
queries") for the full tradeoff. Not a hypothetical: revisit as soon as
production telemetry shows dashboard query latency is a real user-facing
problem, not before.

**Depends on / blocked by:** Production usage data (query latency
measurements) showing live queries are actually slow. Until then, keep
the live-query + index approach.
