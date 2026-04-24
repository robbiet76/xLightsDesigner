# Sequencer Validation Matrix

Status: Active  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Define the required validation gates for sequencer architecture, training reset work, regeneration readiness, and live sequencing acceptance.

This spec exists so validation scope is not chosen ad hoc.
Every meaningful sequencing change must map to an explicit test layer, expected evidence, and acceptance gate.

## Core Principle

Validation is split across four layers:

1. surface tests
2. tooling and artifact tests
3. unattended reset-cycle evidence
4. live batch acceptance

No single layer is enough on its own.

## Validation Layers

| Layer | Scope | Typical Trigger | Required Evidence | Acceptance Role |
| --- | --- | --- | --- | --- |
| `L1 Surface` | changed modules and contracts | code changes in runtime, planner, API, or tooling | direct unit/integration test pass | proves local correctness |
| `L2 Tooling` | generated artifacts and builders | training, regeneration, or reporting changes | builder tests and artifact output | proves artifact logic |
| `L3 Reset Cycle` | unattended training reset readiness | any change to training reset process or regeneration prerequisites | one unattended controller run and consolidated reset report | proves whether clean regeneration is actually allowed |
| `L4 Live Batch` | real end-to-end sequencing quality and persistence | runtime sequencing, selector, automation, render-feedback changes | full live batch report | proves production-path acceptance |

## Canonical Gates

### Gate A: Surface Gate

Required when:

- changing `sequence-agent`
- changing `translation-intent`
- changing effect semantics/runtime logic
- changing owned API wrappers
- changing evaluation logic

Canonical suites:

- [sequence-agent.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/sequence-agent/sequence-agent.test.js)
- [translation-intent.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/sequence-agent/translation-intent.test.js)
- [trained-effect-knowledge.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/sequence-agent/trained-effect-knowledge.test.js)
- [direct-sequence-orchestrator.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/sequence-agent/direct-sequence-orchestrator.test.js)
- [effect-semantics-registry.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/shared/effect-semantics-registry.test.js)
- [run-live-practical-benchmark.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/eval/run-live-practical-benchmark.test.js)
- [api.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/api.test.js)

Minimum command:

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

### Gate B: Tooling Gate

Required when:

- changing training tooling
- changing planning/report builders
- changing reset controller/reporting

Canonical suites:

- [build-effect-settings-coverage-report.test.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.test.mjs)
- [build-effect-training-automation-plan.test.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-effect-training-automation-plan.test.mjs)
- [build-effect-setting-interaction-coverage-report.test.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-effect-setting-interaction-coverage-report.test.mjs)
- [build-sequencer-training-reset-report.test.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-sequencer-training-reset-report.test.mjs)

Minimum command:

```bash
node --test \
  scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.test.mjs \
  scripts/sequencer-render-training/tooling/build-effect-training-automation-plan.test.mjs \
  scripts/sequencer-render-training/tooling/build-effect-setting-interaction-coverage-report.test.mjs \
  scripts/sequencer-render-training/tooling/build-sequencer-training-reset-report.test.mjs
```

### Gate C: Unattended Reset Cycle Gate

Required when:

- changing training reset flow
- changing regeneration prerequisites
- changing interaction coverage logic
- changing canonical training record contracts

Canonical controller:

- [run-sequencer-training-reset-cycle.sh](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/runners/run-sequencer-training-reset-cycle.sh)

Canonical report:

- `sequencer_training_reset_report_v1`

Minimum command:

```bash
bash scripts/sequencer-render-training/runners/run-sequencer-training-reset-cycle.sh \
  --out-dir /tmp/sequencer-training-reset-batch
```

Required outputs:

- `effect_settings_coverage_report_v1`
- `effect_training_automation_plan_v1`
- `effect_parameter_screening_plan_v1`
- `effect_setting_interaction_coverage_report_v1`
- `sequencer_training_reset_report_v1`

Acceptance rule:

- a run is valid only if the controller completes and emits the consolidated reset report
- a clean regeneration run is permitted only when the report says:
  - `interactionCoverageReady = true`
  - `recordGeneratorsReady = true`
  - `cleanRegenerationAllowed = true`

### Gate D: Live Batch Acceptance Gate

Required when:

- changing runtime sequencing behavior
- changing owned automation path
- changing render-feedback path
- changing selector/runtime bundles
- changing anything that can alter live proposal/apply/render outcomes

Canonical controller:

- [run-live-practical-benchmark.mjs](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/run-live-practical-benchmark.mjs)

Canonical report:

- `live_practical_benchmark_run_v2`

Required acceptance evidence:

- scenario count
- failed scenario count
- supported surface status
- persisted apply/render artifacts

Acceptance rule:

- active suite must complete with `failedScenarioCount = 0`
- supported surface must show:
  - `layoutModels: ok`
  - `layoutScene: ok`
  - `renderSamples: ok`

### Gate E: Native Agent Handoff Gate

Required when:

- changing native design-intent authoring
- changing app metadata that feeds sequencing
- changing proposal bundle handoff contracts
- changing review apply or render automation
- changing xLights launch/modal handling used by unattended validation

Canonical runner:

- [run-full-handoff-validation.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/native/run-full-handoff-validation.mjs)

Minimum command:

```bash
node scripts/native/run-full-handoff-validation.mjs
```

Broader current-layout coverage:

```bash
node scripts/native/run-full-handoff-validation.mjs --matrix
```

Default scenario file:

- [full-handoff-validation-scenarios.json](/Users/robterry/Projects/xLightsDesigner/scripts/native/full-handoff-validation-scenarios.json)

The default matrix covers explicit model target, explicit group target, and tag-only metadata selection. Tag-only validation seeds app metadata for an expected target, then generates from selected tags without putting that target name in the saved design intent.

Section-scoped validation must follow the timing-track agnostic contract in [timing-track-section-scope-audit-2026-04-24.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/timing-track-section-scope-audit-2026-04-24.md). Do not assume `XD: Song Structure` is the only valid section source.

Acceptance rule:

- native automation must be reachable on `49916`
- owned xLights API must be ready on `49915`
- validation must create or open an isolated sequence under the linked show folder
- app metadata target intent must be visible in the native validation snapshot
- generated proposal scope must include the requested target ids and metadata tags
- tag-only scenarios must prove the generated scope came from selected app metadata tags rather than explicit target text
- when apply is enabled, review apply must emit a fresh successful apply artifact
- when render is enabled, xLights render automation must complete

## Change-Class Matrix

| Change Class | Gate A | Gate B | Gate C | Gate D | Gate E |
| --- | --- | --- | --- | --- | --- |
| sequence planner/runtime logic | required | optional unless tooling touched | optional | required | required when native handoff surface changes |
| effect semantics / trained ranking logic | required | optional unless tooling touched | optional | required | optional unless handoff contracts change |
| owned API wrapper / render-feedback path | required | optional | optional | required | required |
| native metadata / design-intent handoff | required when runtime contracts change | optional | optional | optional unless live sequencing changes | required |
| training tooling / builders | optional if runtime untouched | required | required | optional unless runtime outputs change | optional |
| reset-plan / regeneration-flow logic | optional | required | required | not required until runtime outputs change | optional |
| regenerated selector bundles | required | required | required | required | required when used by native proposal flow |

## Current Inventory Counts

These are inventory counts, not acceptance results.

| Surface | Current Count |
| --- | ---: |
| sequence-agent JS suites | 26 |
| shared agent suites | 2 |
| eval suites | 3 |
| runtime suites | 31 |
| API suite files | 1 |
| macOS Swift test files | 9 |
| training tooling suites | 10 |

## Audit Requirement

Every significant sequencing phase must have a matching audit artifact that records:

- what was run
- what report paths were produced
- what passed
- what is blocked
- what remains unverified

Canonical audit companion:

- [sequencer-validation-audit-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-validation-audit-2026-04-15.md)
