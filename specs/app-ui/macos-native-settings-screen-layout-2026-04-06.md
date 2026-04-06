# macOS Native Settings Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Settings` screen before any SwiftUI implementation begins.

This screen exists to hold application-wide configuration and operational controls that should not live inside the primary project workflow.
It is not a substitute for project configuration screens.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`

## Screen Role

The native `Settings` screen answers:
- how the application is configured globally
- how external services and tool integrations are configured
- which operator-wide defaults and debug controls are in effect
- where to go when something app-wide needs adjustment

It is outside the main workflow because it configures the application, not the current project.

## Screen-Contract Rules

1. the first read surface must be settings categories, not a giant mixed form
2. settings must be grouped by stable domains, not by implementation file or service name alone
3. destructive app-wide operations must be clearly separated from ordinary preferences
4. test/debug/reset controls must never dominate the screen
5. project-specific fields must not appear here
6. the screen must remain usable even as more providers and integrations are added

## Primary User Questions

1. where do I configure app-wide services and integrations
2. where do I change provider/model defaults
3. where do I manage xLights connection preferences
4. where do I find app-wide maintenance or debug tools

## Information Hierarchy

The screen uses four vertical regions:

1. page header
- workflow title
- one-sentence explanation

2. settings category navigation band
- category list or segmented sidebar inside the page

3. selected settings category content band
- primary configuration surface

4. maintenance and diagnostics band
- secondary operational tools
- visually separated from ordinary settings

## Region Specifications

### 1. Page Header

Required content:
- `Settings`
- short supporting description
- optional environment/profile indicator if useful

Must not include:
- active sequence context
- project-specific readiness summaries
- workflow-specific dashboards

### 2. Settings Category Navigation Band

Purpose:
- let the user move between settings domains without scanning one oversized form

Required categories:
- `General`
- `Providers`
- `xLights`
- `Operators`
- `Paths & Storage`
- `Diagnostics & Maintenance`

Rules:
- categories must use stable user-facing names
- category count should stay small and deliberate
- navigation should remain visible while reading/editing a category

### 3. Selected Settings Category Content Band

Purpose:
- show the currently selected settings group in a focused form-based surface

Common requirements:
- grouped sections with short explanations
- clear editable vs read-only fields
- explicit save/apply behavior
- validation errors shown near the affected control

Likely category contents:

#### General
- app-level defaults
- startup preferences
- general behavior toggles

#### Providers
- provider selection
- model defaults
- provider status summaries
- credential/configuration entry points

#### xLights
- connection preferences
- owned API endpoint preferences
- health/status summary
- xLights-specific operational defaults

#### Operators
- operator identity selection
- app-wide attribution defaults
- role-specific preferences when needed

#### Paths & Storage
- canonical app root visibility
- storage paths used by the app
- backup-path visibility
- path validation summaries

#### Diagnostics & Maintenance
- logs
- health checks
- backup visibility
- reset/test/debug actions

### 4. Maintenance And Diagnostics Band

Purpose:
- isolate high-risk operational actions from ordinary settings

Rules:
- this region must be visually separated
- destructive or state-resetting actions must require confirmation
- these controls must not visually dominate the screen

Likely actions:
- `Run Health Check`
- `Reveal App Data`
- `Open Logs`
- `Create Backup`
- `Reset App State`

## Dominant Action Model

Primary actions are category-local form actions.

Likely actions:
- `Save Changes`
- `Revert Changes`
- `Test Connection`
- `Reveal Path`
- `Run Health Check`

Rules:
- actions belong near the category content they affect
- app-wide destructive actions belong only in `Diagnostics & Maintenance`
- auto-save should not be assumed unless explicitly designed later

## Read Model Requirements

The `Settings` screen requires:
- app-wide configuration state
- provider configuration state
- xLights connection/configuration state
- operator configuration state
- storage/path configuration state
- maintenance/diagnostic capability state
- per-category validation state

## Empty, Loading, And Error States

### Empty / First Use

Use when settings are present but not yet configured.

Required content:
- explain which category needs attention
- show safe defaults where applicable
- avoid presenting first-use state as a fatal error

### Loading

Use when reading configuration or testing a connection.

Required behavior:
- keep category navigation visible
- show progress only in the active category region
- avoid replacing the whole screen with a spinner-only state

### Error

Use when settings cannot be read or a validation/test operation fails.

Required content:
- short readable failure summary
- affected category
- whether retry is possible
- what remains usable

## Required Wireframe States

The wireframe package for `Settings` must include:
1. default category view
2. category with editable form controls
3. validation-error state
4. connection-test or health-check in progress
5. diagnostics/maintenance state
6. destructive-confirmation state

## Required Prototype Flows

The click-through prototype is optional initially, but if created it should cover:
1. open `Settings`
2. switch between categories
3. edit a provider or xLights setting
4. test a connection
5. save or revert the change
6. enter diagnostics and trigger a maintenance action with confirmation

## Explicit Non-Goals

The `Settings` screen must not become:
- a project summary page
- an audio analysis page
- a sequence dashboard
- a review/apply workflow
- a history browser

## Exit Criteria For Design Phase

The `Settings` screen contract is ready for native wireframes when:
1. category grouping is stable
2. the boundary between project settings and app settings is unambiguous
3. diagnostics/maintenance controls are isolated correctly
4. save/test/reset behavior is explicit
