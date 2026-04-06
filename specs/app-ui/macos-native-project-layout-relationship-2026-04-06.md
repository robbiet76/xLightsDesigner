# macOS Native Project / Layout Relationship (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define how `Project` and `Layout` work together in the native app.

These two workflows sit at the start of the project journey.
If they are treated as unrelated screens, the native app will recreate the same early-workflow ambiguity that existed in Electron.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-project-screen-layout-2026-04-06.md`
- `macos-native-layout-screen-layout-2026-04-06.md`
- `macos-native-project-workflow-review-from-electron-2026-04-06.md`
- `macos-native-layout-workflow-review-from-electron-2026-04-06.md`

## Relationship Rule

`Project` establishes working context.
`Layout` validates and corrects target readiness inside that context.

Working rule:
- `Project` answers whether the project is real and correctly referenced
- `Layout` answers whether the target model is usable for downstream work
- neither screen should try to do the other's primary job

## Shared Early Workflow

The expected early workflow is:
1. establish or open the project
2. confirm show folder and project references
3. inspect layout readiness
4. correct layout-target issues if needed
5. move into `Audio`, `Design`, or `Sequence`

## Project Ownership In This Relationship

`Project` owns:
- project identity
- `.xdproj` location
- show-folder and media-path references
- app-owned project root visibility
- high-level downstream readiness hints

`Project` does not own:
- target-by-target correction
- orphan/remapping resolution details
- tag correction workflows

## Layout Ownership In This Relationship

`Layout` owns:
- target list and classification
- tags
- assignments
- orphan/remapping issues
- target-level readiness correction

`Layout` does not own:
- project creation/open/save lifecycle
- project path authoring as a primary workflow
- downstream workflow dashboards

## Cross-Screen Consistency Rules

The two screens must remain consistent about:
- active project identity
- show-folder reference
- readiness language
- what is blocking downstream work

Examples:
1. if the project has no valid show folder, `Project` states the root problem and `Layout` reflects that target readiness cannot be trusted
2. if layout data is present but unresolved, `Project` may hint at that, but `Layout` owns the correction flow
3. `Project` may say `Layout needs review`, but it must not become the place where target correction happens

## Transition Rules

### Project -> Layout

Move from `Project` to `Layout` when:
- the project exists
- project references are valid enough to inspect layout support state

The transition should feel like:
- `Project` confirmed where the work lives
- `Layout` confirms whether the downstream target structure is usable

### Layout -> Project

Return from `Layout` to `Project` when:
- the blocking issue is really a project-reference issue
- the show-folder or project reference itself is wrong

The transition should not feel like failure.
It should feel like moving back to the correct ownership layer.

## Shared UI Rules

1. both screens should show the active project clearly
2. neither screen should show global active sequence context
3. both screens should use compact readiness summaries rather than dashboards
4. `Layout` should feel more grid-driven than `Project`
5. `Project` should feel more summary-and-actions driven than `Layout`

## Acceptance Criteria For This Relationship

This relationship is design-ready only when:
1. it is obvious why `Project` comes before `Layout`
2. `Project` and `Layout` do not duplicate ownership
3. readiness language is coherent across both screens
4. the handoff from project context to target readiness is explicit
5. a user can tell whether a problem belongs to project setup or target correction
