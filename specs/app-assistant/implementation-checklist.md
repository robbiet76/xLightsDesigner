# App Assistant Implementation Checklist

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-12

Purpose: implement the unified conversational shell above specialist agents without collapsing their boundaries.

Reference:
- [workflow-phase-model-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-assistant/workflow-phase-model-2026-04-10.md)

## Phase A: Role And Contracts
- [x] Define `app_assistant` role and delegation boundary
- [x] Define app-assistant session/context contract
- [x] Define specialist routing result contract
- [x] Define action-request contract for bounded app-level actions
- [x] Define team-chat identity contract:
  - canonical role id
  - display name
  - optional nickname
  - handled-by / routed-by metadata

## Phase B: Session And Routing
- [x] Add app-assistant runtime/orchestrator
- [ ] Add explicit workflow phase state model spanning setup, mission, analysis, display, design, sequencing, and review
- [x] Add specialist-routing rules for:
  - setup/help
  - `audio_analyst`
  - `designer_dialog`
  - `sequence_agent`
- [ ] Add explicit routing + normalization rules for direct technical sequencing requests:
  - route to `sequence_agent`
  - bypass designer-only proposal scaffolding
  - still emit canonical `intent_handoff_v1`
- [x] Add tests that prove the user does not need to switch agents manually
- [x] Add routing rules that treat direct specialist address as a hint, not a hard dispatch
- [x] Add tests for nickname and direct-address routing overrides

## Phase C: UI Integration
- [x] Make the main chat panel owned by `app_assistant`
- [x] Preserve visible specialist context when work is delegated
- [ ] Surface structured artifacts produced by specialists in the shared chat flow
- [x] Show visible speaker identity for delegated specialist responses
- [x] Add optional user-defined specialist nicknames in the chat UI

## Phase D: Training And Diagnostics
- [ ] Add `app_assistant` training/package assets
- [ ] Add few-shot/eval coverage for cross-phase conversations
- [ ] Add structured diagnostics for routing and specialist delegation

## Exit Gate
- The user experiences one coherent chat across the app.
- Specialist boundaries remain explicit in runtime and artifacts.
