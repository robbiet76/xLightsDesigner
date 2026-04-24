# xLightsDesigner

Repository for the **xLights Agent Sequencer** initiative.

## Structure

### `apps/`
Runtime application code.
- `apps/xlightsdesigner-ui/`: web UI used by desktop wrapper.
- `apps/xlightsdesigner-macos/`: native macOS SwiftUI shell scaffold.
- `apps/xlightsdesigner-analysis-service/`: audio analysis backend.

### `training-packages/`
Portable BYO-provider training assets.
- Canonical package root: `training-packages/training-package-v1/`
- Module layout: `audio_track_analysis`, `lighting_design_principles`, `xlights_sequencer_execution`.

### `docs/`
Cross-project architecture and operational documentation.
- `docs/architecture/`: architecture decisions and analysis for the overall initiative.
- `docs/operations/`: release/runbook procedures and validation evidence logs.

### `specs/`
Implementation-facing specifications.
- Flat root-level spec set with prefixed filenames by domain.

### `scripts/`
Developer/build/validation automation.

## Repo Governance
- Structural placement and ownership rules: `specs/repo-structure-governance.md`
- Canonical training package architecture: `specs/xlights-sequencer-control-training-package-architecture.md`

## Active Product Scope
The current product goal is a native xLightsDesigner app that acts as the local translation layer between AI agents and a user's linked xLights show folder.

Core workflows include:
- project-scoped app metadata stored outside xLights show folders,
- owned xLights API session control,
- native design-intent authoring,
- metadata-aware proposal generation,
- review/apply/render validation against isolated sequence artifacts.

## Validation
Run the native-to-xLights handoff validation through the wrapper below. It starts or reuses the native automation server and owned xLights API, creates isolated validation sequences under the linked development show folder, and validates metadata handoff through proposal/apply/render.

```bash
node scripts/native/run-full-handoff-validation.mjs
```

For broader coverage of known development layout targets and tag-only metadata selection:

```bash
node scripts/native/run-full-handoff-validation.mjs --matrix
```

The default matrix is `scripts/native/full-handoff-validation-scenarios.json`. Use `--matrix-file <path>` to run another scenario set.

## Initial UI Prototype
`apps/xlightsdesigner-ui/` contains the initial standalone UI scaffold for xLightsDesigner development.

Run locally:
1. `cd apps/xlightsdesigner-ui`
2. `./run-dev.sh`
3. Open `http://localhost:8080`

Live endpoint:
- Default endpoint is `/xlightsdesigner/api` via local dev proxy (in `run-dev.sh`).
- You can set the direct owned API endpoint on the `Project` screen (`http://127.0.0.1:49915/xlightsdesigner/api`).
- Click `Test Connection` to call `system.getCapabilities`.
- `Refresh` calls `sequence.getOpen` and `sequence.getRevision`.
- Project screen `Open Sequence` calls `sequence.open` using the provided sequence path and stores recent sequence entries.
- Project screen `Save`/`Save As` call `sequence.save` (Save As uses configured save path).
- Project screen `Close Sequence` calls `sequence.close`; `New Session` clears current draft/session state without deleting project settings.
- Apply uses the owned `sequencing.applyBatchPlan` path and waits for the returned job to settle.
- `Apply to xLights` writes reviewed sequence changes through the owned xLightsDesigner API.
- Revision is polled in the background; if external edits are detected, the draft is marked stale and apply is blocked until refresh/regenerate.
- Design includes an optional `Open Details` drawer with section filtering and `Split by Section` draft narrowing.
- Proposed draft rows are directly editable/removable in Design and details views, with `Add Line` for quick manual proposal shaping.
- When stale, the status bar exposes direct recovery actions: `Rebase/Refresh`, `Regenerate`, and `Cancel Draft`.
- Design also shows an explicit stale-recovery card with guided actions: `Refresh + Regenerate`, `Refresh Only`, and `Cancel Draft`.
- Stale recovery also supports `Rebase Draft` to keep current proposed edits while updating to latest revision baseline.
- History supports `Compare` against current head, `Reapply as Variant` into Design, and practical rollback draft restore flow.
- Compact/mobile behavior includes Design tabs (`Chat`, `Intent`, `Proposed`) and a fixed bottom `Apply to xLights` action bar.
- Diagnostics panel can be opened from header/status bar and captures warning/action-required events with optional stack/detail payloads.
- Apply failures surface owned API job/error details in diagnostics.
- Diagnostics panel includes filters (`All`, `Warnings`, `Action Required`) and live counts in header/footer.
- Project settings now include apply safety controls: confirmation mode (`always`, `large-only`, `never`) and configurable large-change threshold.
- Project/show-scoped workspace snapshots are persisted (sequence path, recents, draft context, safety settings) and can be reloaded via `Load Project Snapshot`.
- `Reset Project Workspace` clears current project draft/session artifacts and writes a fresh default snapshot for that project key.
- Project includes a `Project Health` card with owned API capability checks (`sequencing.applyBatchPlan`, `jobs.get`), sequence-open status, and one-click recheck.
- Metadata includes live `layout.getModels` discovery list with refresh action for current layout context.
- Metadata model list supports filter/search and one-click `Insert Into Draft` to create targeted proposal lines.
- Design Intent panel supports dynamic section targeting via loaded timing-track labels and quick `Add Section Line`.
- Section targeting now uses a timing-track dropdown plus a multi-select section picker (`All Sections` + dynamic list) so users explicitly choose one or more target sections.
- Section picker displays section start time (from timing marks) beside each section label for easier targeting.
- `Use As Filter` and proposal views now respect the same section picker selection model.
- Jobs panel is available from header and tracks async job ids/status/progress with polling via `jobs.get` and cancel hook via `jobs.cancel`.

## Desktop Shell
The Electron desktop shell has been removed.

Rules:
- do not launch Electron for current development
- use `apps/xlightsdesigner-macos/` for the active product shell
