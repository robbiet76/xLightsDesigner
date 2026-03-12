# App UI/UX Implementation Checklist

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-12

Purpose: turn the current functional shell into a coherent end-user experience that matches the real project workflow and the new team-chat model.

## Phase A: Information Architecture
- [x] Lock the canonical top-level workflow phases
- [x] Decide final screen model for:
  - `Project`
  - `Audio`
  - `Sequence`
  - `Design`
  - `Review`
  - `Metadata`
  - `History`
- [x] Use `Audio` as the user-facing label for audio-analysis workflow
- [x] Move `Audio` ahead of `Sequence` in the primary nav/workflow
- [x] Fold `Inspiration` into `Design`
- [x] Keep `History` as the final top-level screen
- [ ] Remove or merge screens whose responsibilities are unclear
- [ ] Define the primary user journey from project setup through apply

## Phase B: Team Chat UX
- [x] Turn the current right-side coach panel into an explicit team-chat panel
- [x] Keep visible specialist identity polished and consistent
- [x] Show routed delegation clearly when `app_assistant` overrides a named addressee
- [x] Add inline artifact cards/messages in chat
- [ ] Ensure chat works naturally across:
  - setup
  - analysis
  - design
  - sequencing review/apply

## Phase C: Artifact Surfaces
- [x] Add visible summary surfaces for `analysis_artifact_v1`
- [x] Add visible summary surfaces for `creative_brief_v1`
- [x] Add visible summary surfaces for `proposal_bundle_v1`
- [x] Add visible summary surfaces for sequence plan/apply outcomes
- [x] Make artifact state inspectable without exposing raw internal payloads by default

## Phase D: Review And Apply UX
- [x] Clarify the difference between design iteration and execution review
- [x] Make stale/rebase/apply state more legible
- [x] Keep the approval gate prominent and understandable
- [x] Improve backup/restore visibility
- [x] Make the proposal-to-apply transition feel like a deliberate workflow step

## Phase E: Settings And Diagnostics
- [x] Separate user-facing settings from operator/developer diagnostics
- [x] Reduce settings drawer overload
- [x] Decide whether diagnostics stays in the footer or moves to a dedicated screen/panel
- [x] Keep health information available without dominating normal workflow
- [x] Add an app-level fresh-install reset for brand-new-user testing

## Phase F: UI Runtime Structure
- [x] Add an `app-ui` runtime/render domain under `apps/xlightsdesigner-ui`
- [x] Extract shell rendering from `app.js`
- [x] Extract chat rendering/binding from `app.js`
- [x] Extract settings/diagnostics rendering from `app.js`
- [x] Extract screen-specific event binding from `app.js`

## Exit Gate
- The app tells a clear workflow story from setup to apply.
- Team chat feels like the core collaboration surface, not a bolted-on sidebar.
- Specialist artifacts are visible and understandable in the UI.
- Settings and diagnostics are available but not in the way of normal use.
- `app.js` is no longer the de facto UI architecture.
