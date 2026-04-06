# macOS Native Project Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Project` screen layout contract.

This screen defines the app entry workflow for project creation, opening, and context confirmation.
It should make project state obvious without turning into a generic settings page or a sequence control surface.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`
- `xlightsdesigner-project-storage-layout.md`

## Screen Purpose

The `Project` screen exists to do four jobs clearly:
1. create a new project
2. open an existing project
3. confirm the active project identity and core working paths
4. show whether the project context is ready for downstream workflows

It is not a settings page.
It is not an audio-analysis page.
It is not a sequence dashboard.

## Primary User Goals

1. establish the active project quickly
2. understand where the project lives on disk
3. confirm the referenced show folder and media path
4. understand basic project readiness at a glance
5. move into downstream workflows with confidence that the project context is correct

## Entry Conditions

- always accessible from the workflow sidebar
- default first-run landing screen
- default recovery destination when no active project exists

## Exit Conditions

The user should be able to leave this screen knowing one of these is true:
1. a project has been created successfully
2. an existing project has been opened successfully
3. the active project context is valid and ready for downstream use
4. the project is missing something obvious and the gap is clearly explained

## Layout Overview

The native `Project` screen should use a top summary plus a two-band content layout.

Primary structure:
1. page header
2. active project summary band
3. project actions band
4. project context/detail band

The key rule is:
- the screen should first answer “what project am I in?”
- then answer “what can I do next?”
- then answer “is the project context valid?”

## Region Definition

### Region A: Page Header

Purpose:
- establish that this screen is the project root context

Required contents:
- title: `Project`
- short purpose line:
  - `Create, open, and confirm the active xLightsDesigner project.`

Optional contents:
- small active-project state badge if a project is open

Disallowed contents:
- xLights connection details as primary header content
- sequence-specific status
- audio-analysis operation details

## Region B: Active Project Summary Band

Purpose:
- show the current project identity immediately

This is the first read surface on the screen.

Required contents when a project is active:
- project name
- project file path
- show folder path
- media path summary
- concise readiness status

Required contents when no project is active:
- `No active project`
- one-sentence guidance to create or open a project

Optional supporting summaries:
- number of bound sequences later if useful
- shared-library linkage summary later if useful

Disallowed contents:
- low-level diagnostics
- verbose storage explanations
- downstream workflow dashboards

## Region C: Project Actions Band

Purpose:
- make project lifecycle actions obvious and immediate

Layout:
- visually prominent action group below the active project summary

Required primary actions:
- `Create Project`
- `Open Project`

Required secondary actions when a project is active:
- `Save Project`
- `Save Project As`

Optional actions later if needed:
- `Reveal Project In Finder`
- `Change Show Folder`
- `Change Media Path`

Action rules:
- lifecycle actions must be easy to find
- secondary maintenance actions should not visually overpower create/open
- if no project is active, create/open must dominate the band

Disallowed behavior:
- hiding project create/open behind menus or settings
- mixing unrelated app controls into this band

## Region D: Project Context / Detail Band

Purpose:
- show the project context the rest of the app will depend on

Layout:
- lower structured detail area
- readable, not diagnostic-heavy

Recommended sections:
1. project identity
2. referenced paths
3. readiness summary
4. downstream workflow readiness hints

### Project Identity Section

Show:
- project name
- `.xdproj` path
- app-owned project root path

### Referenced Paths Section

Show:
- show folder path
- media path
- short explanation that these are references, not app-owned storage

### Readiness Summary Section

Show concise status for:
- project file present
- show folder present
- media path present or intentionally unset
- app-owned metadata root valid

Rules:
- use readable state language
- avoid raw path-validation dumps

### Downstream Workflow Readiness Hints

Show only lightweight signals such as:
- `Audio can be used now`
- `No active sequence selected yet`
- `Review unavailable until pending implementation exists`

Rule:
- these are hints, not embedded dashboards

## State Variants

The wireframe and prototype set for `Project` must cover these states.

### State 1: First Run / No Active Project

Characteristics:
- no active project
- create/open actions dominate

Must communicate:
- what a project is
- what to click first

### State 2: Active Project, Ready

Characteristics:
- active project exists
- key paths are present
- readiness is good enough for downstream workflows

Must communicate:
- the project is established
- the user can move on confidently

### State 3: Active Project, Incomplete Context

Characteristics:
- project exists but one or more required references are missing or unclear

Must communicate:
- what is missing
- why it matters
- what the user should do next

### State 4: Open/Create Error

Characteristics:
- create/open/save operation failed

Must communicate:
- concise reason
- whether the user can retry immediately

## Interaction Rules

1. project create/open actions are always visible
2. save actions are visible only when meaningful
3. this screen should never pretend to own sequence state
4. path fields may be shown read-only with explicit change actions
5. readiness problems must be summarized in user language
6. missing context must point to the next valid action

## Read-Model Expectations

The screen contract expects these logical state groups:
- `activeProject`
- `projectActions`
- `projectPaths`
- `readiness`
- `downstreamHints`

Expected high-level shape:
- `activeProject.name`
- `activeProject.projectFilePath`
- `activeProject.projectRoot`
- `projectPaths.showFolderPath`
- `projectPaths.mediaPath`
- `readiness.status`
- `readiness.issues`
- `projectActions.available`
- `downstreamHints.items`

Detailed schema belongs later in the page-state contract workstream.

## Out Of Scope For This Screen

Do not add these to the native `Project` screen contract:
- xLights connection preferences
- provider/model settings
- standalone audio analysis controls
- sequence translation dashboards
- design proposal review
- history browsing
- app diagnostics console

## Wireframe Requirements

The `Project` wireframe package must include:
1. first-run / no active project view
2. active project ready view
3. active project incomplete-context view
4. open/create error view

The wireframes must be detailed enough to answer:
- is create/open obvious
- is active project identity immediately clear
- are path references understandable
- is readiness readable without clutter
- does the screen avoid turning into settings or diagnostics

## Prototype Requirements

`Project` does not require the same interaction depth as `Audio`, but its prototype package should still cover:
1. create/open project entry path
2. landing into active project summary
3. viewing incomplete-context state
4. moving from `Project` into a downstream workflow after project setup

## Decisions Locked Here

1. `Project` is the root context screen, not a general dashboard
2. active project identity is the first read surface
3. create/open remain visually obvious at all times
4. settings and diagnostics stay out of this screen
5. downstream workflow hints stay lightweight and non-interactive

## Immediate Next Design Step

After this screen contract:
1. write the combined native `Sequence / Design / Review` relationship layout spec
2. then define `Layout` and `History` screen contracts if needed before wireframing expands
