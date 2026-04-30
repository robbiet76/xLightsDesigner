# Spec Governance

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: separate spec organization, lifecycle, and repo structure governance docs

## Purpose

Keep specs, docs, source code, and generated artifacts in predictable locations so the repository stays useful as an implementation guide instead of becoming a chronological work log.

## Root Spec Role

The root `specs/` directory is for durable entry points only:

- product direction and roadmap
- release and verification gates
- requirements traceability
- repository and spec governance

Domain-specific contracts belong in domain folders such as `app-ui/`, `audio-analyst/`, `designer-dialog/`, and `sequence-agent/`.

## Spec Lifecycle

Active specs should include:

- `Status`
- `Owner`
- `Last Reviewed`
- `Supersedes` when replacing older specs
- `Superseded By` only when a retained historical file remains

Use stable kebab-case filenames without dates for long-lived specs.

Dated filenames are allowed only for:

- point-in-time product assessments
- release impact audits
- evidence readouts that are intentionally historical

Old implementation plans, cleanup audits, migration plans, and checklists should be folded into durable specs, then removed unless they explain current behavior that is not captured elsewhere.

## Status Values

- `Draft`: under active authoring.
- `Active`: source-of-truth for implementation decisions.
- `Deprecated`: readable but not used for new implementation.
- `Archived`: historical record only.

## Repository Layout

Canonical top-level folders:

- `apps/`: runtime applications and services.
- `training-packages/`: portable LLM training assets.
- `specs/`: implementation-facing requirements, contracts, roadmaps, and acceptance criteria.
- `docs/`: architecture and supporting reference material.
- `scripts/`: developer automation, build tooling, and validation helpers.

Current domain anchors:

- `apps/xlightsdesigner-macos/`
- `apps/xlightsdesigner-ui/agent/app-assistant/`
- `apps/xlightsdesigner-ui/agent/audio-analyst/`
- `apps/xlightsdesigner-ui/agent/designer-dialog/`
- `apps/xlightsdesigner-ui/agent/sequence-agent/`
- `specs/app-assistant/`
- `specs/app-ui/`
- `specs/audio-analyst/`
- `specs/designer-dialog/`
- `specs/sequence-agent/`

## Placement Rules

- App runtime code belongs under `apps/*`.
- Reusable datasets, prompts, and examples belong under `training-packages/training-package-v1/modules/*`.
- Specs must not be used as runtime data stores.
- Generated artifacts, run logs, and proof outputs do not belong in `specs/` unless promoted into a compact durable knowledge artifact.
- Machine-local files, generated caches, and local environment files are not committed.
- Historical specs should move to `specs/archive/` only when they retain clear reference value.

## Development Policy

- Maintain one canonical app source tree.
- Maintain one canonical xLights source tree.
- Maintain one canonical app state root.
- Modify the active implementation in place.
- Do not create alternate app versions, duplicate worktrees, shadow installs, or parallel runtime roots during initial product development.
- Avoid compatibility readers, fallback schemas, and dual-path runtime behavior unless the product explicitly needs migration support.

## Cleanup Standard

When consolidating specs:

1. Identify durable decisions.
2. Move those decisions into the current product or domain spec.
3. Update references.
4. Remove the superseded file.
5. Run a missing-link/reference check.
