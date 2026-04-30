# Training Knowledge Baseline (2026-04-30)

Status: Active Baseline
Date: 2026-04-30
Owner: xLightsDesigner Team

## Purpose

Consolidate the durable learnings from the completed effects-usage render training and layer-composition training work before more broad training expansion.

This baseline summarizes what the sequencer should currently know, what remains uncertain, and what the next training curriculum should improve. It is the current human-readable entry point for training knowledge.

Source readouts:

- `effects-usage-render-training-results-2026-04-28.md`
- `layer-composition-overnight-results-2026-04-29.md`
- `training-knowledge-consolidation-plan-2026-04-30.md`

## Current Runtime Knowledge Artifacts

Generated bundles currently consumed by the sequence-agent runtime:

- `apps/xlightsdesigner-ui/agent/sequence-agent/generated/stage1-trained-effect-bundle.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/generated/effect-parameter-registry.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/generated/behavior-capability-records-bundle.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/generated/derived-parameter-priors-bundle.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/generated/layer-composition-priors-bundle.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/generated/cross-effect-shared-settings-bundle.js`

These files are generated runtime artifacts, not the human-maintained source of truth.

## Effect Coverage Baseline

Selector-ready derived-prior effects:

- Bars
- Butterfly
- Circles
- Color Wash
- Fire
- Fireworks
- Lightning
- Marquee
- Pinwheel
- Shockwave
- SingleStrand
- Snowflakes
- Spirals
- Strobe
- Twinkle
- Wave

Behavior-capability coverage exists for a wider set of effect behavior records, but the key current runtime threshold is selector-ready derived priors. Selector-ready means the sequencer has setting-level guidance it can use when choosing and configuring the effect.

The most important shift from the latest effects training is that first-pass family coverage is no longer the main blocker. The remaining issue is long-tail setting coverage, causal confidence, and reducing flat or inconclusive priors.

## Effects-Usage Training Learnings

Current effects-usage durable record counts after the April 28 focused batches:

- total durable screening records: 2,446
- runtime behavior capability bundle records: 1,074
- post-promotion sampling audit:
  - `causal_ready`: 66
  - `missing`: 16
  - `needs_anchor_completion`: 4
  - `needs_causal_anchor_confirmation`: 3
  - `observed_flat_or_inconclusive`: 12
  - `under_sampled`: 3

Useful setting-behavior findings:

- `On.shimmer` changes motion, color, and brightness rhythm.
- `Marquee.skipSize` decreases coverage on grouped arch geometry.
- `Marquee.bandSize` changes coverage, persistence, texture, color boundaries, and color position.
- `Marquee.speed` changes motion and color-position behavior, especially under RGB palettes.
- `Marquee.thickness` has strong impact on tree geometry but can look flat on single-line geometry.
- `Shimmer.useAllColors` increases color band density and reduces dominant-color stability in multi-color behavior.
- `Shimmer.dutyFactor` changes color band density and dominant-color stability in multi-color behavior.
- `SingleStrand.chaseSize` and `SingleStrand.cycles` increase coverage on single-line and arch geometry.

Palette findings:

- `mono_white` remains useful as a single-color proxy for coverage, motion, persistence, and ramp behavior.
- `rgb_primary` exposes color-position motion, color variety, and color-boundary behavior that mono-white cannot expose.
- Multi-color findings should not be inferred from mono-white runs unless the setting is clearly color-independent.

Geometry findings:

- Geometry changes setting behavior. A setting that looks flat on a line can matter on trees, matrices, or grouped arches.
- Training evidence should retain geometry context rather than promoting settings as globally flat or globally useful.
- The next coverage layer needs stronger radial, star, spinner, tree-round, matrix, and custom-model-inspired geometry evidence.

## Layer-Composition Learnings

The April 29 layer-composition run completed cleanly:

- completed passes: 410
- completed observations: 410
- failed passes: 0
- blocking modal count: 0
- staged priors: 400
- effect-setting delta observations: 212
- render-setting delta observations: 42
- final stop status: `queue_exhausted`

The run was useful for causal setting sensitivity, especially Marquee setting curves. It was not yet broad enough to teach high-level sequence artistry.

Strong findings:

- Marquee `skipSize`, `bandSize`, `speed`, and tree-geometry `thickness` produced meaningful measured deltas.
- Palette-sensitive observations are real and should be preserved in runtime guidance.
- Disk guardrails and retention behavior worked; the run completed without modal blockers or failed passes.

Weak or uncertain findings:

- Several flat results are context-limited, not proof that settings are irrelevant.
- Boolean-only probes did not create enough non-repeating evidence.
- The run exhausted its deterministic refill curriculum early instead of filling the intended 8 to 10 hour window.
- Most useful time was spent deepening Marquee rather than broadening layer-stack composition.

Layer-composition runtime impact should remain conservative. The current evidence can guide setting and palette tendencies, but it should not yet overrule user intent or strong target metadata.

## Current Limitations

- Some priors remain flat or inconclusive because the current metrics, target geometry, palette, or sampled window did not expose a visible change.
- Interaction-derived trends are weaker than focused one-parameter causal anchors.
- Layer-stack and multi-effect composition evidence is still shallow.
- Custom model geometries are not yet part of the standard training geometry suite.
- Generated bundles are large and need clearer provenance metadata.
- Dated run reports contain durable findings that should be consolidated into this baseline and then treated as evidence/supporting docs rather than first-entry specs.

## Runtime Use Policy

The sequence agent may use current training knowledge to:

- choose among selector-ready effects
- bias settings based on target geometry, palette mode, and requested visual behavior
- avoid settings known to be flat in a specific context
- prefer stronger causal anchors over interaction-only trends
- keep alternate realization candidates alive when evidence is mixed

The sequence agent should not:

- treat flat findings as universal without geometry and palette context
- replace explicit user intent solely because a trained prior prefers another look
- rely directly on raw run logs
- require generated bundle internals outside stable loader/query APIs
- infer custom model behavior from matrix or line geometry when custom model node layout says otherwise

## Next Training Curriculum Requirements

Before another broad training run:

1. Add provenance metadata to generated bundles where missing.
2. Define curated catalog inputs versus intermediate/generated catalog outputs.
3. Keep the current baseline as the readable training entry point.
4. Confirm runtime loaders hide generated bundle shape from planner code.

The next training run should focus on:

- long-tail missing settings from the sampling audit
- causal confirmation for interaction-only findings
- geometry contrasts across line, arch, tree flat, tree round, matrix, spinner, radial, star, and custom-like layouts
- layer-order and same-target stack behavior
- group/model overlap permutations
- multi-effect interaction probes under controlled factorial design
- enough refill sources to sustain a true overnight run without repeating low-value evidence

Do not rerun the exact April 29 layer-composition curriculum. It already exhausted its useful non-repeating work.

## Spec Cleanup Consequences

After this baseline is accepted:

- dated run result specs should remain as evidence, not canonical entry points
- training expansion plans should describe deltas from this baseline
- sequence-agent README should point here for current training state
- new training reports should update or supersede this baseline instead of creating another competing summary

