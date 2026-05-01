# Platform And Services

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: `cross-platform-shell-boundary-2026-04-10.md`, `hybrid-cloud-learning-and-billing-2026-04-10.md`, prototype-shell inventory and legacy-removal specs

## Purpose

Define the durable platform boundary for the app, local services, xLights integration, and future cloud capabilities.

## Local-First Boundary

The product must work as a local desktop tool for project work:

- project files, display metadata, and generated artifacts follow the app-owned storage model in `project-storage.md`
- xLights operations run through the local owned API
- backups and render proof are created locally
- generated training/proof artifacts remain local unless explicitly promoted or exported
- user sequence changes require explicit apply approval

## App Workspace Boundary

The app owns user workflow and orchestration. It should not duplicate domain logic already owned by the audio analyst, designer dialog, sequence agent, or xLights API.

## Local Service Boundary

Local services own specialist computation and xLights access:

- audio analysis
- sequence planning and validation
- render-training/proof tooling
- xLights API calls
- artifact generation and compaction

The app consumes compact summaries and artifact references where possible.

## Future Cloud Boundary

Cloud services may support account management, billing, shared learning, model upgrades, and optional sync/export. Cloud should not become required for local project safety, show-folder access, backup creation, or xLights apply.

## Legacy Prototype Shell Boundary

Prototype-shell specs and handler inventories are no longer current app architecture. They can be consulted only as historical parity references when a app feature appears to be missing.

## Related Specs

- `app-workspace.md`
- `project-storage.md`
- `../sequence-agent/xlights-api.md`
