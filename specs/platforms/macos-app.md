# macOS App

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

## Purpose

Define the current macOS implementation boundary for xLightsDesigner.

## Current Role

The macOS SwiftUI app in `apps/xlightsdesigner-macos/` is the active product surface. It implements the app workspace contract from `../app-ui/app-workspace.md` and the platform-neutral service boundary from `platform-and-services.md`.

## macOS-Owned Responsibilities

- SwiftUI application entry point, windows, navigation, and views.
- macOS file and folder selection.
- Local app automation server on the app automation port.
- Launch-time loading of project, display, audio, design, sequence, review, history, settings, and xLights session state.
- User-visible orchestration of local scripts and owned xLights API calls.
- macOS package tests and release validation evidence.

## Not macOS-Owned

- Durable project or display metadata schemas.
- Sequence planning, effect semantics, or xLights command generation.
- Audio analysis logic beyond invoking shared services.
- Training/proof artifact truth.
- Cross-platform app workflow rules.

## Source Boundaries

- macOS app source: `../../apps/xlightsdesigner-macos/`
- Shared agent/runtime modules: `../../apps/xlightsdesigner-ui/`
- App automation scripts: `../../scripts/app/`
- Assistant scripts: `../../scripts/assistant/app/`
- Audio scripts: `../../scripts/audio-analysis/app/`
- Designer scripts: `../../scripts/designer/app/`
- Sequencing scripts: `../../scripts/sequencing/app/`

## Validation

Required package-level validation:

```bash
swift test --package-path apps/xlightsdesigner-macos
```

Current release evidence is tracked in `../../docs/operations/xlightsdesigner-macos-validation-evidence-log.md`.

## Future Platform Notes

Future Windows or Linux app implementations should create sibling specs in this directory and reuse the same app workspace, project storage, local service, xLights API, and sequencing contracts.
