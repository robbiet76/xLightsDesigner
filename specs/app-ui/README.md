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
- [page-roles-and-flow.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/page-roles-and-flow.md)
- [implementation-checklist.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/implementation-checklist.md)

## Reference / Migration-Era Material

These remain valuable, but they should not dominate the entry path.

- `electron-legacy-removal-manifest-2026-04-06.md`
- `macos-native-audio-build-package-2026-04-06.md`
- `macos-native-audio-figma-mockup-package-2026-04-06.md`
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-audio-wireframe-review-package-2026-04-06.md`
- `macos-native-audio-wireframes-v1-2026-04-06.md`
- `macos-native-audio-workflow-review-from-electron-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-design-screen-layout-2026-04-06.md`
- `macos-native-design-sequence-review-build-package-2026-04-06.md`
- `macos-native-design-sequence-review-coupled-review-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`
- `macos-native-design-workflow-review-from-electron-2026-04-06.md`
- `macos-native-display-page-2026-04-08.md`
- `macos-native-early-workflow-relationship-2026-04-06.md`
- `macos-native-history-build-package-2026-04-06.md`
- `macos-native-history-relationship-2026-04-06.md`
- `macos-native-history-screen-layout-2026-04-06.md`
- `macos-native-history-workflow-review-from-electron-2026-04-06.md`
- `macos-native-layout-screen-layout-2026-04-06.md`
- `macos-native-layout-tagging-contract-2026-04-07.md`
- `macos-native-layout-workflow-review-from-electron-2026-04-06.md`
- `macos-native-project-layout-build-package-2026-04-06.md`
- `macos-native-project-layout-relationship-2026-04-06.md`
- `macos-native-project-screen-layout-2026-04-06.md`
- `macos-native-project-workflow-review-from-electron-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-review-screen-layout-2026-04-06.md`
- `macos-native-review-workflow-review-from-electron-2026-04-06.md`
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-sequence-screen-layout-2026-04-06.md`
- `macos-native-sequence-workflow-review-from-electron-2026-04-06.md`
- `macos-native-settings-build-package-2026-04-06.md`
- `macos-native-settings-screen-layout-2026-04-06.md`
- `macos-native-visual-system-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`
- `audio-page-redesign-2026-04-06.md`
- `history-and-live-dashboards-plan-2026-03-13.md`
- `history-implementation-checklist.md`
- `end-to-end-audit-2026-03-12.md`

## Current Rule

Electron-specific UI specs are now reference material unless explicitly needed for cleanup or parity work.

The active product shell is the native macOS app under `apps/xlightsdesigner-macos/`.
