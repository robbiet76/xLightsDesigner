# macOS Native Settings Build Package (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the build-facing package for the native `Settings` implementation slice.

This package translates the approved `Settings` screen design into implementation-ready screen composition, read-model mapping, action inventory, service dispatch rules, and maintenance-boundary rules.

Primary parent sources:
- `macos-native-settings-screen-layout-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`

## Build-Package Rule

This package must answer:
1. what native view hierarchy is built for `Settings`
2. what screen model drives it
3. what local UI state is allowed
4. what actions the user can trigger
5. what shared services are called
6. what is explicitly out of scope for the first slice

## Slice Goal

The first native `Settings` slice should let a user:
1. open `Settings` outside the main workflow journey
2. switch among a stable set of settings categories
3. inspect and edit app-wide configuration in grouped forms
4. test relevant connections where supported
5. access maintenance and diagnostics actions in a clearly separated area

It does not need to solve every future settings category or maintenance tool.
It needs to establish a stable native configuration surface.

## First-Slice Non-Goals

Do not include in the first native `Settings` slice:
- project-specific configuration
- embedded workflow dashboards
- advanced operational consoles
- shell-private configuration storage
- sprawling debug surfaces that dominate ordinary configuration

## App-Wide Configuration Rule

`Settings` is outside the main workflow because it configures the application, not the current project.

Working rule:
- app-wide config belongs here
- project-specific settings do not
- destructive maintenance controls remain separated from ordinary preferences

## Native View Hierarchy

The first native `Settings` implementation should use this view hierarchy.

1. `SettingsScreen`
2. `WorkflowPageHeader`
3. `SettingsCategorySplit`
4. `SettingsCategoryList`
5. `SettingsCategoryContent`
6. `SettingsMaintenanceSection`

### `SettingsScreen`
Owns:
- overall screen composition
- screen-level local UI state
- action dispatch to settings/configuration services
- composition of `SettingsScreenModel`

Contains:
- `WorkflowPageHeader`
- `SettingsCategorySplit`
- `SettingsMaintenanceSection`

### `SettingsCategorySplit`
Left child:
- `SettingsCategoryList`

Right child:
- `SettingsCategoryContent`

### `SettingsCategoryList`
Contains the stable category navigation:
- `General`
- `Providers`
- `xLights`
- `Operators`
- `Paths & Storage`
- `Diagnostics & Maintenance`

Rules:
- category list remains visible while inspecting a category
- categories use user-facing names only
- the list does not become a workflow sidebar substitute

### `SettingsCategoryContent`
Contains grouped form sections for the selected category.

Uses:
- `GroupedFormSection`
- `ActionBar`
- `WarningBannerBlock`
- optional `File/FolderPickerRow` where needed

### `SettingsMaintenanceSection`
Contains:
- maintenance/diagnostic actions only
- clear separation from normal category forms
- confirmation-backed destructive actions

## Screen Model Mapping

The first implementation should consume one screen-level read model:
- `SettingsScreenModel`

Recommended shape:

```text
SettingsScreenModel
- header
- categories
- selectedCategory
- categoryContent
- maintenance
- localCapabilities
- banners
```

### `header`
Contains:
- title
- subtitle
- optional environment/profile indicator

### `categories`
Contains:
- ordered category list
- selected category id

### `selectedCategory`
Contains:
- current category id
- category title
- category description

### `categoryContent`
Contains grouped section data for the selected category.

Expected category families:
- `general`
- `providers`
- `xlights`
- `operators`
- `paths_storage`
- `diagnostics_maintenance`

Each category content group should provide:
- form sections
- field descriptors
- validation state
- local action availability

### `maintenance`
Contains:
- available maintenance actions
- risk classification
- confirmation requirements
- health-check/test action availability

## Local UI State

The first native `Settings` slice should keep these as local shell state only:
- selected category id
- in-progress form drafts before save/apply
- validation display state
- connection-test progress state
- maintenance confirmation sheet state

Do not persist as durable truth:
- temporary unsaved drafts unless explicitly designed later
- shell-side parallel config state

## Action Inventory

### Category navigation actions
- select settings category

### Ordinary settings actions
- edit field values
- save changes
- revert changes
- test connection where supported
- reveal path where supported

### Maintenance actions
- run health check
- open logs
- reveal app data
- create backup
- reset app state

Maintenance actions must remain visually subordinate to ordinary settings work until deliberately opened.

## Service Dispatch Map

### Settings/configuration service
Used for:
- load app-wide configuration
- load category-specific settings state
- validate and save settings
- run connection tests
- expose durable configuration truth

### Diagnostics/backup service
Used for:
- health checks
- backup creation
- log/app-data reveal actions where supported
- reset-like maintenance actions

### xLights client service
Used indirectly through settings/configuration service or dedicated test actions where relevant.
The native shell must not own xLights route logic here.

## State Transition Rules

### Entering `Settings`
1. load categories
2. load selected category or default category
3. keep category navigation visible
4. do not inject project-specific context into the screen

### Switching categories
1. preserve unsaved-draft policy clearly
2. update only the category-content region
3. keep overall screen structure stable

### Saving settings
1. validate the active category inputs
2. dispatch save through the settings/configuration service
3. update category content and banners without full-screen replacement

### Running maintenance actions
1. isolate the action in the maintenance region
2. require confirmation when destructive or reset-like
3. preserve category context where practical

## Error Handling Rules

### Validation errors
- stay local to the active category
- appear near affected fields and in local section summaries when useful

### Connection-test errors
- stay local to the active category
- distinguish validation failure from connectivity/service failure

### Maintenance errors
- stay local to the maintenance region
- never masquerade as ordinary settings validation errors

## SwiftUI Build Notes

This package implies the native implementation should likely map to:
- `SettingsScreenView`
- `SettingsScreenViewModel` or equivalent adapter
- one category-list view
- one category-content composition surface
- a separated maintenance section
- platform-backed clients for:
  - settings/configuration service
  - diagnostics/backup service

The native shell remains a client/composition layer.
Do not move durable config truth or maintenance business rules into SwiftUI.

## Build-Readiness Gate

The native `Settings` slice is ready to implement when:
1. the view hierarchy is accepted
2. the `SettingsScreenModel` shape is accepted
3. the local-state inventory is accepted
4. the action inventory is accepted
5. the service dispatch map is accepted
6. the non-goals list is accepted

If all six are true, the `Settings` native implementation can begin without reopening broad settings design.
