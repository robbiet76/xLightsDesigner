# Requirements Traceability Matrix

Status: Draft
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-24

## Purpose
Map core requirements to implementation surfaces and verification tests.

## Matrix (Initial Skeleton)
| Requirement ID | Requirement Source | Implementation Surface | Test Evidence |
| --- | --- | --- | --- |
| ATL-001 | `audio-analyst/timing-track-workflow-implementation-checklist-2026-04-02.md` | analysis service + reviewed timing-track flow | timing-track control validation + live reviewed-timing control suite |
| XSC-001 | `sequence-agent/xlights-2026-06-owned-api-implementation-plan-2026-04-16.md` | owned API on `49915`, sequence/timing/effects/layout/render-feedback contracts | owned API validation artifact in `_xlightsdesigner_api_validation/2026-04-24T01-13-58-788Z/` + `scripts/sequencer-render-training/runners/run-stage1-coverage-chunked.sh` |
| APP-001 | `app-assistant/app-assistant-role-and-boundary.md` | unified chat shell, specialist routing, app-wide guidance | app-assistant runtime and routing tests |
| UI-001 | `app-ui/native-cutover-audit-2026-04-10.md` | native application shell, workflow UX, team chat presentation | `swift test --package-path apps/xlightsdesigner-macos` |
| XSC-002 | `designer-dialog/designer-interaction-contract.md` | creative design conversation, proposal shaping, intent handoff | designer runtime and handoff tests |
| APP-002 | `xlightsdesigner-local-completion-roadmap-2026-04-23.md` | native Design -> Sequence -> Review -> History flow with backup/restore and session recovery | `ReviewScreenViewModelTests.swift`, `XLightsSessionViewModelTests.swift`, native package tests |

## Next Step
Expand this matrix around the current app plan, especially:
- reviewed timing-track validation
- sequencer timing-fidelity evaluation
- designer-to-sequencer handoff validation
- release-gate evidence for native app completion
