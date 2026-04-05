# Sequencer Quality And Training Checklist On Reviewed Timing Tracks

Owner: xLightsDesigner Team  
Date: 2026-04-02  
Status: Active, next phase

## Purpose

Define the next development phase after the timing-track workflow contract is in place.

This phase starts from a stricter boundary than earlier sequencer work:
- reviewed `XD:` timing tracks are now the sequencing substrate
- sequence generation and apply are blocked when required timing tracks are stale or user-edited and not yet accepted
- timing-track provenance now exists as:
  - `source`
  - `userFinal`
  - `diff`

The goal of this phase is to improve sequencing quality on top of that reviewed timing substrate instead of continuing ad hoc effect tuning.

## Upstream Dependency

This checklist assumes the timing-track workflow work is the current upstream contract:
- [timing-track-workflow-implementation-checklist-2026-04-02.md](/Users/robterry/Projects/xLightsDesigner/specs/audio-analyst/timing-track-workflow-implementation-checklist-2026-04-02.md)
- [timing-track-taxonomy-and-sequencing-uses-2026-04-05.md](/Users/robterry/Projects/xLightsDesigner/specs/audio-analyst/timing-track-taxonomy-and-sequencing-uses-2026-04-05.md)

That checklist now provides:
- complete-coverage `XD: Song Structure`
- complete-coverage phrase-level `XD:` timing track
- live readback into `userFinal`
- explicit review acceptance
- timing-review guardrails before sequence generation and apply
- a control validation harness for representative track classes

## Current Boundary

What is now fixed enough to depend on:

1. timing-track normalization
- no gaps
- no overlaps
- full coverage
- phrase segments split at structure boundaries
- unlabeled filler allowed where no logical phrase exists

2. timing provenance
- generated `source`
- current `userFinal`
- normalized `diff`
- status classification:
  - `unchanged`
  - `user_edited`
  - `stale`

3. sequencing guardrails
- if the current sequencing pass depends on reviewed timing tracks and those tracks are unresolved, generation/apply stops

Interpretation:
- timing tracks are now a real contract, not advisory metadata
- sequencer quality work can now assume a stable musical substrate
- structure and phrases are the first validated timing layers, with beats and bars as the next planned expansion

## Phase Goal

Move from:
- "the app can generate and review timing tracks"

to:
- "the sequence agent reliably uses reviewed timing tracks to create musically aligned, reviewable effect work"

## Non-Goals

Not in this phase:
- broad new audio-analysis heuristic expansion
- timing-track schema redesign
- wide UX redesign
- broad autonomy/orchestration expansion
- advanced personalization

Those should wait until sequencing quality on reviewed timing is stable.

## Required Sequencing Inputs

Sequencer work in this phase must explicitly consume:

1. reviewed `XD: Song Structure`
2. reviewed phrase-level `XD:` track when available
3. designer-to-sequencer handoff
4. validated target/effect semantics registries

The sequencer should not plan as if timing is provisional when a reviewed track exists.

Near-term sequencing expansion after the current live validation slice:

1. continue consuming reviewed structure and phrases first
2. prepare the sequencer to consume reviewed beats and bars next
3. treat beats and bars as the next highest-value timing substrate after the current two-track slice

## Control Set

Use a fixed four-track control set for the next phase:

1. synced-lyrics vocal
- `Candy Cane Lane`

2. plain-phrase-fallback vocal
- `Christmas Vacation - Mavis Staples`

3. vocal audio-only
- `Grinch`

4. instrumental audio-only
- `Christmas Sarajevo`

These same tracks should be reused across:
- timing validation
- live xLights roundtrip review
- sequence-generation evaluation
- revision evaluation

## Quality Questions This Phase Must Answer

### 1. Timing Consumption Fidelity
Does the sequencer actually use reviewed timing well?

Required checks:
- section-level placements respect reviewed structure boundaries
- phrase-aware placements prefer reviewed phrase regions when present
- adjacent section transitions align with timing boundaries rather than drifting
- effect ranges do not smear across reviewed boundaries without reason

### 2. Section Intent Fidelity
Does the output fit the section role?

Required checks:
- intro reads like intro
- chorus/refrain sections read stronger than verses where appropriate
- instrumental sections do not receive vocal-phrase behavior by mistake
- outro resolution is visually calmer or more final when intended

### 3. Targeting Fidelity
Does the output use the right props and support roles?

Required checks:
- lead/support/accent hierarchy is preserved
- full-yard activation is not used when brief/section intent does not support it
- phrase accents land on the intended prop family rather than arbitrary spread

### 4. Effect Realization Quality
Are emitted effects merely valid, or visually credible?

Required checks:
- effect family matches intended musical role
- settings stay in visually sane ranges
- transitions are not mechanically correct but aesthetically wrong
- repeated sections do not collapse into identical-looking output unless intended

### 5. Revision Discipline
Can the sequencer edit locally without destabilizing the rest of the song?

Required checks:
- revise one section while preserving neighboring sections
- strengthen chorus without wiping the full sequence plan
- calm a noisy section without flattening the entire look
- preserve reviewed timing dependency while revising effect work

## Workstreams

### A. Live Timing-Track Roundtrip Validation
Complete the live xLights loop that is still pending from the timing workflow checklist.

Checklist:
- [ ] write `XD: Song Structure` into live xLights for the 4-track control set
- [ ] write phrase-level `XD:` timing track where available
- [ ] visually inspect timing in xLights
- [ ] make manual timing edits in xLights
- [ ] refresh `userFinal` from xLights
- [ ] verify `diff` correctness on live edited marks
- [ ] accept reviewed timing and verify status returns to `unchanged`

Exit criteria:
- live xLights timing roundtrip is proven on all 4 control tracks

### B. Sequencer Timing-Fidelity Evaluation
Measure whether sequence generation respects reviewed timing.

Checklist:
- [ ] define timing-fidelity assertions for section boundaries
- [ ] define phrase-usage assertions when phrase track exists
- [ ] add timing-aware checks to practical sequence validation output
- [ ] classify failures as:
  - [ ] timing ignored
  - [ ] timing partially respected
  - [ ] timing respected but effect choice weak
- [ ] run the control set through the sequencer using reviewed timing

Exit criteria:
- failures clearly distinguish timing-consumption problems from effect-quality problems

### C. Sequencer Quality Control Suite
Create a small sequencing validation suite grounded in reviewed timing tracks.

Checklist:
- [ ] define one first-pass sequencing scenario per control track
- [ ] define one bounded revision scenario per control track where applicable
- [ ] persist expected validation fields in a repeatable suite artifact
- [ ] add a runner that produces machine-readable results and issue categories
- [ ] record baseline report for the current system

Exit criteria:
- sequencing quality can be compared run-to-run on a fixed reviewed-timing corpus

### D. Effect-Realization Audit On Timing Substrate
Now that timing is stable, audit effect quality instead of timing mechanics.

Checklist:
- [ ] review effect-family choice on the control set
- [ ] review parameter realism on the control set
- [ ] review transition behavior across reviewed section boundaries
- [ ] review phrase accent behavior where phrase timing exists
- [ ] identify the first narrow effect-family training set to improve

Recommended first effect-family focus after this audit:
- `On`
- `SingleStrand`
- `Color Wash`
- `Shimmer`
- `Bars`
- `Wave`

Exit criteria:
- next effect-training slice is chosen from live sequencing evidence, not guesswork

### E. Revision-Behavior Harness
Treat the sequencer as an editor, not only a generator.

Checklist:
- [ ] add at least one revise-in-place scenario on the control set
- [ ] verify revision preserves unaffected sections
- [ ] verify revision does not require timing regeneration when timing is already reviewed
- [ ] classify revision failures separately from first-pass failures

Exit criteria:
- bounded revisions can be evaluated without ambiguity

## Required Reporting

Every sequencing eval artifact in this phase should record:
- track identity
- timing review status for required `XD:` tracks
- whether phrase track existed and was reviewed
- designer handoff summary
- generated commands summary
- validation issues
- issue classification
- whether failure is primarily:
  - timing substrate
  - designer handoff
  - sequencer planning
  - effect realization
  - xLights transport/readback

## Recommended Execution Order

### Phase 1
- complete live timing-track roundtrip validation
- add timing-fidelity assertions to sequencing eval
- baseline the 4-track control set

### Phase 2
- run first-pass sequencing audit on the control set
- identify the top 2-3 effect-family realization failures
- add bounded revision scenarios

### Phase 3
- use those findings to reopen effect-training work
- keep the reviewed timing contract fixed while training effect implementation quality

## Gating Policy

Do not start broader effect-training changes until all of these are true:
- reviewed timing roundtrip is proven live on the control set
- timing-fidelity checks exist in sequencing eval
- first sequencing baseline report exists on the reviewed-timing control set
- failures are separated into timing vs effect-realization categories

## Immediate Next Checklist

1. live xLights roundtrip on the 4-track control set
2. timing-aware sequencing validation assertions
3. first reviewed-timing sequencing baseline report
4. narrow effect-family audit from that report
5. only then resume deeper sequencer-agent training work
