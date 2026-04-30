# xLightsDesigner Product State Assessment (2026-04-30)

Status: Active Baseline
Date: 2026-04-30
Owner: xLightsDesigner Team

## Purpose

Capture a dated high-level assessment of what xLightsDesigner is building, why it exists, what exists today, what remains, and how mature the current codebase is.

This document is a follow-up to `product-state-assessment-2026-04-24.md`. It preserves the same big-picture review shape while reflecting the current 2026.07 owned API work, custom model capture direction, and the need to consolidate specs and training assets before more training expansion.

## Assessment Prompt

User prompt captured verbatim:

> Let's pause for  moment and step back to look at the big picture.  There are a lot of components to this application that we have been working on in different phased work approaches.  Looking at the entire app, based on what is built today and what is scoped in specs, please draft a high level summary of what we are building.  Explain why we are doing this, the components of the tool, and the overall intended user experience.  Describe the target state outcome of a complete product and lastly rank order the remaining gaps by size.  Also, provide an overview of the code maturity in the app.  How clean is it?  Is it efficient?  Does it need refactored anywhere? This will help us make sure we are driving in the right direction.

## High-Level Product Summary

xLightsDesigner is a native macOS companion app for xLights. Its purpose is to let a user move from creative intent to real xLights sequence changes without manually building every effect, while keeping xLights as the local rendering and sequencing engine.

The product is not just "AI chat for xLights." It is a local translation layer that understands the user's project, show folder, layout, model metadata, audio structure, design intent, existing sequence state, and xLights API capabilities. The app should help the user describe what they want, generate a concrete sequencing proposal, safely apply it through xLights, render and validate the result, and keep enough history to recover or iterate.

The current direction is still sound.

## Why We Are Building This

Manual xLights sequencing takes a lot of time because the user has to translate creative ideas into target choices, timing, effects, layers, parameters, and revision passes. xLightsDesigner is meant to absorb much of that translation work.

The core value is:

- understand the user's display, including custom models and user-authored metadata
- understand the music structure and timing
- convert design language into practical xLights effect and layer commands
- apply changes safely through an owned xLights API
- render and inspect results so iteration is evidence-based
- preserve project metadata and history so the app gets better for a mature display over time

The important user-experience principle is that the user should teach the app their display once, then reuse that understanding across many sequences and revisions.

## Major Components

### Native macOS App

Active product shell: `apps/xlightsdesigner-macos`.

Main workflow screens are Project, Display, Audio, Design, Sequence, Review, History, plus Assistant and Settings. This is now the canonical app shell. Electron is no longer the product path.

### Owned xLights API

Active xLights integration lives in `/Users/robterry/xLights-2026.07/src-ui-wx/xLightsDesigner`.

It exposes owned routes for health, media/show folder, layout, model data, sequence open/create/save, timing, effects, render, jobs, and sequencing apply. The recent show-folder switching route is a key piece because the app can now tell xLights to switch to the project's linked show folder cleanly instead of relying on launch state or manual setup.

### Project And Display Metadata

App-owned project metadata stays under the xLightsDesigner project folder, not inside the show folder. Display metadata is tied to layout fingerprints and target IDs so user work survives show-folder refreshes and layout changes where possible.

This is strategically important. Mature display metadata is expensive user work, so the app should preserve it unless the user explicitly deletes it.

### Custom Model Understanding

Custom models are becoming a first-class display-understanding area. The app captures custom model structure, node layout, construction signals, and submodels so custom props are not treated as anonymous blobs.

Recent work moved custom model capture toward live xLights API data through `layout.getModelNodes`, which is the right direction. File parsing can remain useful for fixtures, but the product should rely on the API where possible.

### Audio Analysis

The analysis service in `apps/xlightsdesigner-analysis-service` provides beats, bars, sections, lyrics and identity where available, and timing-track support.

Product-wise, this becomes the timing substrate for sequencing. The user should not have to manually build every structure or phrase timing track before the app can make useful choices.

### Designer Dialog And Assistant Layer

The assistant is the unified conversational shell. Specialist domains include audio analyst, designer dialog, and sequence agent. The app assistant should coordinate workflows and ask for approval where needed, but domain logic should stay in specialist runtimes.

### Sequence Agent

The sequence agent turns structured design intent and metadata into concrete xLights command plans. It handles target resolution, effect selection, timing placement, layer decisions, existing-sequence preservation, and revision planning.

### Review, Apply, Render, And History

Review is the safety gate. It should show what will happen, create backups, apply through the owned API, render, validate and read back, and record proof artifacts. History should let the user inspect prior passes, diagnose instability, and recover.

### Training And Learning Assets

The repo has generated effect knowledge, layer-composition priors, parameter priors, render-training scripts, and benchmark runners. This is becoming the knowledge layer behind better sequencing choices.

Before additional training expansion, the current learnings should be captured and the generated bundles should be cleaned up into a consolidated, organized training layer. Cleanup should go beyond deleting unneeded files: it should reduce redundancy, preserve durable learning, and make the training assets easier to reason about.

## Intended User Experience

The complete local flow should feel like this:

1. User creates or opens an xLightsDesigner project.
2. User links one xLights show folder.
3. App launches or connects to the API-enabled xLights build and ensures xLights is open to that show folder.
4. App discovers the layout, models, groups, submodels, custom model structure, and target IDs.
5. User reviews or teaches display meaning: arches, rooflines, mega tree, matrices, canes, faces, focal elements, avoidances, and intent tags.
6. User selects audio and gets reviewed timing structure.
7. User writes creative direction in normal language or native Design fields.
8. Sequence generates a proposal using audio, display metadata, custom model understanding, current sequence state, and trained effect knowledge.
9. Review shows the concrete plan, creates a backup, applies via owned xLights API, renders, validates, and stores proof.
10. User accepts, revises, restores, or asks for another pass.
11. History keeps the project's sequence design trail understandable and recoverable.

Target experience: the app should behave like a senior sequencing assistant that knows the user's display and works safely inside their local xLights environment.

## Complete Product Target State

For the first complete local product, success means:

- native app is the only active shell
- one project links to one show folder
- show-folder switching is reliable and refreshes app state
- display metadata persists per project and survives layout refreshes
- custom models are understood enough for useful sequencing decisions
- audio and timing analysis feed real sequence planning
- design intent produces real xLights sequence commands
- existing sequence contents are preserved unless replacement is explicit
- Review applies safely with backup, render, validation, and restore
- History provides useful proof and recovery
- automation validates the critical Project -> Display -> Audio -> Design -> Sequence -> Review -> History path

For the later distributed product, the target expands to:

- signed packaged macOS app
- installed or bundled API-enabled xLights path
- shared cloud agent backend
- user, account, billing, and provider configuration
- centrally updated training and retrieval assets
- local show files still remain local

## Remaining Gaps Ranked By Size

1. **Sequencing quality at full-display/full-song scale**: Largest practical gap. The architecture can plan and apply, but the product still needs stronger output quality, more effects, better parameter choices, better layer composition, and repeated proof-loop calibration on real sequences.

2. **End-to-end native workflow hardening**: The path exists, but it still needs more real operator passes through Project -> Display -> Audio -> Design -> Sequence -> Review -> History. The app needs fewer developer-facing rough edges, clearer blocking states, and stronger recovery flows.

3. **Display understanding depth**: Metadata, target intent, tags, submodels, and custom model capture are in motion, but this needs to mature into a dependable framework. Custom models are especially important because a lot of real displays rely on imported, vendor, or user-built models.

4. **Render critique and revision intelligence**: The app can render and collect proof, but "did this look good?" is still immature. The next level is useful visual critique, scoped revision suggestions, and feedback memory that improves later passes.

5. **Audio analysis productization**: The service is functional but still feels like a development service. Packaging, provider reliability, health handling, timing review UX, and deployment shape need hardening.

6. **Native UX polish**: The app has the right screens, but some areas still read as workflow dashboards rather than a finished product. First-run setup, empty states, guided actions, assistant/action approval, and display metadata editing need product polish.

7. **Cloud/shared backend and distribution**: Large in absolute terms, but not the immediate local-product blocker. Auth, billing, hosted agents, sync, packaging, signing, updates, and privacy model remain mostly future-state.

8. **Spec and training asset cleanup**: Specs are useful but numerous. There are many active and archived specs, plus generated training bundles and reports. Continued cleanup is needed so stale planning language and redundant training records do not steer implementation or obscure the durable learning layer.

## Code Maturity

Overall maturity: moderate and improving.

The codebase is past prototype-only status in several areas. There is real automation, meaningful tests, owned xLights API integration, native app structure, project metadata persistence, sequence proposal/apply flows, and render/proof concepts.

Current strengths:

- native shell direction is clear
- xLights API ownership is much cleaner than the old automation path
- tests are broad for JS runtime behavior and growing for Swift view models
- project and display metadata are correctly separated from xLights show folders
- sequence-agent runtime has strong contract and test coverage compared to its complexity
- recent custom model work is moving toward the correct API-backed source of truth

Main maturity concerns:

- `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/NativeAutomationServer.swift` is large and should eventually split by route or workflow.
- `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/DisplayScreenViewModel.swift` and `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/SequenceScreenViewModel.swift` are feature-rich and approaching refactor pressure.
- `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/AppModel.swift` still carries broad orchestration responsibility.
- `apps/xlightsdesigner-analysis-service/main.py` is still a service monolith and should be modularized before audio becomes core production infrastructure.
- `apps/xlightsdesigner-ui/app.js` remains large, though less central than before.
- generated training bundles are huge, which is acceptable, but runtime loaders should remain stable so generated data does not leak complexity into product code.
- the xLights API host header is also large. That is understandable because it bridges into xLights internals, but it will need careful discipline as more layout and model mutation routes are added.

Efficiency is acceptable right now. The bigger risk is not performance. The bigger risk is accumulating too much orchestration in a few files and too many implicit contracts between native app, JS runtimes, scripts, artifacts, and xLights API routes.

## Recommended Direction

Stay focused on the local complete product before cloud and distribution.

The most valuable next work is:

1. Finish the custom model understanding framework: capture node layout, submodels, construction classification, and use it in sequencing decisions.
2. Make show-folder switching and layout refresh a first-class native workflow, including metadata reconciliation when the layout changes.
3. Capture learnings from completed training runs before starting more training expansion.
4. Clean up generated training bundles into consolidated, durable, non-redundant training assets.
5. Run more full native handoff validations against the 2026.07 API build and vendor/custom-model layout.
6. Improve sequence quality through broader effects and layer-composition training, but keep each training addition tied to visible sequencing outcomes.
7. Refactor only where it reduces immediate risk: native automation routing, oversized view models, audio service modularity, and typed artifact contracts.

The direction is right. The product is converging from many experimental components into a coherent local sequencing assistant. The next challenge is less about inventing new architecture and more about making the full path reliable, understandable, maintainable, and good enough that a real user can trust it on a real show.

## Cleanup Direction Added After Review

The next execution slices should include spec and training cleanup as part of the work, not as a separate future chore.

Spec cleanup should:

- consolidate active specs when multiple docs describe the same current contract
- archive or demote stale phase plans after their durable decisions are captured
- remove old Electron, transaction, or fallback-path language when encountered
- keep root/domain README files aligned with the true canonical path
- favor shorter durable contracts over long chronological planning records

Training cleanup should:

- capture durable learnings from completed render-training and layer-composition runs
- separate generated bundles from curated, human-readable training summaries
- reduce redundant records across generated priors, reports, and specs
- define the stable runtime consumption layer for trained knowledge
- clean bundle generation so future runs produce organized, explainable outputs
- delay major new training expansion until the current learning layer is consolidated
