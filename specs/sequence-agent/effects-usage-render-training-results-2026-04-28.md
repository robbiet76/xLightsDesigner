# Effects Usage Render Training Results

Status: Current readout  
Date: 2026-04-28  
Owner: xLightsDesigner Team  

## Source Prompt

> Display metadata should not impact this process. This is effect training using standard models from xlights. Display metadata is a separate layer of learning.

## Scope Boundary

This readout covers the render-backed effect-training layer only. It uses standard xLights render-training models and representative palette modes. It does not use project display metadata, production-show display semantics, or user intent tags.

Display metadata remains a separate layer that maps project-specific targets to user intent. Effect training answers a different question: how xLights effects and settings behave visually when rendered on standard model geometries.

## Run Evidence

Combined run root:

`var/logs/sequencer-effects-usage-training-runs/overnight-combined-20260428T025101Z-030630Z`

Learning gate:

- promotion ready: true
- blockers: none
- packs: 24
- passed samples: 236
- failed samples: 0
- usable records: 214
- blank records: 0
- derived priors: 238
- priors with behavior rules: 118
- behavior rules: 573
- flat or inconclusive priors: 120
- palette modes: `mono_white`, `rgb_primary`

Palette split:

- `mono_white`: 107 records, 119 derived priors, 59 priors with rules, 180 behavior rules
- `rgb_primary`: 107 records, 119 derived priors, 59 priors with rules, 393 behavior rules

## Promoted Knowledge

Selector-ready parameter-prior effects:

- Bars
- Color Wash
- Marquee
- On
- Pinwheel
- Shimmer
- Shockwave
- SingleStrand
- Spirals
- Twinkle

Behavior-capability records exist for 18 effects:

- Bars
- Butterfly
- Circles
- Color Wash
- Fire
- Fireworks
- Lightning
- Marquee
- On
- Pinwheel
- Shimmer
- Shockwave
- SingleStrand
- Snowflakes
- Spirals
- Strobe
- Twinkle
- Wave

The key maturity split is that behavior records can describe observed capability at a broader level, while selector-ready derived priors provide setting-level guidance the sequencer can use to configure an effect.

## Learned Setting Behavior Examples

The run produced measurable setting-impact rules, including:

- `On.shimmer` increases motion/color/brightness rhythm for single-color behavior and decreases dominant color stability in multi-color behavior.
- `Marquee.skipSize` decreases coverage on grouped arch geometry in both single-color and multi-color representative modes.
- `Shimmer.useAllColors` increases color band density and decreases dominant color stability in multi-color behavior.
- `Shimmer.dutyFactor` changes color band density and dominant color stability in multi-color behavior.
- `SingleStrand.chaseSize` and `SingleStrand.cycles` increase coverage on single-line/arch geometry.

These are setting-behavior observations, not fixed effect roles. The sequencer should use them to decide how to configure effects for a need.

## Maturity By Effect

- Strongest setting-level coverage: Color Wash, Marquee, Shimmer, Shockwave, Twinkle.
- Useful but still uneven: Bars, Butterfly, Circles, Fire, Fireworks, Lightning, Snowflakes, Spirals, Strobe, Wave.
- Selector-ready but many flat/inconclusive priors remain: On, Pinwheel, SingleStrand.

Current flat/inconclusive pressure:

- SingleStrand: 60 flat priors out of 72
- Pinwheel: 20 flat priors out of 32
- Spirals: 14 flat priors out of 32
- On: 12 flat priors out of 20
- Bars: 6 flat priors out of 14

## Sampling Audit

Latest sampling audit:

`scripts/sequencer-render-training/catalog/effect-sampling-audit-v1.json`

Status counts:

- `causal_ready`: 66
- `missing`: 16
- `needs_anchor_completion`: 4
- `needs_causal_anchor_confirmation`: 3
- `observed_flat_or_inconclusive`: 12
- `under_sampled`: 3

Next sampling queue count: 38.

The main blocker to better effect taste is not lack of sequence coverage. It is that too many effect settings still do not have clean one-parameter causal anchor evidence. Interaction evidence is useful, but it is weaker than focused anchors for reasoning about how one setting changes the render.

## Ranked Remaining Gaps

1. Focused causal anchors are missing for many high-value settings. The next run should prioritize one-parameter sweeps for current high-use effects before expanding too broadly.
2. Several existing effects have interaction-derived trends that need causal confirmation: Pinwheel speed; Shockwave center/radius/cycles; Spirals count/movement/rotation/thickness; Twinkle count/steps/strobe.
3. New effect families now have first-pass selector-ready priors, but many secondary settings still need focused anchors.
4. Some sampled ranges need repair because current anchors include too many blank or dead outputs, especially Color Wash fade variants.
5. SingleStrand has broad parameter surface area but too many flat priors. It needs targeted reduction to the settings that actually change observed behavior.

## Next Training Expansion

The next effect-training run should stay on the render-training display and use the same palette protocol:

- `mono_white` as the representative single-color mode
- `rgb_primary` as the representative multi-color mode

Priority order:

1. Repair current-effect causal anchors for high-use selector-ready effects.
2. Promote interaction-only findings into focused one-parameter sweeps.
3. Add focused anchors for remaining missing settings in the long tail.
4. Rebuild the unified training set and generated bundles only after the learning gate shows fewer flat/inconclusive priors and no blank-record regression.

## Focused Smoke Validation

After the sampling audit, a focused current-effect plan generated 45 one-parameter manifests for Bars, Color Wash, Marquee, Pinwheel, Shockwave, SingleStrand, Spirals, and Twinkle.

Two staged xLights API smoke runs passed before expanding the queue:

- Twinkle `strobe`: 20 samples, 20 passed, 0 failed.
- Color Wash `hFade`: 20 samples, 20 passed, 0 failed.

Both smoke runs used `mono_white` and `rgb_primary` from the default xLights palette, with active palette slots `[1]` for single-color behavior and `[2, 3, 4]` for multi-color behavior. xLights API calls returned clean open, apply, render, save, and close responses, and modal monitoring reported no blockers.

The run staging intentionally uses a complete copied show fixture under the development show root for API execution. This avoids using display metadata while still launching xLights from a show directory that reaches the Designer API ready state without a startup directory prompt.

## Focused Current-Effect Run

Full focused run root:

`var/logs/sequencer-effects-usage-training-runs/audit-current-focused-full-20260428`

Execution result:

- manifests: 45
- passed manifests: 45
- failed manifests: 0
- passed samples: 1,552
- failed samples: 0
- xLights API jobs: 282 completed, 0 failed
- modal blockers: none observed

Learning gate result:

- promotion ready: true
- blockers: none
- new screening records: 1,328
- blank records: 0
- derived priors: 234
- priors with rules: 138
- behavior rules: 616
- flat or inconclusive priors: 96

Palette split:

- `mono_white`: 664 records, 117 derived priors, 70 priors with rules, 213 behavior rules
- `rgb_primary`: 664 records, 117 derived priors, 68 priors with rules, 403 behavior rules

Promotion result:

- promoted new durable screening records: 1,328
- refreshed existing screening records: 0
- selector-ready derived-prior effects: Bars, Color Wash, Marquee, Pinwheel, Shockwave, SingleStrand, Spirals, Twinkle
- behavior capability bundle records: 814

The current-effect run intentionally did not expand into new effect families. After promotion, the sampling audit top queue correctly shifted toward missing effect families such as Butterfly, Circles, Fire, Fireworks, Lightning, Snowflakes, Strobe, and Wave.

## Tooling Scale Finding

The promoted run exposed a real scaling issue in the training tooling: screening records can include multi-megabyte decoded frame payloads under `features.frames`. Loading all full records into aggregation tools caused Node heap exhaustion once the catalog grew past the earlier training size.

The builder, learning gate, and sampling audit now compact screening records at load time. They calculate or preserve the summary fields needed for learning and then discard raw frame arrays before aggregation. Raw per-run artifacts remain available in the run logs for forensic inspection, but the durable learning pipeline no longer needs to hold full frame payloads in memory.

## New Effect-Family Expansion

After the current-effect promotion, the highest-ranked remaining gap shifted to missing effect families. The next focused expansion added first matrix-based causal-anchor sweeps for:

- Butterfly: `colors`, `speed`, `style`
- Circles: `count`, `size`, `speed`
- Fire: `growthCycles`, `height`, `location`
- Fireworks: `count`, `explosions`, `velocity`
- Lightning: `forked`, `numberBolts`, `numberSegments`

Full run root:

`var/logs/sequencer-effects-usage-training-runs/audit-new-effects-focused-full-20260428`

Execution result:

- manifests: 15
- passed manifests: 15
- failed manifests: 0
- passed samples: 272
- failed samples: 0
- modal blockers: none observed

Learning gate result:

- promotion ready: true
- blockers: none
- new screening records: 272
- blank records: 0
- derived priors: 30
- priors with rules: 23
- behavior rules: 121
- flat or inconclusive priors: 7

Promotion result:

- promoted new durable screening records: 272
- refreshed existing screening records: 0
- selector-ready derived-prior effects: Bars, Butterfly, Circles, Color Wash, Fire, Fireworks, Lightning, Marquee, Pinwheel, Shockwave, SingleStrand, Spirals, Twinkle
- behavior capability bundle records: 950

Post-promotion sampling audit:

- `causal_ready`: 53
- `missing`: 30
- `needs_anchor_completion`: 4
- `needs_causal_anchor_confirmation`: 3
- `observed_flat_or_inconclusive`: 11
- `under_sampled`: 3

Remaining missing family work is now concentrated in Snowflakes, Strobe, Wave, plus secondary parameters for Butterfly, Circles, Fire, Fireworks, Lightning, Shimmer, and On.

## Remaining Effect-Family Expansion And Repair

The next focused batch expanded the remaining missing families and repaired the stale Shimmer base manifest that had pointed outside the canonical render-training root. The repaired Shimmer packs now use the standard `TreeFlat` fixture under:

`/Users/robterry/Projects/xLightsDesigner/render-training/RenderTraining-AnimationFixture.xsq`

Run roots:

- primary remaining-effects run: `var/logs/sequencer-effects-usage-training-runs/audit-remaining-effects-focused-full-20260428`
- Shimmer repair run: `var/logs/sequencer-effects-usage-training-runs/audit-remaining-effects-focused-repair-shimmer-20260428`
- combined gate root: `var/logs/sequencer-effects-usage-training-runs/audit-remaining-effects-focused-gate-20260428`

Execution result:

- manifests: 14
- passed manifests: 14
- failed manifests after repair: 0
- passed samples: 332
- failed samples: 0
- modal blockers: none observed

Learning gate result:

- promotion ready: true
- blockers: none
- new screening records: 332
- blank records: 0
- derived priors: 292
- priors with rules: 186
- behavior rules: 854
- flat or inconclusive priors: 106

Promotion result:

- promoted durable screening records: 332
- total durable screening records: 2,446
- selector-ready derived-prior effects: Bars, Butterfly, Circles, Color Wash, Fire, Fireworks, Lightning, Marquee, Pinwheel, Shockwave, SingleStrand, Snowflakes, Spirals, Strobe, Twinkle, Wave
- behavior capability index records: 1,086
- runtime behavior capability bundle records: 1,074

Post-promotion sampling audit:

- `causal_ready`: 66
- `missing`: 16
- `needs_anchor_completion`: 4
- `needs_causal_anchor_confirmation`: 3
- `observed_flat_or_inconclusive`: 12
- `under_sampled`: 3

The remaining gap has shifted from first-pass family coverage to long-tail setting coverage and richer causal anchors for settings that are still flat, inconclusive, or under-sampled.

## Validation

Commands run after promotion and audit:

```bash
node --check scripts/native/run-full-sequence-creation-benchmark.mjs
node --test apps/xlightsdesigner-ui/tests/scripts/native-direct-proposal.test.js apps/xlightsdesigner-ui/tests/scripts/native-review-apply.test.js apps/xlightsdesigner-ui/tests/agent/sequence-agent/practical-sequence-validation.test.js
node scripts/sequencer-render-training/tooling/build-effect-sampling-audit.mjs
node --test scripts/sequencer-render-training/tooling/build-effect-sampling-audit.test.mjs scripts/sequencer-render-training/tooling/build-effects-usage-learning-gate.test.mjs scripts/sequencer-render-training/tooling/export-derived-parameter-priors-bundle.test.mjs
node --test scripts/sequencer-render-training/tooling/build-effect-sampling-audit.test.mjs scripts/sequencer-render-training/tooling/build-effects-usage-learning-gate.test.mjs scripts/sequencer-render-training/tooling/export-derived-parameter-priors-bundle.test.mjs scripts/sequencer-render-training/tooling/export-cross-effect-shared-settings-bundle.test.mjs scripts/sequencer-render-training/tooling/build-training-record-generators.test.mjs
node --test apps/xlightsdesigner-ui/tests/agent/sequence-agent/trained-effect-knowledge.test.js apps/xlightsdesigner-ui/tests/agent/sequence-agent/sequence-agent.test.js apps/xlightsdesigner-ui/tests/agent/sequence-agent/practical-sequence-validation.test.js
```
