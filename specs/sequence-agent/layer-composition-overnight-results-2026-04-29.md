# Layer Composition Overnight Results - 2026-04-29

## Source Run

Run root:

`var/logs/sequencer-layer-composition-training-runs/layer-composition-overnight-20260428-221905`

The run completed successfully from a system perspective:

- exit code: `0`
- xLights API remained healthy after the run
- blocking modal count: `0`
- failed passes: `0`
- completed passes: `410`
- completed observations: `410`
- learning checkpoints: `17`
- staged priors: `400`
- effect-setting delta observations: `212`
- render-setting delta observations: `42`
- final stop status: `queue_exhausted`
- final stop reason: `no_valid_non_repeated_experiment`
- elapsed runtime: `62.426` minutes

The run did not reach the 8 to 10 hour training target. It exhausted the current deterministic non-repeating refill curriculum after 16 useful refill attempts and then stopped cleanly on the 17th refill attempt.

## Disk and Retention

Disk guardrails worked as intended.

- The first overnight launch was blocked before apply/render because free disk was below the hard stop.
- Old generated effects-usage run logs under `var/logs/sequencer-effects-usage-training-runs` were cleaned to restore free space.
- The successful run stayed in warning range but did not hit the hard stop.
- free disk during the run ranged from roughly `16.0 GB` to `17.4 GB`.
- final run folder size: roughly `224 MB`.
- API staging folder size: roughly `68 KB`.

This confirms the retention loop is compacting raw artifacts enough for this layer-composition workload, but the machine still needs more free space before larger overnight runs are comfortable.

## Coverage

Family coverage:

| Family | Experiments | Passes | Effect Deltas | Render Deltas | Observed | No Macro Change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `setting_attribution_probe` | 34 | 252 | 142 | 10 | 214 | 38 |
| `low_movement_setting_geometry_probe` | 34 | 106 | 70 | 0 | 72 | 34 |
| `same_target_layer_stack` | 2 | 26 | 0 | 18 | 24 | 2 |
| `group_model_interplay` | 2 | 10 | 0 | 0 | 8 | 2 |
| `setting_sensitivity_edge_probe` | 2 | 16 | 0 | 14 | 14 | 2 |

The run was valuable for causal setting sensitivity. It was not yet broad enough for sequence-level artistry because most refill time was spent deepening Marquee setting curves on a small number of geometries.

## Strongest Learnings

The strongest measured deltas came from Marquee settings:

- `skipSize` on RGB and mono-white produced the largest aggregate movement, especially motion/ramp and coverage changes.
- `thickness` on `TreeFlat` produced strong coverage and motion changes. This confirms again that the earlier single-line no-change result was geometry-specific.
- `bandSize` produced meaningful coverage, persistence, texture, color-boundary, and color-position changes.
- `speed` produced meaningful motion and color-position behavior, especially under RGB.

Palette matters:

- RGB variants exposed color-position motion, color variety, and color-boundary behavior that mono-white cannot expose.
- Mono-white remains useful as the proxy for any single-color palette, especially for coverage, motion, persistence, and ramp behavior.

## Weak or Flat Areas

Several flat results should be interpreted carefully:

- Marquee `thickness` remained flat on the single-line setting-attribution probe across all refill values.
- Marquee `reverse` remained flat in the single-line probe because it is boolean and only had one non-repeating variant.
- Several render settings on mono-white layer stacks showed no macro movement. This may be real for those settings in those fixtures, or it may mean the current observation metrics do not capture the effect well enough.

The flat results are useful, but they are not enough to conclude that those settings are visually irrelevant. They mostly tell us that the current target/effect/window/metric combination did not expose them.

## Issues Found

One traceability bug was found after analysis:

- zero-valued refill variants were written into pass IDs as `value`, for example `skipSize_value`.
- Root cause: the refill `safeSlug` helper treated numeric `0` as empty.
- Fix: `build-layer-composition-adaptive-refill.mjs` now preserves zero-valued variants in pass IDs and learning IDs.
- Test added: zero-valued variants now produce IDs like `skipSize_0` and learning IDs with `skipSize:0`.

This affects naming traceability only. The run observations still contain the actual variant values in the pass plans and deltas.

## Why The Run Ended Early

The refill source was intentionally conservative:

- only validated high-priority families were refilled
- only deterministic non-repeating numeric setting values were allowed
- boolean-only probes were not repeated
- once the variant list was exhausted, the runner stopped rather than repeating evidence

This was the right failure mode. The next run should expand the curriculum rather than blindly repeat the same setting probes.

## What Is Needed Next

The next training step should broaden from single-effect setting curves into composition-level layer construction.

Priority 1: Add more refill families

- same-target layer stacks with varied layer order
- group/model overlap permutations
- render-setting variants across more baseline stacks
- edge-rich overlap stacks beyond ArchGroup
- multi-effect interaction probes where two settings vary under controlled factorial design

Priority 2: Add more effects and settings

The current run was heavily Marquee-centered. The next run should include comparable setting-depth families for:

- Bars
- Pinwheel
- Spirals
- Color Wash
- Twinkle
- Shimmer
- Strobe
- Wave
- Butterfly/Circles/Fire/Fireworks/Lightning/Snowflakes where manifests are already present and mechanically validated

Priority 3: Add more target geometries

The next run should cover at least:

- linear
- arch/grouped arch
- tree flat
- tree round
- matrix/high-density
- spinner/radial
- star/multi-layer

Priority 4: Improve adaptive refill selection

The refill generator should stop thinking only in numeric setting values. It should choose the next work from a pool of refill sources:

- untested effect-setting depth
- untested render-setting depth
- untested geometry contrasts
- low-confidence prior revalidation
- contradictory evidence checks
- layer-order interaction deepening
- palette-sensitive behavior deepening

Priority 5: Increase true overnight duration

The next target should be an 8 to 10 hour run. To achieve that without repeating low-value evidence, the plan must add enough distinct work to support roughly 2,500 to 3,500 passes at the current observed throughput, or it must include heavier sequence-like render windows that naturally take longer and teach higher-level composition.

## Recommendation

Do not rerun the same overnight plan. It already exhausted its useful non-repeating work.

The next implementation should add a second-generation adaptive curriculum that includes multiple refill sources and broadens into layer-stack and multi-effect composition training. After that, run another short preflight that proves the new refill source does not exhaust quickly, then start the next overnight run.

## Follow-Up Implementation

Second-generation adaptive refill work started after this analysis.

Implemented refill sources:

- effect-setting depth for validated high-priority setting probes
- render-setting depth for `same_target_layer_stack`
- render-setting depth for `setting_sensitivity_edge_probe`
- broad manifest-sample effect survey using existing manifest files in `scripts/sequencer-render-training/manifests`

The manifest-sample source adds single-effect survey observations across available fixture targets and effects, using both `mono_white` and `rgb_primary` palette profiles.

Estimated capacity after this change:

- initial overnight plan: 90 passes
- refill attempts 1 through 14: 184 passes each
- refill attempt 15: 104 passes
- refill attempt 16: 40 passes
- total before exhaustion through attempt 20: 2,810 passes

At the previous observed throughput of roughly 6.6 passes per minute, this is approximately 7 hours of work before considering slower/heavier manifest samples. This should be sufficient for a meaningful overnight preflight, though it may still need another refill source to reliably fill 8 to 10 hours on faster hardware or lighter sample windows.

Additional fix:

- zero-valued setting variants are preserved in pass IDs and learning IDs.
- test coverage added for `skipSize_0` and `skipSize:0`.

Next validation:

- run the full layer-composition test suite
- run a short real budget-mode preflight that reaches at least one manifest-sample refill
- if stable, launch the next overnight run
