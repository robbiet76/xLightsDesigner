# xLights API

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: dated xLights 2026.06 migration, owned API implementation, compatibility, 2026.07 audit, and control quality specs

## Purpose

Define the durable owned xLights API boundary used by xLightsDesigner.

## Role

The API is the only supported path for app-driven xLights state access and sequence mutation. It should expose stable, testable operations for project workflow, display discovery, timing, sequence lifecycle, effects, render feedback, and validation.

## Show Folder Switching

Clean show-folder switching is basic product functionality. The API must allow the app to switch the active show folder, refresh layout/display data, and avoid stale state leaking between displays.

When the show folder changes, consumers should refresh model metadata, custom model construction data, display element order, sequence context, timing context, and render validation state.

Model metadata refresh and reconciliation requirements are defined in `model-metadata.md`.

## Required Capability Areas

- health and capability discovery
- show-folder selection and validation
- sequence open/create/save/close
- layout models, groups, submodels, geometry, nodes, display elements, and scene data
- custom model construction data through API responses
- timing tracks and marks
- effect list/create/update/delete/clone/layer operations
- batch sequencing apply
- render current sequence and render samples
- job status and cancellation

## API Principles

- Prefer explicit endpoints over hidden UI automation.
- Return structured errors and warnings.
- Keep mutation endpoints reviewable and auditable.
- Preserve existing sequence content unless replacement is explicit in the command plan.
- Make render proof and validation machine-readable.
- Keep display discovery through xLights layout endpoints read-only.
- Keep generated or training-specific behavior out of the API surface unless it is needed for product workflow.
- Expose enough structured layout data for the app to avoid primary direct layout-file parsing.

## Version Policy

The current implementation target is xLights 2026.07. Earlier 2026.06 migration docs are historical evidence only; they should not be treated as open implementation plans.

Future xLights releases should be handled by a short impact audit and then folded into this durable API spec when decisions become current.
