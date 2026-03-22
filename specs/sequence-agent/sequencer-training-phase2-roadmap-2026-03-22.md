# Sequencer Training Phase 2 Roadmap

Status: Proposed  
Date: 2026-03-22  
Owner: xLightsDesigner Team

## Purpose
Define the next training phase after Stage 1 render training and the Stage 1 practical live sequencer benchmark are green.

This phase is not layered-effect training yet.

This phase is:
- practical sequencer quality expansion
- stronger validation coverage
- better design-fidelity measurement
- better revision behavior
- more reliable benchmark automation

## Entry Criteria
Phase 2 starts only because the current baseline is green.

Required baseline:
- Stage 1 render-training coverage complete
- Stage 1 render-training equalization complete
- sequencer wired to Stage 1 training bundle
- live practical benchmark green against clean `Phase2`

Current frozen baseline:
- [live-practical-benchmark-baseline.v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/live-practical-benchmark-baseline.v1.json)
- benchmark runner:
  - [run-live-practical-benchmark.mjs](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/run-live-practical-benchmark.mjs)
- benchmark comparator:
  - [compare-live-practical-benchmark.mjs](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/compare-live-practical-benchmark.mjs)

Current green benchmark:
- section suite: `10/10`
- multi-section suite: `6/6`
- whole-sequence suite: `4/4`
- gap report: `0`

## Phase Goal
Move from "the sequencer works on the promoted benchmark corpus" to "the sequencer is robust across broader practical sequencing situations and revisions while staying inside the benchmark guard."

## Non-Goals
Not in this phase:
- layered-effect training
- large new render-training expansion
- open-ended designer-language expansion
- personalization or preference learning beyond narrow controlled signals
- broad user-facing UX redesign

Those should wait until this phase is stable.

## Workstreams

### 1. Practical Benchmark Expansion
Broaden the live benchmark beyond the current promoted set.

Add:
- more section scenarios per effect family
- more multi-section transition scenarios
- alternate model-role mappings on the same musical function
- alternate layout/focus variants
- negative cases where the wrong family must be rejected

Required outputs:
- `live-section-practical-sequence-validation-suite-v3`
- `live-multisection-practical-sequence-validation-suite-v3`
- `live-wholesequence-practical-validation-suite-v2`

Exit target:
- benchmark breadth grows without losing the green baseline gate

### 2. Design Fidelity Validation
Strengthen measurement of whether the sequencer followed the designer brief, not just whether effects were present.

Expand checks for:
- lead/support/accent role fidelity
- focus hierarchy fidelity
- transition intent fidelity
- density target fidelity
- avoidances respected
- execution latitude respected

Required outputs:
- richer `practical_sequence_validation_v1` summaries
- more specific `sequencer_gap_report_v1` issue classification

Exit target:
- failures tell us exactly whether the problem is:
  - designer normalization
  - sequencer planning
  - apply transport
  - readback/validation

### 3. Revision Training
Teach and validate the sequencer as an editor, not only a first-pass generator.

Required scenarios:
- make chorus bigger without rewriting everything
- calm a noisy bridge
- preserve lead prop while changing support texture
- revise one section while keeping neighboring sections coherent
- regenerate a deleted concept without collapsing the rest of the plan

Required outputs:
- revision live suites
- revision-specific gap reports

Exit target:
- the sequencer can perform bounded revisions reliably

### 4. Whole-Sequence Coherence
Expand from a first whole-sequence slice into stronger full-song evaluation.

Add checks for:
- arc consistency
- contrast between adjacent sections
- repeated effect overuse
- unresolved texture carryover
- payoff strength at final chorus
- outro resolution quality

Required outputs:
- whole-sequence comparative suites with stronger "better vs flatter" pairs
- sequence-level diversity and overuse metrics

Exit target:
- whole-song quality is measured beyond basic pass/fail application

### 5. Runtime Reliability Hardening
Continue reducing false failures in live benchmarking.

Known focus areas:
- xLights endpoint stability
- desktop runtime stability after restart
- proxy/direct endpoint fallback discipline
- readback robustness when one API call returns malformed data

Required outputs:
- stronger runner preflight
- cleaner failure messages
- less time wasted on infrastructure noise

Exit target:
- live benchmark failures are mostly real sequencing failures, not harness noise

### 6. Internal Lighting Language Foundation
Begin formalizing the symbolic language that later whole-sequence evaluation and LLM-guided critique will use.

First scope:
- section purpose tokens
- prop role tokens
- motion family tokens
- density tokens
- transition tokens
- outcome critique tokens

This is foundation work only.

Required outputs:
- initial lighting-language spec
- mapping notes from:
  - designer handoff fields
  - practical validation fields
  - render-derived family names

Exit target:
- sequence state and critique can be represented in a compact symbolic layer

## Execution Order

### Phase 2A
Immediate next slice:
- benchmark expansion
- design fidelity expansion
- runtime reliability hardening

Reason:
- this increases confidence without changing the system boundary

### Phase 2B
Next slice:
- revision training
- stronger whole-sequence coherence checks

Reason:
- this is the next practical user value after first-pass generation

### Phase 2C
Foundation slice:
- internal lighting-language spec
- symbolic sequence critique representation

Reason:
- this sets up later LLM-driven sequence review and improvement

## Gating Policy
Every change in this phase must stay behind the frozen Stage 1 practical guard.

Required gate:
```bash
node apps/xlightsdesigner-ui/eval/run-live-practical-benchmark.mjs \
  --channel dev \
  --out-dir /tmp/live-practical-benchmark-current

node apps/xlightsdesigner-ui/eval/compare-live-practical-benchmark.mjs \
  /tmp/live-practical-benchmark-current/live-practical-benchmark-report.json \
  apps/xlightsdesigner-ui/eval/live-practical-benchmark-baseline.v1.json
```

If this comparator is red:
- do not treat the change as acceptable
- capture the gap
- fix or explicitly rebaseline

## Recommended Immediate Backlog
1. Add revision-focused live suites.
2. Expand design-fidelity checks beyond current effect/target assertions.
3. Add whole-sequence overuse and contrast metrics.
4. Add a structured Phase 2 issue ledger fed by `sequencer_gap_report_v1`.
5. Draft the initial internal lighting-language spec.

## Exit Criteria
Phase 2 is complete when:
- the expanded practical benchmark is green
- revision suites are green
- whole-sequence comparative suites are green
- failure classification is mostly signal, not harness noise
- the initial lighting-language spec exists and is grounded in live artifacts

Only after that should the project start:
- layered-effect training
- broader designer-language expansion
- more ambitious sequence-autonomy work
