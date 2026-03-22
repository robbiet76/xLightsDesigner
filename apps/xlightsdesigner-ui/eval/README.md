# Designer Eval Folder

This folder contains the offline eval corpus and runner for the deep designer-training phase.

Current contents:
- `designer-eval-cases-v1.json`: canonical tracked eval corpus
- `section-practical-sequence-validation-suite-v1.json`: deterministic section-scoped sequencer validation scenarios tied to the Stage 1 trained baseline
- `live-section-practical-sequence-validation-suite-v1.json`: live apply section-scoped sequencer validation scenarios that reuse the practical validation artifact
- `live-section-practical-sequence-validation-suite-v2.json`: promoted Phase 2 clean-baseline live section benchmark
- `live-section-practical-sequence-validation-canary-v1.json`: stable single-scenario live canary used to gate the combined benchmark runner
- `live-multisection-practical-sequence-validation-suite-v2.json`: promoted Phase 2 clean-baseline live multi-section benchmark
- `live-wholesequence-practical-validation-suite-v1.json`: promoted Phase 2 clean-baseline whole-sequence benchmark
- `live-revision-practical-sequence-validation-suite-v1.json`: first live revision-focused Phase 2 suite for bounded in-place concept edits
- `live-design-canary-suite-v1.json`: fastest one-prompt live canary scenarios for frequent iteration loops
- `live-design-validation-suite-smoke-v1.json`: fast canary live comparative scenarios for frequent iteration loops
- `live-design-validation-suite-v1.json`: canonical live comparative validation scenarios for real saved sequences, including scoped focus, stage-lighting, composition, motion-language, and render-discipline slices
- `live-design-validation-suite-extended-v1.json`: slower extended live pack that adds alternate saved-sequence coverage beyond the promoted baseline pack, including additional whole-pass composition checks on alternate saved-sequence families
- `run-designer-eval.mjs`: offline runner for the current designer runtime/orchestrator
- `run-section-practical-sequence-validation.mjs`: offline runner for the first sequencer-side practical validation pass
- `run-live-practical-benchmark.mjs`: one-command runner that executes the promoted section, multi-section, and whole-sequence live suites and emits a combined report
- `live-practical-benchmark-baseline.v1.json`: frozen Stage 1 practical benchmark baseline contract
- `compare-live-practical-benchmark.mjs`: compares a fresh combined live benchmark report against the frozen baseline contract
- `synthetic-metadata-fixture-v1.json`: synthetic metadata fixture used by metadata-aware eval cases

Current policy:
- use the frozen pre-training framework and handoff contract
- prefer offline validation over live apply during iterative designer training
- treat structural scorer output as the automated gate
- use comparative quality cases to ensure the scorer prefers stronger outputs over flatter but still valid alternatives
- use fixture-shift cases so the same prompt must adapt across alternate layouts and song arcs, not just one synthetic scene
- use the one-prompt canary suite on most iterations
- use the comparative live packs after offline changes are green to validate real-sequence preference behavior without apply-by-default
- use the smoke live pack as a checkpoint tool, not the default fast loop
- keep the promoted live baseline pack small enough to complete reliably
- use the extended live pack for slower alternate-sequence probes and broader cadence checks
- the desktop automation CLI now scales the live-suite timeout with scenario count so the extended pack can complete without manual timeout overrides
- the desktop live-suite runner now reuses `refreshFromXLights` and `analyzeAudio` work per `(sequencePath, analyzePrompt)` context instead of repeating that setup for every scenario on the same sequence
- use `run-live-practical-benchmark.mjs` as the Stage 1 practical gate once the clean `Phase2` baseline is loaded
- use the revision live suite to start Phase 2 bounded-edit validation without changing the frozen Stage 1 gate

Runner modes:
- `default`: normal single-output pass/fail eval
- `framework_assisted`: revise-in-place eval using app-equivalent merge semantics
- `paired_preference`: compare two director profiles on the same prompt
- `repeated_preference`: confirm stability across repeated preference-aware runs
- `paired_metadata`: confirm metadata changes actually change target selection
- `paired_fixture`: confirm layout or song-arc changes actually change target selection or section behavior
- `delete_regenerate`: remove one concept from a seeded draft, regenerate a scoped replacement, and confirm the rest of the draft survives unchanged
- `paired_quality`: compare a stronger prompt against a flatter alternative and require the scorer to prefer the stronger result

Practical benchmark command:

```bash
node apps/xlightsdesigner-ui/eval/run-live-practical-benchmark.mjs \
  --channel dev \
  --out-dir /tmp/live-practical-benchmark-phase2
```

Output:
- per-suite raw artifacts in the chosen output directory
- xLights refresh preflight artifact:
  - `refresh-from-xlights.json`
- section live canary preflight artifact:
  - `section-canary-suite.json`
- combined report:
  - `live-practical-benchmark-report.json`

Runner behavior:
- fails fast if `refresh-from-xlights` is only warning-level or otherwise unhealthy
- fails fast if the section live canary is not green before the full benchmark batch starts

Baseline comparison:

```bash
node apps/xlightsdesigner-ui/eval/compare-live-practical-benchmark.mjs \
  /tmp/live-practical-benchmark-phase2-final/live-practical-benchmark-report.json \
  apps/xlightsdesigner-ui/eval/live-practical-benchmark-baseline.v1.json
```

Phase 2 revision suite:

```bash
node scripts/desktop/automation.mjs \
  --channel dev \
  --result-file /tmp/live-revision-practical-sequence-validation-suite-v1.json \
  run-live-revision-practical-sequence-validation-suite \
  --payload-file apps/xlightsdesigner-ui/eval/live-revision-practical-sequence-validation-suite-v1.json
```
