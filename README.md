# xLightsDesigner

xLightsDesigner is a local-first creative sequencing tool for xLights.

The product turns user creative intent into auditable xLights sequence changes by combining project context, display metadata, audio analysis, trained effect knowledge, review/apply safety, and render validation.

## Product Shape

The active product shell is the macOS app in `apps/xlightsdesigner-macos/`.

Core workflow:

1. Select or create a project.
2. Bind the project to a show folder, sequence, media file, and display layout.
3. Refresh display metadata, model metadata, custom model construction data, timing data, and sequence state.
4. Capture creative intent through the designer workflow.
5. Generate structured sequence plans through the sequence agent.
6. Review commands, warnings, backups, and validation status.
7. Apply approved changes through the owned xLights API.
8. Render, validate, and store recoverable history.

## Repository Structure

- `apps/`: runtime applications and services.
- `apps/xlightsdesigner-macos/`: active macOS SwiftUI product shell.
- `apps/xlightsdesigner-ui/`: shared JS agent, runtime, page-state, eval, and test modules.
- `apps/xlightsdesigner-analysis-service/`: audio analysis service.
- `training-packages/`: portable LLM training assets.
- `specs/`: durable product, domain, governance, and verification specs.
- `docs/`: architecture and operational reference material.
- `scripts/`: developer automation, generation, validation, and training tooling.

## Primary References

- Product plan: `specs/product-plan.md`
- Local roadmap: `specs/local-completion-roadmap.md`
- Spec and repo governance: `specs/spec-governance.md`
- App contract: `specs/app-ui/app-workspace.md`
- Project storage contract: `specs/app-ui/project-storage.md`
- Platform boundary: `specs/platforms/platform-and-services.md`
- macOS app boundary: `specs/platforms/macos-app.md`
- xLights API contract: `specs/sequence-agent/xlights-api.md`
- Sequencing system: `specs/sequence-agent/sequencing-system.md`
- Render-training knowledge: `specs/sequence-agent/render-training-knowledge.md`
- Training package root: `training-packages/training-package-v1/README.md`

## Run The macOS App

Open `apps/xlightsdesigner-macos/Package.swift` in Xcode, or run:

```bash
cd apps/xlightsdesigner-macos
swift run
```

The retired desktop prototype shell has been removed. Do not add new product-shell work outside the app.

## Shared JS Runtime

`apps/xlightsdesigner-ui/` remains important for shared agent/runtime/page-state code, tests, and tooling integration. It is not the active product shell.

Active work there should stay focused on reusable domain/runtime behavior, especially:

- app assistant routing
- designer handoff logic
- sequence-agent planning and validation
- xLights API integration helpers
- render-training bundle consumption
- app page-state composition

## Validation

macOS app package tests:

```bash
swift test --package-path apps/xlightsdesigner-macos
```

App-to-xLights handoff validation:

```bash
node scripts/app/run-full-handoff-validation.mjs
```

Broader handoff matrix:

```bash
node scripts/app/run-full-handoff-validation.mjs --matrix
```

Focused sequence-agent tests:

```bash
node --test apps/xlightsdesigner-ui/tests/agent/sequence-agent
```

Render-training catalog and bundle tooling lives under:

```text
scripts/sequencer-render-training/
```

## Development Rules

- Keep one canonical app source tree.
- Keep one canonical xLights source tree.
- Keep one canonical app state root.
- Store xLightsDesigner metadata under the app-owned project root, not in the xLights show folder.
- Use the owned xLights API for show-folder, layout, timing, sequence, effect, and render-feedback operations.
- Treat generated artifacts as rebuildable unless explicitly promoted into a compact durable knowledge layer.
- Consolidate dated implementation notes into durable specs and remove superseded files.
