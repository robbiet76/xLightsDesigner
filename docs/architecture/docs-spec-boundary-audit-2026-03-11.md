# Docs vs Specs Boundary Audit (2026-03-11)

Status: Completed  
Goal: classify repository documentation into authoritative implementation specs vs supporting/operational docs.

## Decision Rule
- `specs/`: normative contracts that define required behavior, constraints, interfaces, policies, and acceptance gates.
- `docs/`: supporting architecture context, proposals, audits, and operational runbooks/evidence.

## Reclassifications Applied
1. `docs/architecture/repo-structure-governance.md` -> `specs/repo-structure-governance.md`
- Reason: normative governance and placement rules.

2. `specs/xlights-sequencer-control-desktop-release-runbook.md` -> `docs/operations/xlightsdesigner-desktop-release-runbook.md`
- Reason: operational procedure, not product contract.

3. `specs/xlights-sequencer-control-desktop-validation-evidence-log.md` -> `docs/operations/xlightsdesigner-desktop-validation-evidence-log.md`
- Reason: runtime/release evidence ledger, not implementation contract.

## Current Classification

### Keep in `specs/` (authoritative)
- Project specs and API contracts
- Decision logs and acceptance matrices
- Architecture reset/execution plan
- Integration test harness contract
- Training package architecture
- Schemas and fixture manifest/env contract
- Governance and lifecycle policy docs

### Keep in `docs/` (supporting/operational)
- Architecture analyses and design proposals
- Project-level narrative docs and maintainer issue drafts
- Desktop release runbook and validation evidence logs

## Residual Notes
- Some archived files may contain references to moved active files; these are historical records and not considered active link targets.
- Future additions should use the same rule and be reflected in `specs/README.md` and relevant `docs/*/README.md`.
