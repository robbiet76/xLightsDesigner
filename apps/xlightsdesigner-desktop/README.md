# xLightsDesigner Electron Desktop

Status: Retired

This directory is the retired Electron shell for xLightsDesigner.
Its executable entrypoints now fail fast on purpose.

## Current Role

- cleanup-only shell residue during native cutover
- not runnable for product work
- not the active product target

The active product shell is:
- `../xlightsdesigner-macos/`

## Rules

- do not add new product-shell behavior here
- do not route automation or validation through this directory
- do not use this directory as the place to resolve current UX questions
- only make changes here when:
  - preserving a shared backend behavior during extraction
  - maintaining a reference path needed for bounded cutover work
  - deleting legacy shell code

## Important Boundary

Some code in this directory still mixes:
- Electron-only glue
- file/service bridge logic
- legacy shell contracts

Do not delete it blindly.
Use the cutover audit first:
- `../../specs/app-ui/native-cutover-audit-2026-04-10.md`
- `../../specs/app-ui/electron-legacy-removal-manifest-2026-04-06.md`
