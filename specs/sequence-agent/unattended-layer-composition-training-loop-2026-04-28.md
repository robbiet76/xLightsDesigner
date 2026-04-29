# Unattended Layer Composition Training Loop

Status: Draft  
Date: 2026-04-28  
Owner: xLightsDesigner Team  

## Source Prompt

> I think we need to design a training loop here that can run unattended over a long period of time so that the sequencer can improve at sequencing. I think self-learning here will be critical to get the scale of improvement needed. How would we design that?

> It should use effects at the group level and on individual models as well as in multiple layers within the model/group. It should experiment with order, and render settings to see the impacts.

## Purpose

Design an unattended training loop that teaches the sequencer how layered compositions behave when rendered by xLights.

This training layer complements effect behavior training. Effect behavior training asks what a single effect and setting change does on a model family. Layer composition training asks what happens when multiple planned effects interact across group rows, individual model rows, same-target layers, display/model order, and layer render settings.

The goal is not to discover one best sequence template. The goal is to collect render-backed evidence about composition deltas so the sequencer can predict the impact of adding, removing, reordering, or changing layers during a full-sequence plan.

Each overnight run should produce durable learnings that do not need to be repeated in later runs unless the renderer, fixture, API behavior, or observation extractor changes. The training curriculum should start broad and become more detailed over time. Early runs should answer general sequencing questions across a wide base of target scopes, palette modes, layer counts, and order variants. Later runs should only drill into narrower combinations where the prior evidence is weak, contradictory, or high-value for current sequence quality gaps.

## Target-State Knowledge Framework

The sequencer-facing target state is an indexed knowledge system, not an append-only file of learnings. Training exists to populate that system.

Durable evidence flow:

1. `composition_stack_observation_v1`: raw render-backed observation for one stack/pass.
2. `layer_composition_delta_summary_v1`: compact deltas against baseline and previous pass.
3. `layer_composition_priors_v1`: conditional, evidence-backed priors in staging or promotion.
4. `sequencer_layer_composition_priors_bundle`: indexed runtime bundle.
5. `sequencer_layer_composition_guidance_v1`: small advisory packet retrieved for one sequencer decision.

Runtime retrieval facets:

- `compositionIntent`
- `targetScope`
- `modelType`
- `geometryProfile`
- `paletteProfile`
- `effectName`
- `compositionPass`
- `layerIndex`
- `layerBlendRole`
- `observedOutcome`
- `confidence`
- `promotionState`

The sequencer should request guidance for the decision it is making, such as "RGB group foundation plus model focus on arch/spinner targets." It should not load all priors into the prompt or treat retrieved priors as recipes.

The retrieved guidance packet must preserve matching context, ranked priors, confidence/promotion state, observed effects, cautions/safeguards, and source evidence references. If a training run cannot populate these facets, it should be treated as incomplete even if renders succeeded.

## Scope

The loop must test:

- group-level effects
- individual model effects
- group plus model combinations over the same time window
- multiple layers on the same model or group
- display/model order permutations
- layer reorder permutations
- render setting changes that affect compositing
- incremental composition passes from foundation to detail
- both `mono_white` and `rgb_primary` palette protocols from the existing render training plan

The loop should use the canonical render-training display by default. It should not use the user's production display for unattended sweeps unless explicitly approved for a separate display-specific learning pass.

Normal development cadence:

- daytime: review prior results, adjust manifests, run dry-runs and short smoke checks
- overnight: run the approved training plan unattended for 8 to 10 hours
- next daytime: analyze results, decide what to promote, and revise the next night's training plan

The routine should be designed around true overnight learning volume. A short run is only a smoke test and should not be treated as sufficient evidence for sequencing-quality improvement.

## Curriculum Strategy

Training should follow a broad-to-specific progression:

1. `broad_composition_survey`: cover all major composition mechanics with representative effects and geometries.
2. `family_contrast_survey`: compare the same mechanics across major model families, such as linear, arch, tree, radial, star, and matrix.
3. `setting_sensitivity_survey`: vary a small set of high-impact layer render settings and effect settings.
4. `interaction_deepening`: revisit only the combinations that produced ambiguous, high-variance, or high-impact results.
5. `sequence_pattern_validation`: validate learned priors inside longer multi-section sequence-like plans.

The first overnight runs should favor breadth over precision. A useful first run learns general facts like:

- group foundations can support or obscure individual model focal layers depending on display/model order
- same-target layer stacks behave differently from group/model overlap
- multicolor detail layers interact differently with single-color foundations than with multicolor foundations
- physical layer order changes can alter readability and color preservation
- certain render settings materially affect whether lower or upper layers dominate

Highly detailed sweeps should wait until the broad survey identifies where detail is worth spending runtime.

## Learning Durability

Each promoted learning should have a stable `learningId` and evidence fingerprint so future runs can avoid retesting the same fact.

Durable learning keys should include:

- training fixture identity
- xLights version or renderer build identity when available
- observation extractor version
- palette profile class
- target scope pattern, such as `group_only`, `model_only`, `group_plus_model`, or `same_target_stack`
- geometry family, not just one model name
- layer count
- order variant type
- changed setting or changed layer, when relevant

A learning is considered reusable when:

- the run produced non-empty rendered evidence
- the interpreted delta passed confidence thresholds
- the learning is not contradicted by sibling samples
- the observation extractor version has not changed in a way that invalidates the metric
- the xLights renderer behavior has not changed in a relevant area

Future overnight plans should read existing promoted and staged `layer_composition_priors_v1` records and skip already-covered durable learnings unless a revalidation reason is present.

Valid revalidation reasons:

- xLights renderer version changed
- owned API layer behavior changed
- observation extractor or metric logic changed
- canonical fixture geometry changed
- prior evidence confidence was low
- new results conflict with earlier priors
- current sequence benchmark exposes a gap that requires deeper sampling

Invalid revalidation reasons:

- the learning is old but still compatible
- the exact same broad question was already answered with good evidence
- a later run has unused time and no planned expansion target

Display metadata is not an input to this training layer. This is render behavior learning against standard xLights training fixtures. Project display metadata remains a separate layer for interpreting a user's real layout.

## Render Order Rules

This loop must follow `xlights-layering-render-order-audit-2026-04-17.md`.

Important constraints:

- xLights layer vector order and displayed layer number are not enough to predict visual dominance.
- model layers render from highest index down.
- final pixel mixing also walks highest valid layer down.
- lower layer mix settings govern how that lower layer combines with accumulated output from higher layers.
- canvas layers can preload lower layers and change normal stacking behavior.
- submodel, strand, and node layers can write into the same final output after model-level rendering.
- display/model order is part of sequencing semantics when broad group targets and specific model targets overlap.

The training artifacts must keep `compositionPass`, `targetScope`, `layerIndex`, `displayElementOrder`, `layerSettings`, and `layeringTaxonomy` as separate fields. A composition pass such as `foundation` or `detail` is planning intent. It is not the same thing as a physical xLights layer index.

## Composition Pass Model

Training cases should be built in incremental passes:

1. `empty_baseline`: no effects in the test window.
2. `foundation`: broad coverage or background motion on a group target.
3. `structure`: rhythm, beat, sweep, or framing motion on a group or model family.
4. `focal`: readable attention layer on one or more individual models.
5. `detail`: texture, sparkle, accent, or highlight layer.
6. `order_variant`: same planned content with changed display/model order or layer order.
7. `render_setting_variant`: same planned content with changed layer render settings.

Each pass should render and capture the delta from the prior pass. The useful learning record is "when this layer was added or changed on top of an existing stack, the rendered output changed this way."

## Required Experiment Families

### Group To Model Interplay

Purpose: learn how a group-level foundation reads when individual model effects are added on top of it.

Minimum variants:

- group only
- model only
- group first plus model refinement
- model first plus group overlay
- broad group row ordered before specific model rows
- specific model rows ordered before broad group row

Observed dimensions:

- whether the individual model remains readable
- whether the group foundation overpowers the focal layer
- whether the final output expands useful coverage
- whether spatial balance improves or collapses
- whether motion directions fight or reinforce each other

### Same Target Layer Stack

Purpose: learn how multiple layers on one model or group combine.

Minimum variants:

- one layer only
- two layers with default mix settings
- same two layers with reversed physical layer order
- three-layer foundation/structure/detail stack
- one layer changed from single-color to multicolor
- one layer changed in brightness, contrast, blur, fade, or mix method

Observed dimensions:

- layer readability
- color preservation
- brightness clipping
- motion clarity
- texture density
- dominant pattern collapse
- whether a lower layer's mix settings materially changed accumulated output

### Parent And Child Overlap

Purpose: learn how model, submodel, strand, or node effects modify the perceived result on the same physical lights.

Minimum variants:

- parent model/group only
- child/submodel only
- parent plus child
- parent plus child with child ordered as focal/detail
- parent plus child with parent ordered as overlay

This can start with parent/model overlap and later expand to strand and node targets after API support and fixtures are verified.

### Display Element Order

Purpose: learn how row order impacts broad and specific target interplay.

Minimum variants:

- broad group targets before model rows
- model rows before broad group targets
- family groups clustered together
- focal models moved later in sequence display order

Observed dimensions:

- whether focal objects survive group effects
- whether broad effects hide or support detail
- whether order changes are visible in rendered output
- whether the same effect set should be planned as group-level, model-level, or both

### Render Setting Deltas

Purpose: learn layer render setting behavior, not just effect parameter behavior.

Minimum settings to evaluate when API support exists:

- mix method
- mix threshold
- canvas flag
- persistent overlay
- brightness
- contrast
- saturation
- hue/value shifts
- blur
- zoom
- rotation
- fade in/out
- transitions

If a setting cannot be controlled through the owned xLightsDesigner API, the training plan must record it as an API capability gap rather than silently skipping it.

Current owned API support uses the existing effect creation/update path. xLights stores these controls as serialized effect settings or palette settings, so no separate layer-settings endpoint is required for the verified subset:

- effect settings: `mixMethod`, `mixThreshold`, `canvas`, `persistentOverlay`, `blur`, `zoom`, `rotation`, `fadeIn`, `fadeOut`
- palette/color settings: `brightness`, `contrast`, `hue`, `saturation`, `value`

Unmapped future layer settings must remain explicit unsupported gaps until their xLights serialized keys and render behavior are verified.

## Artifact Schemas

### `layer_composition_experiment_manifest_v1`

Top-level manifest for one unattended run.

Required fields:

- `artifactType`
- `runId`
- `trainingDisplay`
- `paletteProfiles`
- `experimentFamilies`
- `targetSets`
- `effectSets`
- `compositionPasses`
- `orderPermutations`
- `renderSettingPermutations`
- `maxRuntimeMinutes`
- `resumePolicy`
- `promotionPolicy`

### `composition_stack_observation_v1`

One rendered stack observation.

Required fields:

- `artifactType`
- `runId`
- `experimentId`
- `passId`
- `paletteProfile`
- `targetScope`
- `targetIds`
- `displayElementOrder`
- `placements`
- `layeringTaxonomy`
- `renderArtifact`
- `frameMetrics`
- `spatialMetrics`
- `colorMetrics`
- `motionMetrics`
- `readabilitySignals`
- `failureSignals`

### `layer_delta_observation_v1`

Delta between a prior stack and the next stack.

Required fields:

- `artifactType`
- `runId`
- `experimentId`
- `fromPassId`
- `toPassId`
- `changeType`
- `changedPlacementIds`
- `changedLayerSettings`
- `metricDeltas`
- `interpretedDeltas`
- `confidence`
- `rawEvidenceRefs`

`interpretedDeltas` should describe practical sequencing meaning, such as:

- `focal_readability_increased`
- `focal_readability_decreased`
- `coverage_expanded`
- `motion_conflict_increased`
- `color_identity_preserved`
- `color_identity_collapsed`
- `brightness_clipped`
- `texture_density_increased`
- `detail_layer_hidden`

### `order_permutation_observation_v1`

Comparison between two rendered variants with identical effect content but different display/model or layer order.

Required fields:

- `artifactType`
- `runId`
- `experimentId`
- `baselineOrder`
- `variantOrder`
- `orderType`
- `metricDeltas`
- `interpretedDeltas`
- `confidence`
- `rawEvidenceRefs`

### `render_setting_delta_observation_v1`

Comparison between two rendered variants with identical planned content but different layer render settings.

Required fields:

- `artifactType`
- `runId`
- `experimentId`
- `settingName`
- `baselineValue`
- `variantValue`
- `affectedLayer`
- `metricDeltas`
- `interpretedDeltas`
- `confidence`
- `rawEvidenceRefs`

### `layer_composition_priors_v1`

Aggregated selector-facing learning bundle.

Required fields:

- `artifactType`
- `generatedAt`
- `sourceRunIds`
- `trainingDisplay`
- `priors`
- `evidenceSummary`
- `promotionStatus`

Each prior must be conditional and evidence-backed. It should never say "always use Pinwheel on a spinner in a chorus." It should say, for example, that under specific geometry, palette, target-scope, and existing-stack conditions, adding a second motion layer with certain settings tended to improve or reduce readability.

Each prior should include:

- `learningId`
- `durabilityStatus`
- `coverageKey`
- `evidenceFingerprint`
- `firstObservedRunId`
- `lastValidatedRunId`
- `revalidationReasons`
- `supersedesLearningIds`

This allows the planner to build on prior runs instead of repeatedly rediscovering the same broad facts.

## Learning Rules

The loop should store relationships, not recipes.

Good learning:

- "Adding a model-level focal layer over a group-level foundation increased focal readability when the model row was ordered after the group row."
- "Reversing same-target layer order reduced color diversity because one layer dominated the mix."
- "Increasing brightness on the lower layer clipped detail when the upper layer already had high active coverage."
- "A multicolor detail layer remained readable over a single-color foundation on this geometry, but collapsed over a dense multicolor foundation."

Bad learning:

- "Use this exact stack for every high-energy chorus."
- "This effect is a chorus effect."
- "Layer 1 is always the top visual layer."
- "A single isolated effect score predicts the final sequence outcome."

## Long-Running Loop Design

The unattended runner should be resumable and append-only:

1. Build or load a run directory under `var/logs/sequencer-layer-composition-training-runs/<run-id>/`.
2. Read existing staged and promoted composition priors.
3. Generate an initial experiment queue from approved manifests, skipping durable covered learnings.
4. Prefer broad uncovered coverage keys before narrow deepening cases.
5. Start from the canonical render-training fixture.
6. Apply one experiment pass at a time through the owned xLightsDesigner API.
7. Render and capture FSEQ/GIF/frame artifacts.
8. Extract frame, color, spatial, motion, and readability metrics.
9. Write raw observations immediately after each render.
10. Write delta observations after each comparable pair is available.
11. Checkpoint progress after each experiment.
12. When the active queue is exhausted before the runtime budget is reached, refresh the learning state and generate the next best queue.
13. Continue until runtime budget, safety stop, or operator stop criteria are reached.
14. Build candidate priors in staging.
15. Promote only after validation gates pass.

Default overnight runtime should target 8 to 10 hours. The runner should support shorter smoke-test budgets, but those should be marked as `smoke` or `validation` run types rather than normal training.

Runtime budget:

- `smoke`: 15 to 45 minutes, validates plan shape and API/render plumbing only
- `focused_evening`: 2 to 4 hours, useful for validating a new experiment family
- `overnight`: 8 to 10 hours, normal learning run
- `extended`: more than 10 hours, only after prior run stability is proven

The overnight runner is time-budget driven. It should not finish early simply because the initial queue completed. If an 8 to 10 hour run exhausts its broad survey queue in two hours, the runner should adapt and continue with the next highest-value work until the budget is reached.

Adaptive refill order:

1. uncovered broad composition coverage keys
2. uncovered geometry-family contrast keys
3. low-confidence broad learnings needing revalidation
4. contradictory learnings needing confirmation
5. high-impact render-setting sensitivity samples
6. benchmark-driven deepening samples
7. controlled repeat samples for confidence calibration

The runner should stop before the runtime budget only for hard reasons:

- xLights is blocked or unhealthy
- repeated render failures exceed threshold
- modal/readiness state cannot be diagnosed
- disk space or artifact writing fails
- no valid experiment can be generated without repeating durable learnings
- operator stop requested

If the runner stops early, the summary must classify the stop as `early_stop` and include the exact reason. A normal overnight run should end as `runtime_budget_reached`.

## Summarization And Artifact Retention

Overnight runs must summarize as they go and avoid retaining unnecessary raw render data. The durable learning artifact is the extracted observation, delta, evidence fingerprint, and selected proof references, not every intermediate render file.

Retention goals:

- keep enough evidence to audit and reproduce promoted learnings
- avoid filling local storage with raw FSEQ/GIF/frame artifacts
- preserve failure evidence long enough to debug blocked training
- compact data at logical checkpoints instead of only at the end of the run

Logical summarization points:

- after each rendered pass
- after each comparable delta pair
- after each experiment
- before adaptive queue refill
- at run completion or early stop

After each rendered pass, the runner should:

1. extract frame, color, spatial, motion, readability, and failure metrics
2. write `composition_stack_observation_v1`
3. write an artifact fingerprint including file size, hash, renderer identity, and extractor version
4. decide whether raw artifacts are needed for debugging or proof retention
5. purge or compact raw artifacts that are not needed

After each comparable pair, the runner should:

1. write the relevant delta observation
2. update staged learning candidates
3. update run-level coverage and confidence summaries
4. mark source raw artifacts as purge-eligible once the delta is validated

Default retention policy:

- promoted durable learning: keep observation JSON, delta JSON, thumbnails or tiny representative previews, hashes, and paths to regenerated fixture inputs; purge full raw render artifacts unless flagged as proof-critical
- staged but unpromoted learning: keep observations, deltas, fingerprints, and small previews; purge full raw renders after the run summary is written
- failed or blocked pass: keep raw artifacts for a limited debug window or until the next daytime review, then purge after the failure is classified
- smoke run: keep enough artifacts for immediate inspection, but allow aggressive cleanup after validation
- overnight run: compact continuously and enforce disk guardrails

The runner should track disk usage and write cleanup decisions into the run summary. If disk usage exceeds a configured threshold, the runner should prefer purging already-summarized raw artifacts before stopping the run.

No cleanup step may delete:

- promoted prior bundles
- observation JSON
- delta JSON
- run summary JSON
- manifest/plan/checkpoint files
- failure summaries that have not been reviewed

Raw artifact cleanup must be deterministic and logged. A later run should not need raw artifacts from a prior completed run unless that prior was explicitly retained for audit.

The loop must include xLights readiness checks and modal-state visibility before every apply/render cycle. Modal handling should remain root-cause oriented; the runner should fail with useful state if xLights is blocked rather than brute-forcing modal dismissal.

## Promotion Gates

Promotion is allowed only when the run shows useful new evidence and does not regress existing training bundles.

Required gates:

- dry-run manifest generation succeeds
- short smoke run with at least one group/model interplay case
- short smoke run with at least one same-target multi-layer stack case
- both `mono_white` and `rgb_primary` palette profiles are represented
- observation schemas validate
- delta extraction emits non-empty interpreted deltas
- no app metadata is written into xLights show folders
- no production show folder is used by default
- xLights modal/readiness checks pass
- existing sequencer unit tests pass
- generated priors remain conditional and do not collapse into fixed recipes

## Implementation Checklist

- [x] Define `layer_composition_experiment_manifest_v1`.
- [x] Add a dry-run planner for layer composition experiments.
- [x] Add adaptive queue refill so overnight runs continue until the runtime budget or a hard stop.
- [x] Add incremental summarization and raw artifact cleanup policy.
- [x] Add a small approved smoke manifest for group/model interplay.
- [x] Add a small approved smoke manifest for same-target layer stacks.
- [x] Add apply support audit for required layer render settings.
- [x] Add render artifact harvest for composition stack observations.
- [x] Add delta extraction between incremental passes.
- [x] Add order-permutation comparison.
- [x] Add render-setting-delta comparison.
- [x] Add staged `layer_composition_priors_v1` builder.
- [x] Wire staged/promoted priors into sequencer retrieval as advisory evidence.
- [x] Add benchmark diagnostics that report whether generated sequences used group rows, model rows, and same-target layers intentionally.

## Initial Implementation Slice

The first code slice should be deliberately small:

1. Create a dry-run manifest generator that emits two experiment families:
   - group foundation plus individual model focal/detail
   - same-target two-layer and three-layer stack
2. Use only existing API-supported fields for the first smoke run.
3. Record unsupported render settings as explicit capability gaps.
4. Render one `mono_white` and one `rgb_primary` variant.
5. Emit raw stack observations and simple metric deltas.
6. Keep promotion disabled.

After that works, the next step is an approved 8 to 10 hour overnight run. The daytime smoke run proves mechanics; it is not the learning target.

## Smoke Validation Evidence

Initial smoke validation completed in:

`var/logs/sequencer-layer-composition-training-runs/smoke-real-pass-5`

Observed result:

- 22 of 22 planned smoke passes completed.
- xLights API health remained ready after completion with no modal blockers.
- Both `mono_white` and `rgb_primary` palette profiles rendered.
- Group/model interplay and same-target layer-stack experiment families rendered.
- Observations were written for every completed pass.
- Delta summary was written to `layer-composition-delta-summary.json`.
- Staged non-selector-ready priors were written to `layer-composition-priors-staged.json`.
- Summarized staged raw `.xsq/.fseq` files were purged from the explicit API staging root.

The smoke output confirms the mechanical loop works: stage sequence, open in xLights, create full timing tracks, apply effects where present, render, extract composition observations, summarize deltas, and clean raw artifacts. It does not prove sequence quality; the next work is prior promotion and longer adaptive training.

Runtime retrieval has also been wired into the full-display planner. Planned placements now retrieve `sequencer_layer_composition_guidance_v1` by composition intent, family, palette profile, target scope, geometry/model hints, effect name, layer index, and desired outcome tags. The returned guidance is attached as advisory evidence and does not override deterministic planning.

Benchmark validation now emits `sequencer_composition_training_trace_v1`. It reports layer-composition guidance coverage, prior coverage, sourced prior coverage, group/model interplay windows, and same-target layer-stack targets from the actual generated effect commands.

Delta extraction now emits `render_setting_delta_observation_v1` when a pass declares a render-setting variant against a comparison base pass. These observations preserve the setting name, baseline value, variant value, affected layer, metric deltas, interpreted deltas, and raw evidence refs. Staged priors carry changed layer-setting context forward as advisory evidence for the sequencer.

The pass execution builder now applies verified render settings through the owned batch payload by merging layer render settings into the effect settings or palette strings that xLights already consumes. It still emits explicit unsupported setting gaps for unmapped controls rather than silently dropping them.

The focused dry-run curriculum now includes render-setting variants for brightness, contrast, canvas, additive mix method, effect layer mix threshold, blur, persistent overlay, and fade in/out across both `mono_white` and `rgb_primary` palette profiles.

Focused render-setting smoke validation completed in:

`var/logs/sequencer-layer-composition-training-runs/render-settings-focused-smoke-20260428-164044`

Observed result:

- 36 of 36 planned smoke passes completed through the owned xLights API.
- xLights health returned to ready and modal monitoring reported no blockers.
- 18 `render_setting_delta_observation_v1` records were produced across both `mono_white` and `rgb_primary`.
- 32 staged priors were produced; 16 include changed layer-setting context.
- Verified serialized settings were present in staged `.xsq` output before cleanup.
- Retention cleanup removed summarized temporary sequence/FSEQ artifacts while retaining observations, previews, deltas, priors, checkpoints, and summaries.

Initial interpretation: the current extractor detects macro-level brightness/contrast changes in the RGB palette stack, but most mix/canvas/blur/persistent/fade variants did not move the sampled macro metrics. This should not be interpreted as proof that those settings have no visual impact. It shows the observation extractor needs more targeted layer-composition metrics before those setting priors can become selector-ready.

Follow-up extractor update:

- Render observations now capture model texture, edge softness, color-boundary softness, adjacent color deltas, frame-to-frame active-node persistence, RGB/brightness similarity, and opening/middle/closing ramp metrics.
- `render_setting_delta_observation_v1` now carries those targeted metric deltas into staged priors so the sequencer can consume render-setting evidence without losing the measurement detail.
- A refresh utility was added so retained smoke runs can be re-extracted after extractor improvements without rerunning xLights:
  - `scripts/sequencer-render-training/tooling/refresh-layer-composition-render-observations.mjs`
- The retained focused smoke run was refreshed with the new extractor and its delta/prior summaries rebuilt. The richer metrics improved the evidence schema, but the run still only showed measured render-setting deltas for brightness and contrast. This reinforces that the smoke window's three adjacent sampled frames were too thin for fade, persistence, blur, and blend interaction evidence.
- The layer-composition pass runner default frame offsets were widened from three adjacent frames to `0,4,8,16,32,48,64,78` so future runs can observe ramps, persistence, and blend behavior across the whole effect window.

Wide-sample smoke validation completed in:

`var/logs/sequencer-layer-composition-training-runs/render-settings-wide-sample-smoke-20260428-210836`

Observed result:

- 36 of 36 planned smoke passes completed through the owned xLights API.
- xLights health returned to ready after the run.
- 18 `render_setting_delta_observation_v1` records were produced.
- 32 staged priors were produced; 16 include changed layer-setting context.
- Retention cleanup deleted 72 summarized temporary sequence/FSEQ artifacts.
- The owned batch payloads show verified settings were applied with no unsupported layer-setting gaps for brightness, contrast, canvas, additive mix, mix threshold, blur, persistent overlay, or fade in/out.

Wide-sample interpretation:

- Brightness and contrast still produce the only clear measured deltas in the current fixture.
- Mono-white brightness is detected as a likely clipping/no-visible-gain case, which is useful evidence for single-color training.
- Blur, canvas, additive mix, mix threshold, persistent overlay, and fade still did not move the current macro metrics even with wider frame sampling.
- This is now less likely to be a simple frame-offset problem. The next gap is fixture and measurement design: the current same-target stack is too saturated/uniform for blur, blend, canvas, and persistence to create measurable differences. Future setting-sensitivity training needs purpose-built sparse/edge-rich and overlap-rich fixtures so these settings have visible room to change the render.

Curriculum adjustment:

- Added `setting_sensitivity_edge_probe` as a dedicated matrix-based experiment family.
- The probe uses `MatrixHighDensity` with an edge-rich Bars foundation, sparse Marquee structure, and temporal Twinkle detail layer.
- The probe compares canvas, additive mix, mix threshold, blur, persistent overlay, and fade against a shared `edge_stack_default` baseline.
- This keeps the learning broad and controlled: it does not try to train every setting combination, but creates a fixture where the intended setting effects have visible room to appear.

Follow-up validation showed the matrix probe still rendered as a fully active, nearly uniform output, so it did not expose additional setting deltas. The preview windows for this run were large because high-density model windows are expensive; retention was updated so preview windows are purged after extraction and the run folder compacted from roughly 330 MB to roughly 6.7 MB.

The probe was then moved from `MatrixHighDensity` to the known-pattern `ArchGroup` target and the runner gained an `--experiment-id` filter so new probe experiments can run without repeating the full curriculum. A 16-pass targeted arch edge-probe smoke completed successfully in:

`var/logs/sequencer-layer-composition-training-runs/arch-edge-probe-smoke-20260428-212936`

Observed result:

- 16 of 16 selected edge-probe passes completed through the owned xLights API.
- xLights health returned to ready after the run.
- 14 `render_setting_delta_observation_v1` records were produced for canvas, additive mix, mix threshold, blur, persistent overlay, and fade across white-only and RGB palettes.
- No additional setting deltas were measured.
- The arch probe also rendered as full active-node coverage with no brightness motion in the extracted macro metrics.

Current interpretation: the blocker is now fixture authoring fidelity. The generated behavior records prove effects such as Marquee and Bars can produce readable segmented patterns on arch geometry, but the hand-authored layer-composition probe settings are not reproducing those known-pattern fixtures. The next training improvement should build layer-composition probe passes from existing registry/manifest sample definitions rather than hand-written approximate effect settings.

Manifest-backed edge-probe validation completed in:

`var/logs/sequencer-layer-composition-training-runs/manifest-edge-probe-native-20260429-011622`

Observed result:

- 16 of 16 selected manifest-backed edge-probe passes completed through the owned xLights API.
- xLights health returned to ready after the run and modal monitoring reported no blockers.
- The execution builder now translates sampled intent keys into xLights serialized keys before apply/render. Verified examples include `E_SLIDER_Bars_Bar_Count`, `E_CHOICE_Bars_Direction`, `E_TEXTCTRL_Marquee_Skip_Size`, `E_TEXTCTRL_Marquee_Speed`, and `B_CHOICE_BufferStyle`.
- Staged `.xsq` output confirmed those serialized settings were written to `EffectDB`.
- 14 `render_setting_delta_observation_v1` records were produced for canvas, additive mix, mix threshold, blur, persistent overlay, and fade across white-only and RGB palettes.
- Retention cleanup removed summarized `.xsq`, `.fseq`, and preview-window payloads. The run folder compacted to roughly 3.7 MB and the API staging folder to roughly 60 KB.

Extractor follow-up:

- The RGB probe revealed a measurement gap: the render had constant brightness and full active-node coverage, but the RGB palette visibly cycled color positions across the arch nodes.
- Render observations now include `colorSequenceChangeSeries`, `colorSequenceChangeMean`, and `colorSequenceChangeMax` to measure frame-to-frame color-position motion on ordered model nodes.
- The refreshed RGB `edge_stack_default` observation measured `colorSequenceChangeMean` about `0.576`, `colorSequenceChangeMax` about `0.816`, `rgbSimilarityMean` about `0.424`, and 5 dominant color transitions.
- The mono-white equivalent correctly measured `colorSequenceChangeMean` `0`, which reinforces that white-only represents single-color behavior while RGB represents multi-color behavior.

Updated interpretation:

- Settings serialization is no longer the active blocker for this probe family.
- The extractor can now capture one important class of palette-driven motion that the previous brightness/coverage metrics missed.
- The layer render setting variants still did not change the measured output relative to `edge_stack_default`. This does not prove the settings are ineffective; it shows the current stacked probe is not isolating those settings with enough visual contrast.
- The next training design improvement should add A/B and fractional-factorial probes that vary effect-level settings and layer render settings separately. The baseline must leave visible gaps, edges, partial coverage, fades, and overlaps so blur, mix method, mix threshold, canvas, persistence, and fade have room to produce measurable deltas.

Attribution-probe curriculum update:

- Added `setting_attribution_probe` as a separate experiment family, not a replacement for the grouped-arch edge probe.
- The probe uses `SingleLineHorizontal` because ordered node motion, gaps, edges, and palette-position changes are easier to attribute on a linear model.
- The probe design is explicitly `ab_and_fractional_factorial`.
- It uses manifest-backed Marquee and Twinkle samples, then compares:
  - effect-setting A/B variants such as Marquee band/skip/thickness/reverse/speed and Twinkle count/steps
  - layer-setting A/B variants such as blur, fade in/out, additive mix, and mix threshold
  - incremental layering from structure-only to structure plus sparse detail
- Effect-setting A/B evidence is now captured as first-class `effect_setting_delta_observation_v1` records and staged priors carry `changedEffectSettings` plus `observedEffects.effectSettingDeltas`.

Attribution-probe smoke validation completed in:

`var/logs/sequencer-layer-composition-training-runs/setting-attribution-probe-smoke-20260429-012725`

Observed result:

- 20 of 20 selected attribution-probe passes completed through the owned xLights API.
- xLights health returned to ready after the run and modal monitoring reported no blockers.
- 10 `render_setting_delta_observation_v1` records were produced.
- 16 `effect_setting_delta_observation_v1` records were produced.
- 18 staged priors were produced.
- Retention cleanup removed summarized `.xsq`, `.fseq`, and preview-window payloads. The run folder is roughly 5.0 MB and the API staging folder is roughly 60 KB.

Measured learnings from the smoke:

- The sparse single-line baseline produced useful partial coverage: mono-white Marquee activated 22 nodes and RGB Marquee activated the same coverage while adding color variety and color-position motion.
- RGB Marquee wide-band A/B increased active-node coverage by 22 nodes, reduced adjacent color boundaries, and increased color-position motion slightly.
- RGB Marquee reverse/speed/skip A/B increased color-position motion more strongly than the wide-band variant.
- Twinkle dense-over-sparse A/B changed texture and motion metrics on both palettes; mono-white showed larger color-position change because brightness/color values move across sparse white nodes, while RGB showed smaller but still measurable texture/color changes.
- Blur on the RGB sparse Marquee baseline substantially reduced color-position motion and increased frame-to-frame similarity, which is the kind of setting-specific evidence the prior stack was failing to expose.
- Fade in/out changed brightness variation, node-count deltas, and ramp metrics on both palettes.
- Additive mix and mix-threshold variants produced smaller but measurable deltas in the two-layer sparse-detail stack.

Updated interpretation:

- The attribution-probe shape is more useful than the saturated grouped-arch stack for isolating layer render settings.
- The next overnight run should include this family as the main setting-sensitivity workhorse while retaining grouped-arch probes for group/model and multi-layer interaction coverage.
- The next refinement should split multi-setting A/B samples into narrower single-parameter samples where possible. For example, Marquee `wide` currently changes band size, skip size, and thickness together, so the evidence is useful but not yet single-parameter causal proof.

Single-parameter attribution refinement:

- The `setting_attribution_probe` was updated so effect-setting A/B passes change one parameter at a time.
- Marquee structure probes now isolate `bandSize`, `skipSize`, `thickness`, `reverse`, and `speed`.
- Twinkle detail probes now isolate `count` and `steps`.
- Combined manifest variants are no longer used as the causal A/B evidence inside this family; manifest samples still seed the baseline settings.

Single-parameter attribution smoke validation completed in:

`var/logs/sequencer-layer-composition-training-runs/setting-attribution-single-param-smoke-20260429-013559`

Observed result:

- 28 of 28 selected single-parameter attribution passes completed through the owned xLights API.
- xLights health returned to ready after the run and modal monitoring reported no blockers.
- 10 `render_setting_delta_observation_v1` records were produced.
- 14 `effect_setting_delta_observation_v1` records were produced.
- 26 staged priors were produced.
- Retention cleanup removed summarized `.xsq`, `.fseq`, and preview-window payloads. The run folder is roughly 6.0 MB and the API staging folder is roughly 68 KB.

Measured single-parameter learnings:

- Marquee `bandSize` increased active-node coverage on both palettes; RGB also reduced color-position motion and increased frame-to-frame RGB similarity.
- Marquee `skipSize` increased active-node coverage on both palettes; RGB increased color-position motion.
- Marquee `speed` produced a clear RGB color-position motion change and increased frame-to-frame similarity, while mono-white showed only a small brightness/motion change.
- Marquee `thickness` and `reverse` did not move the current single-line macro metrics. This should be treated as a fixture/metric gap or low-impact condition, not global proof that the settings never matter.
- Twinkle `count` increased texture/color-position motion on mono-white and changed texture metrics on RGB.
- Twinkle `steps` changed texture/ramp behavior on both palettes, with different sign and strength by palette.
- Blur, fade, additive mix, and mix threshold remained measurable in the isolated layer-setting probes.

Updated interpretation:

- This single-parameter version should be the default setting-sensitivity shape for the overnight run.
- Multi-setting samples can still be useful for realistic interaction tests, but they should be classified as interaction/deepening evidence rather than causal single-parameter evidence.
- Settings with no movement in this fixture should be queued for alternate geometry or denser frame sampling rather than discarded.

Alternate-geometry low-movement retest:

- Added `low_movement_setting_geometry_probe` as a focused retest family for settings that did not move on `SingleLineHorizontal`.
- Initial targets are `ArchSingle` and `TreeFlat`.
- Initial settings are Marquee `thickness`, `reverse`, and `speed`. `speed` acts as a positive control because it already moved in RGB on the single-line probe.
- This family keeps the same single-parameter A/B discipline and uses direct verified Marquee settings to avoid ambiguous manifest sample IDs.

Alternate-geometry smoke validation completed in:

`var/logs/sequencer-layer-composition-training-runs/low-movement-alt-geometry-smoke-20260429-014806`

Observed result:

- 20 of 20 selected low-movement alternate-geometry passes completed through the owned xLights API.
- xLights health returned to ready after the run and modal monitoring reported no blockers.
- 12 `effect_setting_delta_observation_v1` records were produced.
- 16 staged priors were produced.
- Retention cleanup removed summarized `.xsq`, `.fseq`, and preview-window payloads.

Measured alternate-geometry learnings:

- `ArchSingle` behaved like `SingleLineHorizontal` for this Marquee fixture: `thickness` and `reverse` did not move the current macro metrics; RGB `speed` still produced a strong color-position motion/frame-similarity change.
- `TreeFlat` exposed the missing settings:
  - mono-white `thickness` increased active-node coverage by 94 nodes.
  - RGB `thickness` increased active-node coverage by 94 nodes and moved color-position/color-boundary metrics.
  - RGB `reverse` increased color-position motion and color variety.
  - RGB `speed` reduced color-position motion and increased frame-to-frame similarity.

Updated interpretation:

- The previous `thickness` and `reverse` no-movement result is geometry-dependent, not a global setting limitation.
- Overnight setting-sensitivity training should include at least one linear target and one broader/area target for settings that affect width, coverage, direction, or buffer interpretation.
- `ArchSingle` is not enough of an alternate geometry for this specific Marquee fixture; `TreeFlat` is more useful for these width/direction retests.

Runtime selection update:

- `build-layer-composition-training-plan.mjs` now attaches `runtimeSelection` metadata to each experiment.
- Smoke and focused validation plans preserve the full manifest order so low-yield retests remain available when validating/debugging the family.
- Overnight and extended plans now use a prioritized time-budget queue.
- The first overnight queue tier is `setting_attribution_probe` because the validated single-parameter A/B design produces causal setting deltas.
- The second tier is the `TreeFlat` `low_movement_setting_geometry_probe` because it exposed Marquee `thickness`, `reverse`, and `speed` behavior that did not appear on the linear/arch retests.
- `same_target_layer_stack` and `group_model_interplay` remain in the overnight queue for broad layer/order coverage.
- `setting_sensitivity_edge_probe` remains as lower-weight interaction deepening evidence.
- The `ArchSingle` `low_movement_setting_geometry_probe` is now deferred from normal overnight and extended runs for this Marquee setting set because recent smoke evidence showed low yield. It is still included in smoke/focused plans for repeat validation if needed.

Execution runner update:

- `run-layer-composition-pass-runner.mjs` now supports `--until-runtime-budget`.
- In budget mode, the runner uses the plan runtime budget or an explicit `--max-runtime-minutes` override and sets `requestedPasses` to `null` instead of pretending the run is pass-count driven.
- Runner summaries now report `stopStatus`, `stopReason`, `pendingPassesSelected`, `elapsedRuntimeMinutes`, and `maxRuntimeMinutes`.
- Normal budget completion is reported as `runtime_budget_reached`.
- If all selected pending passes are completed before the budget, the summary reports `queue_exhausted`. This is now visible as a real remaining gap rather than being hidden behind a fixed `--max-passes` run.
- `run-layer-composition-training.sh` passes `--until-runtime-budget` through to the runner when requested.

Adaptive refill implementation:

- `run-layer-composition-execution-scaffold.mjs` now supports append-only scaffold mode.
- Append mode preserves existing checkpoints and writes only new `(experimentId, passId)` keys.
- `build-layer-composition-adaptive-refill.mjs` creates deterministic deeper setting probes from high-priority experiments instead of blindly rerunning the same passes.
- Refill experiment IDs and pass IDs receive a `refill_NNN` suffix.
- Refill learning IDs include the refill attempt, setting name, and variant value so later priors can distinguish the evidence from the original smoke/overnight pass.
- The first refill source is limited to validated high-priority families:
  - `setting_attribution_probe`
  - `low_movement_setting_geometry_probe` for `TreeFlat`
- The refill currently deepens effect-setting probes with deterministic values:
  - `bandSize`: 5, 9, 11
  - `skipSize`: 2, 6, 8
  - `thickness`: 6, 8, 10
  - `speed`: 3, 9, 11
  - `count`: 5, 13, 17
  - `steps`: 20, 60, 80
- Boolean-only probes such as `reverse` are not repeated by this refill source because there is no new non-repeated value to learn from in the same test shape.
- In budget mode, the runner now asks the default refill provider for new work when the selected queue is exhausted and no explicit experiment filter is active.
- If no new unique checkpoints can be appended, the run reports `queue_exhausted` with the refill stop reason instead of silently ending as a successful overnight run.

Incremental learning checkpoints:

- The budget-mode runner now builds a learning checkpoint before each refill attempt.
- A learning checkpoint writes:
  - `learning-checkpoints/<label>/layer-composition-delta-summary.json`
  - `learning-checkpoints/<label>/layer-composition-priors-staged.json`
  - `learning-checkpoints/<label>/retention-cleanup-result.json`
- Learning checkpoint artifacts are retained in the retention ledger.
- Retention cleanup is applied after each checkpoint by default so summarized `.xsq`, `.fseq`, and preview artifacts do not accumulate until the end of the overnight run.
- `build-layer-composition-deltas.mjs` now includes appended refill experiments by reconstructing unknown experiment groups from checkpoint pass plans. This is required because refill experiments are appended after the original `training-plan.json` is written.
- Runner summaries now report `learningCheckpointCount` and `learningCheckpoints`.

Disk guardrails:

- The budget-mode runner now checks free disk before each pass and after checkpoint cleanup before each refill.
- If free space is at or below the stop threshold, the run stops with `disk_guardrail_stop` and `free_disk_below_stop_guardrail`.
- Warning and stop events are reported in `diskGuardrailEvents`.
- Smoke runs skip automatic filesystem disk checks unless the test harness injects a disk reading. This keeps local smoke tests stable while preserving guardrails for normal overnight runs.

Real API smoke validation:

- A two-pass real xLights smoke completed through the owned API in:
  - `var/logs/sequencer-layer-composition-training-runs/layer-composition-real-smoke-20260428-220705`
- Completed passes:
  - `group-model-interplay-mono_white / empty_baseline`
  - `group-model-interplay-mono_white / foundation_group_only`
- Runner result:
  - `processedPasses`: 2
  - `stopStatus`: `pass_limit_reached`
  - `stopReason`: `requested_max_passes_reached`
  - `elapsedRuntimeMinutes`: 1.115
- Learning artifacts:
  - completed observations: 2
  - staged priors: 1
  - render-setting deltas: 0
  - effect-setting deltas: 0
- Retention cleanup deleted 6 summarized artifacts / 531,322 bytes.
- `run-layer-composition-training.sh` now writes scaffold stdout to `execution-scaffold-result.json` during execute mode so `--apply-render` stdout remains a clean pass-runner summary.

Validation:

- `node --test scripts/sequencer-render-training/tooling/build-layer-composition-training-plan.test.mjs`
- `node --test scripts/sequencer-render-training/tooling/run-layer-composition-pass-runner.test.mjs`
- `node --test scripts/sequencer-render-training/tooling/build-layer-composition-adaptive-refill.test.mjs`
- Plan tests: 11 of 11 passing.
- Runner tests: 9 of 9 passing.
- Adaptive refill tests: 2 of 2 passing.
- Real two-pass owned xLights API smoke completed and cleaned summarized artifacts.

## Open Questions

- Which canonical training fixture best represents group plus model overlap without using project display metadata?
- What minimum delta confidence should make a composition prior selector-ready?
- How should full-sequence iteration consume these priors without repeating the same successful pattern too often?
