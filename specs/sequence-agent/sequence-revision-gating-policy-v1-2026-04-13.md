# Sequence Revision Gating Policy v1

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define how Patch should decide:
- whether the current checkpoint is ready to descend
- which critique level owns the next revision batch
- when lower-level refinement must be blocked

This turns the critique ladder into an operational revision policy.

## References

- [sequencing-feedback-loop-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencing-feedback-loop-v1-2026-04-13.md)
- [sequence-critique-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-critique-v1-2026-04-13.md)
- [sequence-learning-record-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-learning-record-v1-2026-04-13.md)

## Core Rule

Patch must always revise at the highest unresolved ladder level.

Allowed ladder order:
1. `macro`
2. `section`
3. `group`
4. `model`
5. `effect`

If a higher level is unstable:
- do not descend
- do not spend xLights checkpoints on lower-level polish

## Decision Output

The gating decision should produce:

```json
{
  "artifactType": "sequence_revision_gate_v1",
  "artifactVersion": 1,
  "highestFailingLevel": "macro|section|group|model|effect|none",
  "decision": "revise_here|descend|hold",
  "nextOwner": "designer|sequencer|shared|none",
  "nextRevisionLevel": "macro|section|group|model|effect|none",
  "blockingReasons": [],
  "recommendedMoves": []
}
```

## Macro Gate

Macro is unstable when any of these is true:
- `focusRead = narrow`
- `familyBalanceRead = single_family` when broader support is expected
- `compositionRead = split`
- macro critique emits unresolved weaknesses about:
  - overall spread
  - scene clutter/restraint
  - focal hierarchy
  - scene-wide split composition

Decision:
- `revise_here`
- owner:
  - `designer` if the issue is concept/staging/focal strategy
  - `sequencer` if the issue is spread/support execution
  - `shared` if both are implicated

Block:
- section, group, model, and effect refinement

## Section Gate

Section may only run if macro is stable enough.

Section is unstable when any of these is true:
- `ladderLevel = section` and critique reports:
  - flat section development
  - weak opening/middle/closing evolution
  - unstable section idea
  - section split composition

Decision:
- `revise_here`
- owner:
  - `designer` for section-intent/evolution issues
  - `sequencer` for section execution pacing/density evolution
  - `shared` if both are implicated

Block:
- group, model, and effect refinement

## Group Gate

Group may only run if section is stable enough.

Group is unstable when:
- focal/support/background roles are unclear
- supporting families overpower the lead
- key prop groups are competing incorrectly

Decision:
- `revise_here`

Block:
- model and effect refinement

## Model Gate

Model may only run if group is stable enough.

Model is unstable when:
- local model behavior is awkward, distracting, or conflicting
- isolated models break the established section/group intent

Decision:
- `revise_here`

Block:
- effect refinement

## Effect Gate

Effect is the last rung.

Only descend here when:
- macro is stable
- section is stable
- group is stable
- model is stable

Typical work:
- parameter tuning
- transition cleanup
- local color/effect nuance

## Owner Rule

Use this default mapping:

- `designer`
  - concept is wrong
  - section idea is wrong
  - focal map is wrong
  - support roles are wrong

- `sequencer`
  - the idea is right but execution is wrong
  - spread, density, timing, or support application needs revision

- `shared`
  - the critique implies both concept and execution are unstable

## Current Proof-Driven Guidance

Based on the current proofs:

### Macro examples

- `treeflat_sparse_macro`
  - highest failing level: `macro`
  - reason: too narrow, single-family
  - next owner: `shared`

- `treeflat_archsingle_composite_macro`
  - highest failing level: `macro`
  - reason: broad enough but split
  - next owner: `designer`

- `archsingle_matrixlowdensity_balanced_macro`
  - macro considered stable enough to descend

### Section examples

- `treeflat_archsingle_section_split`
  - highest failing level: `section`
  - reason: multi-idea section read
  - next owner: `designer`

- `archsingle_matrixlowdensity_section_balanced`
  - highest failing level: `section`
  - reason: section evolution too flat over time
  - next owner: `shared`

## Current POC Recommendation

During the current POC:
- make the gating decision explicit after every critique
- store it alongside the learning record
- use it to suppress lower-level revision proposals

That keeps sequencing iteration disciplined while xLights checkpoints remain expensive.
