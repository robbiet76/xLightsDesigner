# Render Feedback Parity And Batch Baseline Plan

Status: Active
Date: 2026-04-15
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-15

## Purpose

Define the exact blockers that still prevent full translation-layer scoring and set the order for the first batch baseline run after the current bias cleanup.

This is the execution companion to:

- [translation-layer-training-plan-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-layer-training-plan-2026-04-15.md)
- [visual-behavior-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/visual-behavior-v1-2026-04-15.md)
- [translation-intent-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-intent-v1-2026-04-15.md)
- [sequencing-bias-audit-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencing-bias-audit-2026-04-15.md)

## Current Reality

The system now has:

- cleaned translation-intent seams
- reduced designer-dialog doctrine
- reduced sequencing doctrine in active planning
- a native practical benchmark that can validate plan/apply behavior

The system still does not have full rendered-output validation.

That is the main blocker before batch recalibration can become the primary loop.

## Native Render-Feedback Status

The owned render-feedback surface is now live end to end.

Confirmed surfaces:

- [NativeAutomationServer.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/NativeAutomationServer.swift)
- [apply-native-review.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencing/native/apply-native-review.mjs)
- [automation.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/desktop/automation.mjs)

Current live validation status:

- `layout.scene` is live
- `sequence.render-samples` is live
- native apply persists:
  - `render_observation_v1`
  - `sequence_render_critique_context_v1`
- batch render-feedback capability probing had one false negative:
  - the probe sent empty `channelRanges`
  - the owned API correctly returned `400 channelRanges is required`
  - this is a probe bug, not a missing capability

## Why This Matters

With these routes in place, the system can complete the full translation loop:

1. infer intended behavior
2. plan realization
3. apply sequence changes
4. observe rendered result
5. critique rendered result
6. feed outcome back into ranking and training

Current benchmark scoring is still strongest at:

- semantic alignment
- behavior intent alignment
- plan/apply artifact validation

It is still weaker at:

- actual visual translation quality

## Remaining Quarantined Realization Bias

The current realization layer still has family-first bias in:

- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)

Main active surfaces:

- `EFFECT_KEYWORDS`
- `VISUAL_FAMILY_EFFECT_MAP`
- `recommendTrainedEffects()`
- `recommendTrainedEffectsForVisualFamilies()`

Current issue:

- effect names and family labels still provide the strongest realization hints
- behavior-capability evidence is not yet the dominant ranking language
- multiple valid realizations are still collapsed too early

## Post-Baseline Status

The first full post-cleanup batch baseline now exists:

- [live-practical-benchmark-report.json](/tmp/live-practical-benchmark-native-suite-render-baseline/live-practical-benchmark-report.json)

Batch result:

- `scenarioCount: 10`
- `failedScenarioCount: 5`

The current failures are translation-quality failures, not automation failures.

Observed failure shape:

- family selection is often correct
- behavior realization still misses on:
  - texture
  - coverage
  - energy

Examples:

- `section_case_001`
  - matched `Spirals`
  - missed `primaryTexture` and `coverageLevel`
- `section_case_007`
  - matched `On`
  - missed `primaryTexture` and `energyLevel`
- `section_case_008`
  - matched `Pinwheel`
  - missed `primaryTexture`
- `section_case_009`
  - matched `Shockwave`
  - missed `primaryTexture`

Follow-up batch after translation-intent cleanup:

- [live-practical-benchmark-report.json](/tmp/live-practical-benchmark-native-suite-render-baseline-v2/live-practical-benchmark-report.json)

Result:

- `scenarioCount: 10`
- `failedScenarioCount: 0`

Meaning:

- the first post-cleanup batch failures were resolved by removing negative-clause leakage from translation-intent behavior inference
- this was a translation-layer correction, not an automation workaround
- the current remaining discrepancy is the stale render-sample capability probe on the running native app process, which still needs a process restart to reflect the updated probe body

## Current Checklist

- [x] rebuild/revalidate the running xLights binary with owned `layout.scene`
- [x] verify owned `sequence.render-samples` is live on the rebuilt binary
- [x] ensure native apply can persist:
  - `render_observation_v1`
  - `sequence_render_critique_context_v1`
- [x] confirm validation snapshots surface those artifacts end to end
- [ ] fix the capability probe false negative for `sequence.render-samples`
- [ ] reduce remaining family-first realization bias in `trained-effect-knowledge.js`
- [ ] remove remaining residual hardcoded family fallback in revision realization
- [ ] run the next full batch after the realization changes and compare drift against the baseline

## Batch Harness Requirements

The first recalibration run must use one batch harness and emit one consolidated report.

Required characteristics:

- whole active scenario batch, not isolated spot checks
- fixed input suite version
- report includes:
  - per-scenario translation intent
  - per-scenario behavior assertions
  - per-scenario realized family/settings summary
  - render-feedback capability status
  - render-observation summary where available
  - critique summary where available
- report includes whole-batch aggregates:
  - pass/fail counts
  - contradiction counts
  - repeated-family overuse patterns
  - unresolved capability gaps

## Baseline Run Order

1. fix the capability probe false negative
2. reduce remaining family-first realization bias
3. run the full batch harness again
4. compare against the stored post-cleanup baseline
5. only then start recalibration or retraining work

## Non-Goals

Do not do these before the batch baseline exists:

- scenario-by-scenario selector tuning as the main loop
- isolated training updates judged without full-batch drift
- new doctrine tables to compensate for removed bias

## Success Condition

This plan is complete when:

- native batch runs can observe and critique rendered output without false capability negatives
- the batch harness produces repeatable consolidated baseline reports
- recalibration decisions are based on batch evidence instead of isolated scenario wins
