# Requirements Traceability Matrix

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

## Purpose
Map core requirements to implementation surfaces and verification tests.

## Matrix
| Requirement ID | Requirement Source | Implementation Surface | Test Evidence |
| --- | --- | --- | --- |
| ATL-001 | `audio-analyst/timing-track-workflow.md` | analysis service + reviewed timing-track flow | timing-track control validation + live reviewed-timing control suite |
| XSC-001 | `sequence-agent/xlights-api.md` | owned API on `49915`, sequence/timing/effects/layout/render-feedback contracts | owned API validation artifact under the active show folder `_xlightsdesigner_api_validation/<run-id>/` + `scripts/sequencer-render-training/runners/run-stage1-coverage-chunked.sh` |
| APP-001 | `app-assistant/app-assistant-role-and-boundary.md` | unified chat shell, specialist routing, app-wide guidance | app-assistant runtime and routing tests |
| UI-001 | `app-ui/app-workspace.md` | application shell, workflow UX, team chat presentation | `swift test --package-path apps/xlightsdesigner-macos` |
| PLAT-001 | `platforms/platform-and-services.md`, `platforms/macos-app.md` | local-first platform boundary and current macOS implementation | `swift test --package-path apps/xlightsdesigner-macos`, app automation script checks |
| XSC-002 | `designer-dialog/designer-interaction-contract.md` | creative design conversation, proposal shaping, intent handoff | `scripts/app/validate-metadata-tag-proposal-flow.mjs`, `scripts/app/run-full-handoff-validation.mjs`, `scripts/app/validate-active-target-sync.mjs` |
| APP-002 | `local-completion-roadmap.md` | app Design -> Sequence -> Review -> History flow with backup/restore and session recovery | `ReviewScreenViewModelTests.swift`, `XLightsSessionViewModelTests.swift`, app package tests |
| REL-001 | `agent-release-quality-gates.md` | app release-gate checklist and current evidence log | `docs/operations/xlightsdesigner-macos-release-runbook.md`, `docs/operations/xlightsdesigner-macos-validation-evidence-log.md` |

## Expansion Areas
This matrix should continue expanding around:
- reviewed timing-track validation
- sequencer timing-fidelity evaluation
- broader designer-to-sequencer handoff scenario coverage
- release-gate evidence for app completion
