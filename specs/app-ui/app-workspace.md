# App Workspace

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: dated macOS app screen, migration, cutover, and workflow specs under `specs/app-ui/`

## Purpose

Define the durable app experience for xLightsDesigner independent of a specific operating system.

## Product Shape

The app is the user's primary workspace. It owns project selection, show-folder binding, sequence selection, workflow navigation, review/apply, history, settings, and orchestration of local services.

The current implementation is the macOS SwiftUI app. Platform-specific behavior is defined separately under `../platforms/`.

The app should feel like a focused production tool, not a dashboard collection or marketing shell. Screens should be dense enough for repeated work, clear enough for review, and conservative around destructive changes.

## Primary Screens

- Project: create, open, migrate, and bind projects to local storage and show folders.
- Audio: manage media analysis and timing artifacts.
- Design: capture user intent, display knowledge, preferences, and creative direction.
- Sequence: translate approved intent into concrete sequence plans.
- Review: inspect commands, warnings, backups, validation status, and render proof before apply.
- Display: inspect display/model metadata and custom model understanding.
- History: review project events, generated artifacts, backups, restore points, and proof evidence.
- Settings: configure local paths, API connection, cloud/account settings, and diagnostics.

## Workflow Rules

- Project state is the root of the user experience.
- Selecting a different show folder or display refreshes display, model metadata, custom model data, and current sequence context.
- Project migration, metadata retention, and app-owned storage behavior follow `project-storage.md`.
- Review owns final apply approval and backup visibility.
- History owns recovery and audit.

## App Workspace Responsibilities

- maintain the current project and selected show folder
- start and monitor local services
- connect to the owned xLights API
- provide visible validation state
- create and reference backups before apply
- show compact artifact summaries without loading large generated data into every view
- keep user-visible terminology aligned with the domain specs

## UI Quality Bar

- Favor clear tables, inspectors, split views, and scoped toolbars over decorative cards.
- Keep feature controls complete enough for real workflow use.
- Make warnings and blocked states specific and actionable.
- Avoid burying the active project, show folder, sequence, or validation state.
- Preserve user trust by making apply, overwrite, replacement, and restore behavior explicit.

## Related Specs

- `../product-plan.md`
- `../platforms/platform-and-services.md`
- `project-storage.md`
- `../sequence-agent/xlights-api.md`
- `../sequence-agent/model-metadata.md`
- `../sequence-agent/sequencing-system.md`
