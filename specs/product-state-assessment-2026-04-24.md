# xLightsDesigner Product State Assessment (2026-04-24)

Status: Active Baseline
Date: 2026-04-24
Owner: xLightsDesigner Team

## Purpose

Capture a dated high-level assessment of what xLightsDesigner is building, why it exists, what is already built, what remains, and how mature the current codebase is.

This document is intended as a comparison baseline. Re-run the same assessment prompt after future development cycles to evaluate whether the product is converging toward the intended complete app.

## Assessment Prompt

User prompt captured verbatim:

> Let's pause for  moment and step back to look at the big picture.  There are a lot of components to this application that we have been working on in different phased work approaches.  Looking at the entire app, based on what is built today and what is scoped in specs, please draft a high level summary of what we are building.  Explain why we are doing this, the components of the tool, and the overall intended user experience.  Desrcribe the target state outcome of a complete product and lastly rank order the remaining gaps by size.  Also, provide an overview of the code maturity in the app.  How clean is it?  Is it efficient?  Does it need refactored anywhere? This will help us make sure we are driving in the right direction.

## Big Picture

xLightsDesigner is a native app that acts as the translation layer between AI agents and local xLights sequence files.

The product goal is not only to provide chat access to xLights. The goal is to let a user describe lighting intent in normal creative language, have specialist agents turn that into structured sequencing plans, and then have the local app safely create, validate, apply, render, review, and recover changes in xLights.

The product split is:

- xLights remains the local sequencing engine and source of truth for sequence mutation.
- xLightsDesigner owns project workflow, metadata, agent handoffs, review, safety, and validation.
- Agents own reasoning and translation, eventually through a shared cloud backend.
- Local files and xLights writes stay local.

## What Exists Today

The active app is the native macOS SwiftUI app at `apps/xlightsdesigner-macos`.

Current native workflow surfaces:

- `Project`: app project identity and linked xLights show folder.
- `Display`: layout-derived metadata, app-owned tags, target intent, semantic hints.
- `Audio`: track analysis and library state.
- `Design`: native creative intent authoring.
- `Sequence`: proposal generation and sequencing readiness.
- `Review`: apply gate, backup, render, validation, restore.
- `History`: prior artifacts, proof chains, apply results.
- `Assistant`: unified chat shell with specialist routing.

The owned xLights API in `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner` is substantial. It exposes health, jobs, media, layout, timing, sequence, effects, render, and owned sequencing apply routes.

The app also has validation automation through `scripts/native/automation.mjs` and the native HTTP server. This is now part of the product's development contract: important handoffs should be validated through automation, not only by manual inspection.

## Intended User Experience

The target local user flow is:

1. User creates or opens an xLightsDesigner project.
2. User links exactly one xLights show folder.
3. App inspects the xLights layout and lets the user teach it display meaning.
4. User analyzes or selects audio.
5. User writes creative direction in normal language or native fields.
6. Assistant and specialists translate that into structured design and sequencing intent.
7. Sequence workflow generates a concrete proposal.
8. Review shows what will happen, backs up the sequence, applies through xLights, renders, validates, and records proof.
9. History provides audit and recovery.
10. User iterates until the result works.

The ideal product does not require the user to manually sequence every effect. Manual edits remain possible, but the app should be capable of native design authoring and agent-driven sequence creation.

## Complete Product Target State

For the first local complete product, success means the primary local operator can use the app end to end on a real show:

- one app project linked to one show folder
- display metadata feeds the agents
- native design intent feeds proposal generation
- proposal generation produces real sequence commands
- Review safely applies to xLights through the owned API
- render/readback/proof loop detects whether the result worked
- History and backup/restore make failures recoverable
- automation can validate the critical handoffs without manual inspection

For the distributed product, the target expands:

- packaged and signed native app
- API-enabled xLights install or plugin path
- shared cloud agent backend
- account/profile/preference sync
- centralized learning and retrieval packs
- local xLights writes still remain local

## Remaining Gaps Ranked By Size

1. Shared cloud backend and distribution: largest gap. Auth, accounts, hosted agent execution, sync, model/retrieval pack delivery, packaging, signing, installer/update strategy, billing, and privacy policy are mostly scoped, not built.

2. End-to-end agent quality: large gap. The handoff architecture exists, but the agents still need stronger production behavior: fewer brittle assumptions, better prompt/eval coverage, better design-to-sequencer contract fidelity, and real repeated-use calibration.

3. Sequencing quality/proof loop: large gap. The owned API and proof artifacts exist, but the product still needs reliable "this looks good" iteration, richer render critique, parameter learning, and mature sequence validation that consistently improves second-pass outputs.

4. App UX completeness: medium-large gap. The workflows exist, but many screens are still operational dashboards rather than polished product experiences. The app needs smoother first-run flow, clearer empty states, stronger guided actions, and less developer-facing language.

5. Audio pipeline productization: medium gap. The analysis service works as a dev/service component, but it is still monolithic and operationally awkward. Beat/downbeat/lyrics/provider behavior needs packaging, health, deployment, and user-facing reliability hardening.

6. Spec cleanup and traceability: medium gap. Specs are extensive and useful, but some are stale, archived, or carry older temporary planning terminology. The current roadmap is improving this, but continued cleanup is needed to avoid planning drag.

7. Code refactoring: medium gap. The app is clean enough to continue building, but some orchestration classes are becoming too large and should be split before more features pile on.

## Code Maturity

Overall maturity: moderate, improving quickly.

Current strengths:

- Native app has clear workflow boundaries.
- Services are split better than the old Electron path.
- Tests are meaningful; as of this assessment, the native suite has 45 passing tests.
- Validation automation is real and should remain part of every handoff change.
- The owned xLights API is organized by handler/service/model/transport layers.
- App metadata is correctly separated from xLights show folders.

Main code concerns:

- `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/AppModel.swift` is carrying too much orchestration.
- `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/NativeAutomationServer.swift` is large and should eventually split route handling by workflow.
- `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/DisplayScreenViewModel.swift` and `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/SequenceScreenViewModel.swift` are feature-rich but approaching refactor pressure.
- `apps/xlightsdesigner-analysis-service/main.py` is a working prototype monolith and should be modularized before it becomes core product infrastructure.
- Some native services still parse artifact JSON dynamically. This is pragmatic now, but typed artifact contracts will matter as the app stabilizes.

Efficiency is acceptable for local development. The bigger risk is not raw performance yet; it is maintainability, contract clarity, and avoiding hidden behavior across agent, artifact, and automation boundaries.

## Recommended Direction

The direction is sound. The priority should remain a single local end-to-end operator workflow before expanding cloud and distribution work.

Near-term priorities:

1. Validate assistant-originated handoffs through automation, not just direct route calls.
2. Make Display/app metadata visibly influence actual sequence proposal choices.
3. Run a full Project -> Display -> Design -> Sequence -> Review -> History proof with the API-enabled xLights build.
4. Refactor only where it reduces immediate risk: automation route splitting, artifact contract typing, and oversized view-model orchestration.
5. Keep cleaning specs as touched, especially anything that implies old Electron, legacy transaction, or temporary phase plans are still active.
