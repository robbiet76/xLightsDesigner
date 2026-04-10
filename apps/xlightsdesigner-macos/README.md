# xLightsDesigner macOS

This is the native macOS app surface for xLightsDesigner.

## Purpose

This app is the clean SwiftUI-native shell described in the design and cutover specs. It is intentionally separate from the Electron shell.

Current status:
- this is the active product shell
- major workflows are now native-primary in practice

## Rules

- This directory is the only place new native product-shell work should occur.
- Do not add Electron compatibility code here.
- Do not fork backend contracts or durable schemas for the native shell.
- Do not move business logic or artifact truth into SwiftUI views.

## Build

Open `Package.swift` in Xcode, or run:

```bash
cd apps/xlightsdesigner-macos
swift run
```

## Primary references

- `../../specs/app-ui/macos-native-information-architecture-2026-04-06.md`
- `../../specs/app-ui/macos-native-workflow-contracts-2026-04-06.md`
- `../../specs/app-ui/macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `../../specs/app-ui/macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `../../specs/app-ui/macos-native-visual-system-2026-04-06.md`
- `../../specs/app-ui/macos-native-design-system-components-2026-04-06.md`
- `../../specs/app-ui/macos-native-cutover-plan-2026-04-06.md`
- `../../specs/app-ui/native-cutover-audit-2026-04-10.md`

## Current workflow surface

1. Project
2. Display
3. Audio
4. Design
5. Sequence
6. Review
7. History

`Settings` remains outside the main workflow.
