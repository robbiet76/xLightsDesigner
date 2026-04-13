# Spec Organization Audit

Status: Active
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Audit the current spec set after the recent additive planning work and define a cleaner operating structure without doing a risky bulk archive move in the same pass.

## Current Read

The spec tree is no longer random, but it is still too additive.

Main problems:
1. too many entry points at the root
2. domain READMEs are uneven in quality
3. canonical specs and supporting/reference specs are not clearly separated
4. older planning notes still sit beside current operating contracts
5. app UI specs contain a large amount of migration-era material that is still useful, but not equally important

## What Is Working

1. domain split is mostly right
- `app-assistant`
- `app-ui`
- `audio-analyst`
- `designer-dialog`
- `sequence-agent`

2. recent sequencing work is now structurally coherent
- POC boundary
- feedback loop
- geometry contract
- learning record
- critique
- revision gate
- artistic goal
- revision objective

3. native cutover and cross-platform boundary work is now clear enough to stand on its own

## Recommended Structure

Each domain should expose three layers:

1. `canonical`
- current operating contracts
- active architecture
- current roadmap/checklist

2. `supporting`
- audits still needed for daily work
- experiments that feed current work
- implementation notes that remain live

3. `reference`
- valuable older planning notes
- migration-era packages
- historical context not needed as a daily entry point

This pass does not physically move files.
It makes the categories explicit in the indexes first.

## Canonical Entry Points By Domain

### Root
- `specs/README.md`
- `current-app-plan-2026-04-05.md`
- `repo-structure-governance.md`
- this audit

### App UI
- `app-ui/README.md`
- `app-ui/native-cutover-audit-2026-04-10.md`
- `app-ui/native-app-architecture-diagram-2026-04-10.md`
- `app-ui/cross-platform-shell-boundary-2026-04-10.md`
- `app-ui/hybrid-cloud-learning-and-billing-2026-04-10.md`

### Designer Dialog
- `designer-dialog/README.md`
- `designer-dialog/designer-interaction-contract.md`
- `designer-dialog/sequencing-design-handoff-v2-spec-2026-03-19.md`
- `designer-dialog/director-profile-v1.md`
- `designer-dialog/display-metadata-v1-2026-04-08.md`
- `designer-dialog/music-design-context-v1.md`
- `designer-dialog/design-scene-context-v1.md`

### Sequence Agent
- `sequence-agent/README.md`
- `sequence-agent/sequencing-poc-boundary-2026-04-10.md`
- `sequence-agent/sequencing-feedback-loop-v1-2026-04-13.md`
- `sequence-agent/preview-scene-geometry-v1-2026-04-13.md`
- `sequence-agent/sequence-learning-record-v1-2026-04-13.md`
- `sequence-agent/sequence-critique-v1-2026-04-13.md`
- `sequence-agent/sequence-revision-gating-policy-v1-2026-04-13.md`
- `sequence-agent/sequence-artistic-goal-v1-2026-04-13.md`
- `sequence-agent/sequence-revision-objective-v1-2026-04-13.md`
- `sequence-agent/xlights-upstream-tracking-policy-2026-04-13.md`

## Immediate Cleanup Decisions

### Decision 1
Do not bulk-archive specs in this pass.

Reason:
- too much active work is still referencing older notes
- we need clearer indexes before we start moving files

### Decision 2
Trim the root `specs/README.md`.

Reason:
- it currently behaves like a dumping ground of links
- root should point to domain indexes and a small number of canonical docs only

### Decision 3
Upgrade domain READMEs so they explicitly separate:
- canonical
- supporting
- reference

### Decision 4
Treat recent sequencing specs as one coherent operating set.

Reason:
- they were created additively, but they now form a clear feedback architecture

## Next Cleanup Pass

Once the new indexes are stable, the next safe cleanup pass is:
1. archive or demote redundant migration-era `app-ui` package docs from the main entry path
2. archive older `designer-dialog` training phase notes that are no longer active
3. leave current sequencing feedback architecture docs visible and canonical

## Outcome

After this pass, the spec set should behave like:
- a navigable operating system
- not a junk drawer

That is the right intermediate state before deeper archival or consolidation.
