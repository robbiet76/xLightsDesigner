# Product State Assessment - 2026-04-30

Status: Archived
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Date: 2026-04-30

## Big Picture

xLightsDesigner is becoming a workflow product for producing xLights sequences from user intent, display knowledge, music analysis, trained effect knowledge, and local render validation.

The target experience is a user-directed creative assistant that understands the user's display well enough to plan safely, apply changes through xLights, validate the rendered result, and improve over time without forcing the user to rebuild hard-won display metadata or training context.

## What Exists Today

- macOS app shell with project, design, sequence, review, history, and settings concepts.
- Local project storage model.
- xLights owned API for show-folder switching, layout discovery, sequence lifecycle, timing, effects, render feedback, and validation.
- Display metadata and model metadata direction, including stable target identity by fingerprint.
- Custom model capture direction through the API rather than direct layout-file parsing.
- Sequence-agent planning code, trained effect knowledge bundles, and validation tests.
- Render-training tooling, compacted promoted records, semantic record packs, proof fixtures, and generated runtime bundles.
- Specs for audio analysis, designer interaction, sequence planning, app shell behavior, and release gates.

## Intended User Experience

1. Open the app and select or create a project.
2. Select the xLights show folder and sequence.
3. The app refreshes layout, model metadata, custom model construction data, timing, and current sequence state.
4. The user describes creative goals in conversation.
5. The app uses audio analysis, display metadata, preferences, and trained effect knowledge to propose sequence changes.
6. The user reviews concrete commands, affected models, warnings, and backup status.
7. Approved changes are applied through the xLights API.
8. The app renders and validates the result, then stores proof and history.
9. Mature display metadata persists with the project and follows explicit project migration.

## Target State

The complete product should be able to produce credible full-song, full-display sequences while preserving user control:

- robust project and show-folder lifecycle
- reusable display metadata per project
- reliable custom model understanding
- music-aware timing and phrase planning
- effect choices grounded in render-tested semantics
- layer planning and revision planning that preserve existing sequence work unless replacement is explicit
- safe apply, backup, restore, and history
- clear local/cloud boundary for future learning and billing
- compact specs and training data that remain understandable over time

## Remaining Gaps By Size

1. Full-display/full-song sequencing quality: effect choice, composition, pacing, and large-scale review still need more training and proof.
2. Custom model understanding: capture is underway, but the agent still needs durable construction, node order, submodel, geometry, and semantic interpretation.
3. Display metadata maturity: the project metadata model needs polished migration, user editing, retention, and review flows.
4. App hardening: project state, session recovery, history, backup/restore, and apply/render UX need continued validation.
5. Training knowledge consolidation: generated records are compacted, but runtime bundles and dated evidence docs should stay under pressure.
6. Audio-to-sequence quality: timing tracks exist conceptually, but richer musical context must drive sequence decisions more directly.
7. Release readiness: quality gates exist, but the app still needs repeatable end-to-end validation on real show folders.

## Code Maturity

The codebase has useful structure and increasingly solid boundaries, especially around the sequence-agent runtime and render-training tooling. Recent cleanup reduced generated-data sprawl and moved toward packed artifacts.

The main maturity risk is not isolated messy code; it is product surface area. The app spans app UI, local services, xLights API work, agent planning, generated training data, and proof harnesses. That creates drift unless specs and generated artifacts stay compact.

Current refactor pressure:

- keep sequence-agent generated knowledge loading efficient
- keep xLights API behavior explicit and tested
- avoid reintroducing direct layout-file parsing where API capture is the intended path
- keep app state ownership clear
- continue replacing dated implementation plans with durable contracts
