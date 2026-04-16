# Requirements Traceability Matrix

Status: Draft
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-05

## Purpose
Map core requirements to implementation surfaces and verification tests.

## Matrix (Initial Skeleton)
| Requirement ID | Requirement Source | Implementation Surface | Test Evidence |
| --- | --- | --- | --- |
| ATL-001 | `audio-analyst/timing-track-workflow-implementation-checklist-2026-04-02.md` | analysis service + reviewed timing-track flow | timing-track control validation + live reviewed-timing control suite |
| XSC-001 | `sequence-agent/xlights-2026-06-api-migration-plan-2026-04-16.md` | owned API on `49915`, sequence/timing/effects/layout contracts | `apps/xlightsdesigner-ui/tests/api.test.js` + `scripts/sequencer-render-training/runners/run-stage1-coverage-chunked.sh` |
| APP-001 | `app-assistant/app-assistant-role-and-boundary.md` | unified chat shell, specialist routing, app-wide guidance | app-assistant runtime and routing tests |
| UI-001 | `app-ui/native-cutover-audit-2026-04-10.md` | native application shell, workflow UX, team chat presentation | native app smoke tests + future UI integration tests |
| XSC-002 | `designer-dialog/designer-interaction-contract.md` | creative design conversation, proposal shaping, intent handoff | designer runtime and handoff tests |

## Next Step
Expand this matrix around the current app plan, especially:
- reviewed timing-track validation
- sequencer timing-fidelity evaluation
- designer-to-sequencer handoff validation
