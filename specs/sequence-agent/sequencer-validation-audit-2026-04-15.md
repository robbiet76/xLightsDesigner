# Sequencer Validation Audit

Status: Active  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Record the current validation evidence for the sequencer reset, training reset controller, and live batch acceptance path.

This is the audit companion to:

- [sequencer-validation-matrix-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-validation-matrix-2026-04-15.md)

## Current Evidence Snapshot

### 1. Surface Gate

Command run:

```bash
node --test \
  apps/xlightsdesigner-ui/tests/agent/sequence-agent/sequence-agent.test.js \
  apps/xlightsdesigner-ui/tests/agent/sequence-agent/translation-intent.test.js \
  apps/xlightsdesigner-ui/tests/agent/sequence-agent/trained-effect-knowledge.test.js \
  apps/xlightsdesigner-ui/tests/agent/sequence-agent/direct-sequence-orchestrator.test.js \
  apps/xlightsdesigner-ui/tests/agent/shared/effect-semantics-registry.test.js \
  apps/xlightsdesigner-ui/tests/eval/run-live-practical-benchmark.test.js \
  apps/xlightsdesigner-ui/tests/api.test.js
```

Latest result:

- `103/103` passed
- date: `2026-04-15`

Covers:

- sequence planning and realization
- translation intent inference
- trained effect recommendation constraints
- direct sequence orchestration
- effect semantics registry behavior
- benchmark evaluation logic
- owned API wrapper behavior

### 2. Tooling Gate

Command run:

```bash
node --test \
  scripts/sequencer-render-training/tooling/build-effect-setting-interaction-coverage-report.test.mjs \
  scripts/sequencer-render-training/tooling/build-sequencer-training-reset-report.test.mjs \
  scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.test.mjs \
  scripts/sequencer-render-training/tooling/build-effect-training-automation-plan.test.mjs
```

Latest result:

- `4/4` passed
- date: `2026-04-15`

Covers:

- settings coverage report generation
- automation plan generation
- interaction coverage report generation
- consolidated reset report generation

### 3. Unattended Reset Cycle Gate

Command run:

```bash
bash scripts/sequencer-render-training/runners/run-sequencer-training-reset-cycle.sh \
  --out-dir /tmp/sequencer-training-reset-batch-v1
```

Primary report:

- [sequencer-training-reset-report.json](/tmp/sequencer-training-reset-batch-v1/sequencer-training-reset-report.json)

Supporting artifacts:

- [effect-settings-coverage-report-v1.json](/tmp/sequencer-training-reset-batch-v1/artifacts/effect-settings-coverage-report-v1.json)
- [effect-training-automation-plan-v1.json](/tmp/sequencer-training-reset-batch-v1/artifacts/effect-training-automation-plan-v1.json)
- [effect-parameter-screening-plan-v1.json](/tmp/sequencer-training-reset-batch-v1/artifacts/effect-parameter-screening-plan-v1.json)
- [effect-setting-interaction-coverage-report-v1.json](/tmp/sequencer-training-reset-batch-v1/artifacts/effect-setting-interaction-coverage-report-v1.json)
- [runner.log](/tmp/sequencer-training-reset-batch-v1/runner.log)

Latest result:

- controller completed successfully
- `cleanRegenerationAllowed: false`

Current blockers recorded by the controller:

- `interaction_coverage_incomplete`
- `missing_parameter_interaction_record_generator`
- `missing_behavior_record_generator`
- `missing_parameter_record_generator`
- `missing_shared_setting_record_generator`

Interpretation:

- the unattended process is working correctly
- the clean regeneration path is correctly blocked
- current reset readiness is not being overstated

### 4. Live Batch Acceptance Gate

Primary report:

- [live-practical-benchmark-report.json](/tmp/live-practical-benchmark-native-suite-render-baseline-v8/live-practical-benchmark-report.json)

Latest known result:

- `scenarioCount: 10`
- `failedScenarioCount: 0`
- `ok: true`

Current live acceptance evidence:

- full owned automation path working
- render-feedback path working
- persisted artifacts observed during suite:
  - `intent_handoff_v1`
  - `plan_handoff_v1`
  - `apply_result_v1`
  - `render_observation_v1`
  - `sequence_render_critique_context_v1`

Supported surface status from the accepted baseline:

- `layoutModels: ok`
- `layoutScene: ok`
- `renderSamples: ok`

## Inventory Evidence

Current test inventory counts:

| Surface | Count |
| --- | ---: |
| sequence-agent JS suites | 26 |
| shared agent suites | 2 |
| eval suites | 3 |
| runtime suites | 31 |
| API suite files | 1 |
| macOS Swift test files | 9 |
| training tooling suites | 10 |

Important note:

- these counts are audit inventory, not acceptance results
- acceptance remains tied to the gates above, not raw file count

## Current Gaps

### Verified Gaps

- clean regeneration is still blocked because the interaction-aware record generators do not exist yet
- interaction coverage is not complete for the currently runnable reset surface

### Not Revalidated In This Audit Pass

- full macOS Swift suite was not rerun in this audit slice
- runtime-wide JS suite inventory was not rerun in this audit slice

Those are not current blockers for the sequencer reset controller itself, but they remain outside the fresh-evidence set recorded here.

## Current Decision

The correct next implementation work is:

- build the four canonical record generators
- extend interaction coverage until the unattended controller can truthfully allow a clean regeneration run
- keep using this audit format after each meaningful reset phase
