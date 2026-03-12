# App Assistant Implementation Checklist

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-12

Purpose: implement the unified conversational shell above specialist agents without collapsing their boundaries.

## Phase A: Role And Contracts
- [ ] Define `app_assistant` role and delegation boundary
- [ ] Define app-assistant session/context contract
- [ ] Define specialist routing result contract
- [ ] Define action-request contract for bounded app-level actions

## Phase B: Session And Routing
- [ ] Add app-assistant runtime/orchestrator
- [ ] Add conversation state model spanning setup, analysis, design, and sequencing
- [ ] Add specialist-routing rules for:
  - setup/help
  - `audio_analyst`
  - `designer_dialog`
  - `sequence_agent`
- [ ] Add tests that prove the user does not need to switch agents manually

## Phase C: UI Integration
- [ ] Make the main chat panel owned by `app_assistant`
- [ ] Preserve visible specialist context when work is delegated
- [ ] Surface structured artifacts produced by specialists in the shared chat flow

## Phase D: Training And Diagnostics
- [ ] Add `app_assistant` training/package assets
- [ ] Add few-shot/eval coverage for cross-phase conversations
- [ ] Add structured diagnostics for routing and specialist delegation

## Exit Gate
- The user experiences one coherent chat across the app.
- Specialist boundaries remain explicit in runtime and artifacts.
