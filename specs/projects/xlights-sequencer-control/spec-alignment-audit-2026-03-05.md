# Spec Alignment Audit (2026-03-05)

Scope audited:
- `standalone-app-requirements.md`
- `decision-log.md`
- `xlightsdesigner-dev-backlog-v1.md`
- `README.md` (spec index)
- related wireframe/checklist references

Audit objective:
- Confirm specs align with locked architecture:
  - standalone packaged desktop app,
  - no side runtime installs for production users,
  - xLights API localhost integration boundary,
  - compatibility-gated mutation policy.

## Findings
1. Deployment model lock was present in requirements but not explicitly captured in decision log.
2. Dev backlog sequencing was UI-first and did not include desktop runtime/distribution foundation as first-class P0 work.
3. Requirements "Still Open" list still implied packaging model was undecided, despite locked architecture section.

## Changes Applied
1. `decision-log.md`
- Added D15:
  - single packaged desktop app model,
  - no side runtime installs for users,
  - desktop bridge/runtime boundary required,
  - browser/dev-server mode is dev-only.

2. `xlightsdesigner-dev-backlog-v1.md`
- Updated source references to v5 + desktop architecture checklist.
- Added new `E0` (P0): Desktop Runtime + Distribution Foundation.
- Re-sequenced suggested delivery to include E0 first.
- Updated immediate start tickets to prioritize runtime/persistence foundation.

3. `standalone-app-requirements.md`
- Updated "Still Open" section to mark packaging policy as resolved at policy level.
- Added alignment note linking packaging resolution to locked section 7.

## Current Alignment Status
- Architecture direction: aligned.
- Delivery sequencing: aligned to packaged-desktop-first foundation.
- Requirements/open-gap register: aligned at policy level.

## Remaining Open Items (intentionally unresolved implementation details)
- Updater provider/tooling selection and channel plumbing specifics.
- Diagnostics bundle schema versioning details.
- Support runbook ownership and SLA definition.
