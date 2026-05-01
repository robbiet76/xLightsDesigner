# xLightsDesigner macOS

This is the macOS app surface for xLightsDesigner.

## Purpose

This app is the clean SwiftUI app shell described in the design and cutover specs.

Current status:
- this is the active product shell
- major workflows are now app-primary in practice

## Rules

- This directory is the only place new macOS product-shell work should occur.
- Do not add retired prototype-shell compatibility code here.
- Do not fork backend contracts or durable schemas for the app shell.
- Do not move business logic or artifact truth into SwiftUI views.

## Build

Open `Package.swift` in Xcode, or run:

```bash
cd apps/xlightsdesigner-macos
swift run
```

## Primary references

- `../../specs/app-ui/app-workspace.md`
- `../../specs/platforms/platform-and-services.md`
- `../../specs/platforms/macos-app.md`

## Current workflow surface

1. Project
2. Display
3. Audio
4. Design
5. Sequence
6. Review
7. History

`Settings` remains outside the main workflow.
