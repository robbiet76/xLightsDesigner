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

## Exact Native Render-Feedback Gap

The native automation and apply path still reports missing owned routes:

- `layout.scene`
- `sequence.render-samples`

Confirmed surfaces:

- [NativeAutomationServer.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/NativeAutomationServer.swift)
- [apply-native-review.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencing/native/apply-native-review.mjs)
- [automation.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/desktop/automation.mjs)

Current behavior:

- `ownedRenderFeedbackCapabilities.fullFeedbackReady = false`
- `ownedRenderFeedbackCapabilities.missingRequirements = ["layout.scene", "sequence.render-samples"]`
- native apply succeeds in `plan_apply_validation_only` mode
- render-feedback persistence remains unavailable for real native runs

## Why This Matters

Without these routes, the system cannot complete the full translation loop:

1. infer intended behavior
2. plan realization
3. apply sequence changes
4. observe rendered result
5. critique rendered result
6. feed outcome back into ranking and training

That means current benchmark scoring is still strongest at:

- semantic alignment
- behavior intent alignment
- plan/apply artifact validation

It is still weak at:

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

## Pre-Batch Checklist

Before the first true recalibration batch run:

- [ ] finish native parity for `layout.scene`
- [ ] finish native parity for `sequence.render-samples`
- [ ] ensure native apply can persist:
  - `render_observation_v1`
  - `sequence_render_critique_context_v1`
- [ ] confirm validation snapshots surface those artifacts end to end
- [ ] reduce remaining family-first realization bias in `trained-effect-knowledge.js`
- [ ] reduce residual hardcoded family returns in `inferRevisionBriefEffectName()`

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

1. finish native render-feedback parity
2. reduce remaining family-first realization bias
3. run the full batch harness once
4. store the report as the post-cleanup baseline
5. only then start recalibration or retraining work

## Non-Goals

Do not do these before the batch baseline exists:

- scenario-by-scenario selector tuning as the main loop
- isolated training updates judged without full-batch drift
- new doctrine tables to compensate for removed bias

## Success Condition

This plan is complete when:

- native batch runs can observe and critique rendered output
- the batch harness produces a consolidated translation baseline report
- recalibration decisions are based on batch evidence instead of isolated scenario wins
