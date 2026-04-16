# App UI Spec Cleanup Audit (2026-04-16)

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16

## Purpose

Audit the `specs/app-ui/` domain against the current product so stale design packages, Electron-era planning notes, and already-implemented native workflow specs stop cluttering the active path.

For each spec, classify one of:
- `keep`: still aligned and still useful as an active spec
- `update`: still relevant but the implementation has moved enough that the spec should be refreshed
- `archive`: historical planning or one-time review material that should not remain in the active path
- `app gap`: the spec is still the right target and the current app is behind it

## App Evidence Reviewed

Current live app surfaces are in:
- [apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App)
- [apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Views](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Views)
- [apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services)

Observed active native workflow surfaces:
- `ProjectScreenView` / `ProjectScreenViewModel`
- `AudioScreenView` / `AudioScreenViewModel`
- `DisplayScreenView` / `DisplayScreenViewModel`
- `DesignScreenView` / `DesignScreenViewModel`
- `SequenceScreenView` / `SequenceScreenViewModel`
- `ReviewScreenView` / `ReviewScreenViewModel`
- `HistoryScreenView` / `HistoryScreenViewModel`
- `SettingsScreenView` / `SettingsScreenViewModel`
- `RootContentView`, `AppSidebar`, `AdaptiveSplitView`

Observed legacy/reference shell still present but no longer primary:
- [apps/xlightsdesigner-ui](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui)

## Summary Decision

The `app-ui` domain has three distinct classes:
1. active architecture and workflow-boundary specs that should remain in the primary path
2. active-but-stale specs that need an implementation refresh because the native app now exists
3. design-phase packages, wireframes, and Electron-review notes that should be archived

The biggest clutter source is class 3.

## File-by-File Classification

| Spec | Decision | Reason |
| --- | --- | --- |
| `README.md` | update | The domain index is still useful, but it overstates too many planning artifacts as active and does not yet separate implemented native surfaces from historical design packages. |
| `audio-page-redesign-2026-04-06.md` | update | Audio exists in the native app, so this is no longer pure redesign planning. It should either be refreshed to current implementation reality or downgraded to historical design input. |
| `cross-platform-shell-boundary-2026-04-10.md` | keep | Still aligned. The product has a native shell plus shared logic split, and this boundary remains structurally important. |
| `electron-bridge-inventory-2026-04-10.md` | keep | Still useful for cleanup because Electron code remains in the repo and should be intentionally retired. |
| `electron-legacy-removal-manifest-2026-04-06.md` | keep | Still aligned as a cleanup-control doc while legacy Electron code remains in-tree. |
| `electron-main-handler-inventory-2026-04-10.md` | keep | Still useful because it inventories live legacy surfaces that can now be removed more aggressively. |
| `end-to-end-audit-2026-03-12.md` | archive | Historical renderer-shell audit of the pre-native app. Useful for history, not for current execution. |
| `history-and-live-dashboards-plan-2026-03-13.md` | archive | Early shell-behavior planning from the old UI phase. The native app has diverged enough that this should not remain active. |
| `history-implementation-checklist.md` | archive | Old implementation checklist without date suffix and aimed at an earlier shell architecture. Archive it and avoid carrying it forward as active state. |
| `hybrid-cloud-learning-and-billing-2026-04-10.md` | keep | Still draft, but still a valid product architecture topic that is not yet superseded. |
| `implementation-checklist.md` | archive | Old UI/UX checklist without date suffix and written before the native cutover matured. It is no longer the active implementation spine. |
| `macos-native-assistant-surface-2026-04-06.md` | update | Native assistant surface exists, but implementation reality should now be reflected instead of pure pre-build design intent. |
| `macos-native-audio-build-package-2026-04-06.md` | archive | One-time build package. The app now has a native Audio screen, so this should move out of the active path. |
| `macos-native-audio-figma-mockup-package-2026-04-06.md` | archive | Design package, not active implementation guidance. |
| `macos-native-audio-screen-layout-2026-04-06.md` | update | Still relevant because Audio exists, but it needs current-state comparison against the implemented native screen. |
| `macos-native-audio-wireframe-review-package-2026-04-06.md` | archive | Review package only. Historical once implementation exists. |
| `macos-native-audio-wireframes-v1-2026-04-06.md` | archive | Historical wireframe artifact. |
| `macos-native-audio-workflow-review-from-electron-2026-04-06.md` | archive | Explicitly Electron-reference-only. Historical after native implementation. |
| `macos-native-cutover-plan-2026-04-06.md` | update | Still relevant, but cutover has progressed and this should reflect the current native-primary reality. |
| `macos-native-design-phase-workstreams-2026-04-06.md` | archive | One-time design-phase orchestration, not current execution. |
| `macos-native-design-screen-layout-2026-04-06.md` | update | Design screen exists in native app, so this should be refreshed against the implemented screen. |
| `macos-native-design-sequence-review-build-package-2026-04-06.md` | archive | One-time build package for pre-implementation. |
| `macos-native-design-sequence-review-coupled-review-2026-04-06.md` | update | Still useful because coupling among Design/Sequence/Review remains core product behavior, but it should be refreshed to current app behavior. |
| `macos-native-design-system-components-2026-04-06.md` | update | Still relevant, but should be compared against actual SwiftUI component usage instead of pre-build intent. |
| `macos-native-design-workflow-review-from-electron-2026-04-06.md` | archive | Historical Electron-reference material. |
| `macos-native-display-page-2026-04-08.md` | keep | Still aligned. Native Display behavior is active and the page purpose still matches the app. |
| `macos-native-early-workflow-relationship-2026-04-06.md` | update | Still relevant because Project/Layout/Audio handoff remains important, but should be refreshed to actual native workflow state. |
| `macos-native-history-build-package-2026-04-06.md` | archive | One-time build package. |
| `macos-native-history-relationship-2026-04-06.md` | update | Native History exists; relationship contract should be refreshed against implementation. |
| `macos-native-history-screen-layout-2026-04-06.md` | update | Still relevant because the screen exists, but it should reflect the implemented native state. |
| `macos-native-history-workflow-review-from-electron-2026-04-06.md` | archive | Historical Electron-reference material. |
| `macos-native-information-architecture-2026-04-06.md` | keep | Still aligned. The native app visibly follows this top-level workflow partitioning. |
| `macos-native-interaction-model-2026-04-06.md` | keep | Still relevant as a shared behavior contract; should stay active unless replaced by a more concrete UX standard. |
| `macos-native-layout-screen-layout-2026-04-06.md` | update | The native product uses `Display` more centrally than `Layout`, so this spec likely needs consolidation or renaming. |
| `macos-native-layout-tagging-contract-2026-04-07.md` | update | Still relevant because tagging/metadata exists, but the live page appears to be `Display`, not `Layout`, so the spec naming and scope likely drifted. |
| `macos-native-layout-workflow-review-from-electron-2026-04-06.md` | archive | Historical Electron-reference material. |
| `macos-native-migration-phase-plan-2026-04-06.md` | update | Still relevant until the native cutover is fully complete, but it should be revised to current completion state. |
| `macos-native-project-layout-build-package-2026-04-06.md` | archive | One-time build package. |
| `macos-native-project-layout-relationship-2026-04-06.md` | update | Still relevant because project/display sequencing matters, but it should reflect current page names and flows. |
| `macos-native-project-screen-layout-2026-04-06.md` | update | Native Project screen exists, so this should be compared and refreshed instead of left as initial pre-build contract. |
| `macos-native-project-workflow-review-from-electron-2026-04-06.md` | archive | Historical Electron-reference material. |
| `macos-native-read-models-and-page-state-contracts-2026-04-06.md` | keep | Still aligned. The native app clearly uses explicit view models/services and this contract remains structurally important. |
| `macos-native-review-screen-layout-2026-04-06.md` | update | Native Review exists, so this should be refreshed to the implemented screen. |
| `macos-native-review-workflow-review-from-electron-2026-04-06.md` | archive | Historical Electron-reference material. |
| `macos-native-sequence-design-review-relationship-2026-04-06.md` | keep | Still aligned and still important because those three views are core workflow stages in the native app. |
| `macos-native-sequence-screen-layout-2026-04-06.md` | update | Native Sequence exists, so this should be refreshed to the implemented screen. |
| `macos-native-sequence-workflow-review-from-electron-2026-04-06.md` | archive | Historical Electron-reference material. |
| `macos-native-settings-build-package-2026-04-06.md` | archive | One-time build package. |
| `macos-native-settings-screen-layout-2026-04-06.md` | update | Native Settings exists, so this should be refreshed against implementation. |
| `macos-native-shared-backend-and-service-boundaries-2026-04-06.md` | keep | Still aligned and important. The native app continues to rely on shared JS/runtime layers and service boundaries. |
| `macos-native-visual-system-2026-04-06.md` | update | Still relevant, but should be checked against the actual SwiftUI component language now in use. |
| `macos-native-wireframe-and-prototype-method-2026-04-06.md` | archive | Method/process artifact for the design phase, not active implementation guidance. |
| `macos-native-workflow-contracts-2026-04-06.md` | keep | Still aligned. The top-level workflow contract remains core to the native shell. |
| `macos-native-xlights-sequence-session-and-render-validation-2026-04-08.md` | update | Still relevant and partially aligned, but implementation has advanced substantially and the prompt/modal gap is now mostly resolved. |
| `native-app-architecture-diagram-2026-04-10.md` | keep | Still aligned. It describes the current native architecture and remains a useful entry point. |
| `native-cutover-audit-2026-04-10.md` | keep | Still aligned and still useful as the current cutover reference. |
| `page-roles-and-flow.md` | archive | No date suffix and still tied to the old shell-era page naming. Replace it with dated active workflow docs or archive it. |

## App Gaps

These specs describe active targets where the app still appears to need follow-up work, not deletion:
- `macos-native-layout-screen-layout-2026-04-06.md`
- `macos-native-layout-tagging-contract-2026-04-07.md`
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-history-screen-layout-2026-04-06.md`
- `macos-native-review-screen-layout-2026-04-06.md`
- `macos-native-sequence-screen-layout-2026-04-06.md`
- `macos-native-settings-screen-layout-2026-04-06.md`

Reason:
- the native app already has these screens, but the spec set is still mostly pre-implementation and does not yet document current behavior, compromises, or known deltas.

## Recommended Cleanup Sequence

1. Archive the clearly historical design-process artifacts:
- all `*-workflow-review-from-electron-*`
- all `*-build-package-*`
- all wireframe / mockup / prototype method docs
- `end-to-end-audit-2026-03-12.md`
- `history-and-live-dashboards-plan-2026-03-13.md`
- `history-implementation-checklist.md`
- `implementation-checklist.md`
- `page-roles-and-flow.md`

2. Keep and refresh the active architecture/workflow contracts:
- `README.md`
- `cross-platform-shell-boundary-2026-04-10.md`
- `electron-bridge-inventory-2026-04-10.md`
- `electron-legacy-removal-manifest-2026-04-06.md`
- `electron-main-handler-inventory-2026-04-10.md`
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `native-app-architecture-diagram-2026-04-10.md`
- `native-cutover-audit-2026-04-10.md`

3. Convert the remaining active screen specs from pre-build design docs into current-state contracts.

## Naming Convention Note

New or refreshed active specs in this domain should keep the date suffix in the filename so spec age is obvious at a glance.

Legacy undated files that remain only for historical reasons should be archived rather than copied forward as active specs.
