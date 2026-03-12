# Requirements Traceability Matrix

Status: Draft
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

## Purpose
Map core requirements to implementation surfaces and verification tests.

## Matrix (Initial Skeleton)
| Requirement ID | Requirement Source | Implementation Surface | Test Evidence |
| --- | --- | --- | --- |
| ATL-001 | `audio-timing-lyrics-project-spec.md` | analysis service + UI audio flow | `xlights-sequencer-control-acceptance-test-matrix.md` |
| XSC-001 | `xlights-sequencer-control-project-spec.md` | API v2 sequence/timing/effects | `xlights-sequencer-control-integration-test-harness.md` |
| APP-001 | `app-assistant/app-assistant-role-and-boundary.md` | unified chat shell, specialist routing, app-wide guidance | app-assistant runtime and routing tests |
| XSC-002 | `designer-dialog/designer-interaction-contract.md` | creative design conversation, proposal shaping, intent handoff | designer runtime and handoff tests |

## Next Step
Expand this matrix with requirement-level IDs from the active project specs and explicit script/test mappings.
