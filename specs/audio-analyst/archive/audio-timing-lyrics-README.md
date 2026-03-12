# Audio Timing + Lyrics Project

Status: Active
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

Phase 1 standalone project for xLights automation, covering:
- audio timing analysis,
- bars/downbeats + energy sections,
- song structure detection,
- lyric track generation/import.

This project is a focused subproject under the broader program contract:
- `xlights-sequencer-control-project-spec.md` (full sequencer control scope and autonomy requirements).

## Files
- `audio-timing-lyrics-project-spec.md`: source-of-truth specification (scope, API contract, requirements, tests).
- `audio-timing-lyrics-api-contract.md`: detailed endpoint-by-endpoint contract (schemas, status codes, validation, idempotency).
- `audio-timing-lyrics-implementation-checklist.md`: maintainer-ready build checklist with acceptance tests per endpoint.
- `audio-timing-lyrics-decision-log.md`: locked implementation decisions and defaults to reduce PR churn.

Archived:
- Historical PR/task-step planning documents have moved to `specs/archive/`.
