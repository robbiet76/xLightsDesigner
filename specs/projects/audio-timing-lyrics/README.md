# Audio Timing + Lyrics Project

Phase 1 standalone project for xLights automation, covering:
- audio timing analysis,
- bars/downbeats + energy sections,
- song structure detection,
- lyric track generation/import.

## Files
- `project-spec.md`: source-of-truth specification (scope, API contract, requirements, tests).
- `implementation-plan.md`: phased delivery plan and rollout sequence.
- `api-contract.md`: detailed endpoint-by-endpoint contract (schemas, status codes, validation, idempotency).
- `xlights-endpoint-implementation-mapping.md`: Step 3 endpoint-to-code mapping, missing pieces, and build priority.
- `implementation-checklist.md`: maintainer-ready build checklist with acceptance tests per endpoint.
- `pr1-task-breakdown.md`: file-level PR-1 execution plan (v2 envelope + discovery endpoints).
- `pr2-task-breakdown.md`: file-level PR-2 execution plan (timing generation + summaries + derived tracks).
- `pr3-task-breakdown.md`: file-level PR-3 execution plan (lyrics text and SRT automation endpoints).
- `decision-log.md`: locked implementation decisions and defaults to reduce PR churn.
