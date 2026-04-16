# App UI Specs

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-13

Active specifications for the application UI and end-user workflow experience.

Scope:
- native product shell
- screen-level workflow design
- app architecture boundaries
- legacy Electron cutover and removal planning

## Canonical Entry Points

- [native-cutover-audit-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/native-cutover-audit-2026-04-10.md)
- [native-app-architecture-diagram-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/native-app-architecture-diagram-2026-04-10.md)
- [cross-platform-shell-boundary-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/cross-platform-shell-boundary-2026-04-10.md)
- [hybrid-cloud-learning-and-billing-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/hybrid-cloud-learning-and-billing-2026-04-10.md)
- [electron-main-handler-inventory-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/electron-main-handler-inventory-2026-04-10.md)

## Supporting Active Specs

- [electron-bridge-inventory-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/electron-bridge-inventory-2026-04-10.md)
- [macos-native-migration-phase-plan-2026-04-06.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/macos-native-migration-phase-plan-2026-04-06.md)
- [macos-native-information-architecture-2026-04-06.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/macos-native-information-architecture-2026-04-06.md)
- [macos-native-workflow-contracts-2026-04-06.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/macos-native-workflow-contracts-2026-04-06.md)
- [macos-native-interaction-model-2026-04-06.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/macos-native-interaction-model-2026-04-06.md)
- [macos-native-shared-backend-and-service-boundaries-2026-04-06.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/macos-native-shared-backend-and-service-boundaries-2026-04-06.md)
- [macos-native-xlights-sequence-session-and-render-validation-2026-04-08.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/macos-native-xlights-sequence-session-and-render-validation-2026-04-08.md)

## Reference / Migration-Era Material

These remain useful as supporting documents, but they should not dominate the entry path.

- `electron-legacy-removal-manifest-2026-04-06.md`
- `audio-page-redesign-2026-04-06.md`
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-design-screen-layout-2026-04-06.md`
- `macos-native-design-sequence-review-coupled-review-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`
- `macos-native-display-page-2026-04-08.md`
- `macos-native-early-workflow-relationship-2026-04-06.md`
- `macos-native-history-relationship-2026-04-06.md`
- `macos-native-history-screen-layout-2026-04-06.md`
- `macos-native-layout-screen-layout-2026-04-06.md`
- `macos-native-layout-tagging-contract-2026-04-07.md`
- `macos-native-project-layout-relationship-2026-04-06.md`
- `macos-native-project-screen-layout-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-review-screen-layout-2026-04-06.md`
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-sequence-screen-layout-2026-04-06.md`
- `macos-native-settings-screen-layout-2026-04-06.md`
- `macos-native-visual-system-2026-04-06.md`

## Archived Historical Specs

These are no longer part of the active app-ui path and now live under `specs/archive/app-ui/`.

- [end-to-end-audit-2026-03-12.md](/Users/robterry/Projects/xLightsDesigner/specs/archive/app-ui/end-to-end-audit-2026-03-12.md)
- [history-and-live-dashboards-plan-2026-03-13.md](/Users/robterry/Projects/xLightsDesigner/specs/archive/app-ui/history-and-live-dashboards-plan-2026-03-13.md)
- [history-implementation-checklist.md](/Users/robterry/Projects/xLightsDesigner/specs/archive/app-ui/history-implementation-checklist.md)
- [implementation-checklist.md](/Users/robterry/Projects/xLightsDesigner/specs/archive/app-ui/implementation-checklist.md)
- [page-roles-and-flow.md](/Users/robterry/Projects/xLightsDesigner/specs/archive/app-ui/page-roles-and-flow.md)
- one-time `*-build-package-*` docs
- wireframe / mockup / prototype package docs
- `*-workflow-review-from-electron-*` docs

## Current Rule

Electron-specific UI specs are now reference material unless explicitly needed for cleanup or parity work.

The active product shell is the native macOS app under `apps/xlightsdesigner-macos/`.

## Cleanup Audit

Current cleanup pass and lifecycle classification:

- [app-ui-spec-cleanup-audit-2026-04-16.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/app-ui-spec-cleanup-audit-2026-04-16.md)
