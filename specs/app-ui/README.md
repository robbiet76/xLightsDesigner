# App UI Specs

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-05

Active specifications for the application UI and end-user workflow experience.

Scope:
- information architecture
- screen-level workflow design
- team chat presentation
- artifact visibility and review UX
- shared app-shell behavior above specialist agents

Active Entry Points:
- `native-cutover-audit-2026-04-10.md`
- `electron-bridge-inventory-2026-04-10.md`
- `electron-main-handler-inventory-2026-04-10.md`
- `native-app-architecture-diagram-2026-04-10.md`
- `macos-native-migration-phase-plan-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-audio-workflow-review-from-electron-2026-04-06.md`
- `macos-native-audio-build-package-2026-04-06.md`
- `macos-native-project-screen-layout-2026-04-06.md`
- `macos-native-project-workflow-review-from-electron-2026-04-06.md`
- `macos-native-layout-workflow-review-from-electron-2026-04-06.md`
- `macos-native-design-workflow-review-from-electron-2026-04-06.md`
- `macos-native-sequence-workflow-review-from-electron-2026-04-06.md`
- `macos-native-review-workflow-review-from-electron-2026-04-06.md`
- `macos-native-history-workflow-review-from-electron-2026-04-06.md`
- `macos-native-project-layout-relationship-2026-04-06.md`
- `macos-native-project-layout-build-package-2026-04-06.md`
- `macos-native-early-workflow-relationship-2026-04-06.md`
- `macos-native-design-sequence-review-coupled-review-2026-04-06.md`
- `macos-native-design-sequence-review-build-package-2026-04-06.md`
- `macos-native-history-relationship-2026-04-06.md`
- `macos-native-history-build-package-2026-04-06.md`
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-sequence-screen-layout-2026-04-06.md`
- `macos-native-design-screen-layout-2026-04-06.md`
- `macos-native-review-screen-layout-2026-04-06.md`
- `macos-native-layout-screen-layout-2026-04-06.md`
- `macos-native-layout-tagging-contract-2026-04-07.md`
- `macos-native-xlights-sequence-session-and-render-validation-2026-04-08.md`
- `macos-native-history-screen-layout-2026-04-06.md`
- `macos-native-settings-screen-layout-2026-04-06.md`
- `macos-native-settings-build-package-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `macos-native-visual-system-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`
- `macos-native-cutover-plan-2026-04-06.md`
- `macos-native-assistant-surface-2026-04-06.md`
- `macos-native-audio-wireframe-review-package-2026-04-06.md`
- `macos-native-audio-wireframes-v1-2026-04-06.md`
  - historical reference only; not the primary Audio design artifact
- `macos-native-audio-figma-mockup-package-2026-04-06.md`
- `electron-legacy-removal-manifest-2026-04-06.md`
- `implementation-checklist.md`
- `page-roles-and-flow.md`
- `audio-page-redesign-2026-04-06.md`
- `history-and-live-dashboards-plan-2026-03-13.md`
- `history-implementation-checklist.md`
- `end-to-end-audit-2026-03-12.md`

Current role in the app plan:
- define the native product-shell direction before implementation
- preserve workflow-first page contracts and backend/runtime ownership boundaries
- stop broad Electron UX expansion and move toward a native macOS shell design package
- require medium/high-fidelity wireframes and click-through prototypes for high-risk workflows before SwiftUI build
- feed the native scaffold under `apps/xlightsdesigner-macos/`

Lifecycle note:
- Electron-specific app-ui specs are now legacy-reference only unless explicitly marked otherwise
- the active product shell is the native macOS app under `apps/xlightsdesigner-macos/`
