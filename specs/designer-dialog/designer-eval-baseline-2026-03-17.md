# Designer Eval Baseline

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: capture the first offline baseline against the canonical designer eval corpus so later training slices can be compared against a fixed starting point.

## Runner

- corpus: [designer-eval-cases-v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/designer-eval-cases-v1.json)
- runner: [run-designer-eval.mjs](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/run-designer-eval.mjs)
- metadata fixture: [synthetic-metadata-fixture-v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/synthetic-metadata-fixture-v1.json)

Command:

```bash
node apps/xlightsdesigner-ui/eval/run-designer-eval.mjs > /tmp/designer-eval-report.json
```

## Baseline Summary

- total cases: `25`
- supported by current offline runner: `19`
- passed: `14`
- failed: `5`
- deferred: `6`
- average structural score: `2.21`

Interpretation:
- the current designer baseline is already structurally acceptable on most supported concept, whole-pass, and preference cases
- the largest remaining offline gap is revise-case automation, not corpus coverage
- the current whole-pass weakness is family diversity in some broad-pass prompts
- the current concept weakness is still target/layout interpretation in a few concept prompts

## Failed Supported Cases

### 1. `concept-layout-foreground-background`

Observed failure:
- missing required foreground/background target behavior in the current plan

Implication:
- layout/depth reasoning is not yet dependable enough for this concept shape

### 2. `concept-lighting-key-fill`

Observed failure:
- target choice and language did not clearly support the requested key/fill framing

Implication:
- stage-lighting reasoning is still weak or too implicit in concept language

### 3. `whole-rhythm-led-build`

Observed failure:
- insufficient family diversity

Implication:
- broad rhythm-driven passes still collapse into too narrow a family set

### 4. `whole-perimeter-vs-center`

Observed failure:
- insufficient family diversity

Implication:
- layout-aware broad passes still need richer family selection

### 5. `whole-lighting-language-pass`

Observed failure:
- insufficient family diversity

Implication:
- stage-lighting-inspired broad passes are still flattening to too few families

## Deferred Cases

The `6` revise cases are defined in the corpus but currently marked `framework_assisted`.

Reason:
- full scoring of revise behavior still needs app-level revision orchestration so concept identity, supersede behavior, and unrelated-concept preservation can be measured through the actual revision path

Next step:
- automate revise-case scoring through the app revision flow without moving back into UI-driven testing

## Immediate Training Priorities

1. improve layout/depth reasoning for foreground/background and key/fill style prompts
2. improve broad-pass family diversity when prompts emphasize rhythm, layout framing, or lighting logic
3. automate offline revise-case scoring so the full corpus becomes promotable without manual exceptions
