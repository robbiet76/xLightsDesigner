# xLightsDesigner

Repository for the **xLights Agent Sequencer** initiative.

## Structure

### `docs/`
Cross-project and project-scoped documentation.
- `docs/architecture/`: architecture decisions and analysis for the overall initiative.
- `docs/projects/`: project-specific docs and proposal artifacts.

### `specs/`
Implementation-facing specifications.
- `specs/projects/`: executable project specs and implementation plans.

## Current Project Phases

### `audio-timing-lyrics` (Phase 1)
Goal: automate song prep workflows in xLights:
- audio timing track generation,
- song structure track generation (verse/chorus/etc.),
- lyric track generation/import.

Project assets:
- Docs: `docs/projects/audio-timing-lyrics/`
- Specs: `specs/projects/audio-timing-lyrics/`

## Notes
This repo is intentionally organized as:
- one top-level initiative (agent sequencer),
- multiple scoped projects/phases underneath.

## Initial UI Prototype
`apps/xlightsdesigner-ui/` contains the initial standalone UI scaffold for xLightsDesigner development.

Run locally:
1. `cd apps/xlightsdesigner-ui`
2. `./run-dev.sh` (or `python3 -m http.server 8080`)
3. Open `http://localhost:8080`

Live endpoint:
- Set xLights endpoint on the `Project` screen (default `http://127.0.0.1:49914/xlDoAutomation`).
- Click `Test Connection` to call `system.getCapabilities`.
- `Refresh` calls `sequence.getOpen` and `sequence.getRevision`.
- Project screen `Open Sequence` calls `sequence.open` using the provided sequence path and stores recent sequence entries.
- Apply preflight includes `system.validateCommands` before `system.executePlan`.
- `Apply to xLights` executes an atomic `system.executePlan` that writes a Designer timing track (`XD:ProposedPlan`) from the current proposed-change list.
- Revision is polled in the background; if external edits are detected, the draft is marked stale and apply is blocked until refresh/regenerate.
- Design includes an optional `Open Details` drawer with section filtering and `Split by Section` draft narrowing.
- When stale, the status bar exposes direct recovery actions: `Rebase/Refresh`, `Regenerate`, and `Cancel Draft`.
- History supports `Compare` against current head, `Reapply as Variant` into Design, and practical rollback draft restore flow.
- Compact/mobile behavior includes Design tabs (`Chat`, `Intent`, `Proposed`) and a fixed bottom `Apply to xLights` action bar.
- Diagnostics panel can be opened from header/status bar and captures warning/action-required events with optional stack/detail payloads.
- Validation failures now surface per-step details from `system.validateCommands` in diagnostics.
- Diagnostics panel includes filters (`All`, `Warnings`, `Action Required`) and live counts in header/footer.
