# Full Sequence Creation Benchmark

Status: Active
Date: 2026-04-27
Owner: xLightsDesigner Team

## Purpose

Define a repeatable benchmark for full sequence creation through the app handoff path:

1. the designer provides enough context for sequencing
2. the sequencer creates a full-pass plan for the display
3. Review applies the plan to an isolated xLights sequence
4. xLights renders the result
5. the benchmark ranks the remaining gaps from evidence

This benchmark is different from the smaller validation matrix. The matrix proves that targeted capabilities work. This benchmark evaluates whether those capabilities combine into a useful full-display sequence workflow.

## User Prompt Captured

> Let's do some benchmark tests when ready of full sequence creation so we can identify and rank gaps. We should start with the designer providing for context needed for sequence generation and then see how well the sequencer can do with the full pass creation.

Follow-up direction:

> Yes. I think we start to shift to the full display now for testing rather that indiviual effects or models

## Benchmark Scope

The default benchmark should target the full display through project display metadata and semantic tags, not a single model or isolated effect.

The benchmark may still use an isolated generated `.xsq` file for safety. That file is a test artifact, not app metadata. App metadata remains in the xLightsDesigner application project folder.

## Evidence Path

The benchmark runner should produce a `benchmark_run_v1` JSON artifact that records:

- run identity and timestamps
- project file and generated sequence path
- selected semantic tags
- display model and model group counts
- designer context payload
- latest intent, proposal, plan, apply, and render artifact IDs
- practical validation summary
- plan quality metrics
- ranked gaps

## Designer Context Expectations

For this benchmark, the designer context must be explicit enough for sequencing:

- overall goal
- mood and style
- display-wide target scope
- palette intent
- section and timing expectations
- layering expectations
- effect family preferences and avoidances
- completion policy for a full-pass sequence

The sequencer should not be expected to infer all of this from vague user language during the benchmark.

## Sequencer Expectations

The sequencer should attempt a full pass in one generated plan before render. Expected behavior:

- inspect the existing sequence state before planning
- decide which timing tracks are needed
- create complete timing tracks when needed
- anchor every effect on at least one side to timing marks or adjacent effects
- use display metadata to distribute roles across the display
- layer effects where useful instead of treating layers only as conflict avoidance
- avoid editing only one target unless the designer context explicitly limits scope
- prefer one batch apply and one render before further iteration

## Gap Ranking

The benchmark ranks gaps from most blocking to least blocking:

- `critical`: proposal/apply/render failed, xLights is blocked, or no meaningful effects were created
- `high`: output is technically valid but not close to full sequence behavior
- `medium`: output is usable for plumbing but has clear artistic or coverage limitations
- `low`: polish, traceability, or reporting improvements

Primary quality signals:

- timeline coverage ratio
- active target ratio
- target count
- effect command count and commands per minute
- distinct effect count
- dominant effect share
- multi-layer target count
- empty section count
- free-floating timing boundary count
- missing metadata count

## Current Interpretation

The validation matrix is now good enough to start this benchmark, but it should not be mistaken for evidence of full sequence quality. It mostly proves handoff mechanics and xLights API application. The benchmark should expose where the sequencer still behaves like a targeted edit planner instead of a full-display sequence author.

## First Benchmark Evidence

Initial run:

- run ID: `2026-04-27T14-24-18-968Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T14-24-18-968Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T14-24-18-968Z/full-display-benchmark.xsq`
- apply status: `applied`
- render: accepted

Headline metrics:

- effect command count: `8`
- commands per minute: `4`
- timeline coverage ratio: `0.3443`
- active target ratio: `0.7273`
- target count: `8`
- distinct effect count: `1`
- distinct effects: `Marquee`
- free-floating boundary count: `0`
- missing metadata count: `6`
- multi-layer target count: `0`

Read:

- the end-to-end designer context -> sequencer proposal -> Review apply -> xLights render path works
- timing anchoring is present, with no free-floating boundaries in this run
- the output is not yet strong full-sequence authoring because it is sparse, dominated by one effect, missing layered composition, and only partially covers the timeline
- the next implementation work should focus on full-pass command synthesis and richer section progression rather than more plumbing validation

## Deterministic Effect Portfolio Update

Second run after adding deterministic, training-guided full-display effect portfolio planning:

- run ID: `2026-04-27T14-42-01-706Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T14-42-01-706Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T14-42-01-706Z/full-display-benchmark.xsq`
- apply status: `applied`
- render: accepted

Headline metrics:

- effect command count: `40`
- commands per minute: `20`
- timeline coverage ratio: `0.99999`
- active target ratio: `0.9091`
- target count: `10`
- distinct effect count: `4`
- distinct effects: `Spirals`, `Twinkle`, `Shockwave`, `SingleStrand`
- dominant effect share: `0.25`
- multi-layer target count: `3`
- free-floating boundary count: `0`
- crossing section timing count: `0`

Read:

- the full-display planner now creates a materially fuller first pass
- effect choice is deterministic and drawn from selector-ready trained effects
- effect assignment is role based, not random
- each placement records `metadata_training_ranked_no_random` selection policy in command intent
- remaining gaps are now centered on richer display metadata, traceability from designer handoff into plan metadata, and visual quality review rather than basic coverage

## Designer Traceability Update

Third run after promoting native design intent into a persisted `sequencing_design_handoff_v2` artifact and preserving that handoff through Review apply:

- run ID: `2026-04-27T14-47-06-550Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T14-47-06-550Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T14-47-06-550Z/full-display-benchmark.xsq`
- apply status: `applied`
- render: accepted

Headline metrics:

- effect command count: `40`
- commands per minute: `20`
- timeline coverage ratio: `0.99999`
- active target ratio: `0.9091`
- target count: `10`
- distinct effect count: `4`
- dominant effect share: `0.25`
- multi-layer target count: `3`
- free-floating boundary count: `0`
- crossing section timing count: `0`

Traceability evidence:

- latest plan handoff carries `sequencingDesignHandoffSummary`
- latest plan handoff references `sequencing_design_handoff_v2-aa22fd5c`
- latest plan handoff metadata includes `sequencingDesignHandoff.artifactType = sequencing_design_handoff_v2`

Current ranked benchmark gap:

- display metadata coverage is incomplete: `missingMetadata = 8`

Read:

- the traceability gap is closed for the native benchmark path
- the benchmark is now primarily pointing at project display metadata completeness and later visual-quality review

## Semantic Metadata Coverage Update

Fourth run after updating practical validation to treat exact semantic tag targets as covered when project display metadata assigns that tag to member models:

- run ID: `2026-04-27T14-55-19-463Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T14-55-19-463Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T14-55-19-463Z/full-display-benchmark.xsq`
- apply status: `applied`
- render: accepted

Headline metrics:

- effect command count: `40`
- timeline coverage ratio: `0.99999`
- active target ratio: `0.9091`
- target count: `10`
- distinct effect count: `4`
- multi-layer target count: `3`
- free-floating boundary count: `0`
- metadata missing count: `0`

## Full-Pass Review Apply Limit And Composition Diagnostics Update

Later runs after adding `composition_plan_v1`, full Review apply headroom, section attribution, and broad display target expansion:

- command limit blocker fixed: Review/native apply now uses a full-pass Review limit of `500` commands instead of the generic `200` command default
- section attribution fixed: generated full-display placements now carry `sourceSectionLabel`, and practical validation can read section labels from timing mark anchors
- broad display target expansion added: full-display planning treats selected semantic tags as a starting point and adds deterministic broad xLights display groups when present
- render critique now compares planned tags/groups to observed concrete model names through project metadata aliases

Latest live gate:

- run ID: `2026-04-27T16-47-40-242Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T16-47-40-242Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T16-47-40-242Z/full-display-benchmark.xsq`
- apply status: `applied`
- effect command count: `221`
- plan command count: `232`
- target count: `17`
- timeline coverage ratio: `0.99999`
- active target ratio: `1`
- distinct effect count: `7`
- free-floating boundary count: `0`
- composition section coverage: `12/12`
- render quality: `0.0`, band `very_low`

Read:

- the handoff, command generation, apply, readback, and benchmark gate are working end to end
- the plan structurally covers the whole sequence and all planned composition sections
- the generated `.xsq` has the expected media file and `sequenceDuration = 207.215`
- the latest render observation reports visible Intro content, but blank sampled windows after Intro
- next work should investigate render/apply persistence across post-Intro windows before judging effect selection quality from this run alone
- ranked benchmark gaps: none

Read:

- the prior metadata gap was a validator coverage mismatch, not missing project metadata
- full-display targets may be semantic groups/tags while app metadata remains assigned to member models
- validation now recognizes exact tag-level coverage and still reports truly unknown observed targets
- the current benchmark path is clean enough to move from plumbing coverage into visual quality, sequence density, and agent iteration scoring

## Native Apply Readback Update

Fifth run after correcting the native apply orchestration for mixed full-display plans:

- run ID: `2026-04-27T15-02-24-323Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T15-02-24-323Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T15-02-24-323Z/full-display-benchmark.xsq`
- apply status: `applied`
- render: accepted

Readback and validation:

- expected mutations present: `true`
- revision advanced: `true`
- practical validation overall: `true`
- readback checks: `46 passed`, `0 failed`
- metadata missing count: `0`
- ranked benchmark gaps: none

Implementation notes:

- auxiliary timing tracks are now applied through direct owned timing commands while the primary section timing track and planned effects stay on the owned batch apply path
- direct timing mutations now wait for queued owned jobs before later commands and readback checks continue
- display-order readback validates the expected relative order and permits additional timing rows created by the same plan
- this closes the benchmark plumbing gap where fallback apply produced valid xLights mutations that did not match the sequencer plan

## Audio Duration And Render Quality Update

Sixth run after aligning benchmark sequence creation to the active audio file and adding numeric render-quality scoring:

- run ID: `2026-04-27T15-32-49-034Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T15-32-49-034Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T15-32-49-034Z/full-display-benchmark.xsq`
- audio: `/Users/robterry/Documents/Lights/Current/Christmas/Show/Audio/01 It's Beginning To Look a Lot Like Christmas.mp3`
- audio duration source: `track_record`
- sequence duration: `207216ms`
- apply status: `applied`
- readback checks: `46 passed`, `0 failed`

Render quality:

- overall score: `0.06`
- band: `very_low`
- issues: `display_coverage_too_sparse`, `large_display_regions_unused`, `design_focus_not_observed`, `lead_model_not_expected_focal_candidate`, `left_right_imbalance`, `top_bottom_imbalance`, `adjacent_sections_read_too_similarly`

Ranked gaps:

- critical: rendered sequence quality is very low
- high: command density is too low for full sequence authoring
- medium: some sections have no placements

Read:

- the benchmark now matches the active audio duration instead of using a fixed validation duration
- readback success is no longer treated as creative success
- the current generated sequence is correctly scored as a very weak result, matching human visual inspection
- the next major transparency-layer gap is a human-sequence pattern layer: the sequencer needs structured examples of what complete sequencing looks like by section, role, density, effect family, layering, timing relation, and progression

## Reference Pattern Layer Update

The first read-only production reference-pattern artifact was created from the Christmas production show folder:

- source root: `/Users/robterry/Documents/Lights/Current/Christmas/Show`
- artifact: `sequence_reference_patterns_v1-ff641572`
- artifact path: `/Users/robterry/Documents/Lights/xLightsDesigner/projects/Christmas 2026/artifacts/sequence-reference-patterns/sequence_reference_patterns_v1-ff641572.json`
- analyzed sequences: `39`
- skipped sequences: `1`

Aggregate pattern signals:

- total effects: `45732`
- average effects per sequence: `1172.62`
- average active targets: `32.15`
- average layered targets: `10.62`
- density per minute: p25 `109.96`, median `242.02`, p75 `433.59`
- common effects: `SingleStrand`, `On`, `Shockwave`, `Color Wash`, `Spirals`, `Pinwheel`, `Marquee`, `Morph`, `Curtain`, `Ripple`, `Wave`, `Fan`
- target role mix leads with `accent`, `foundation`, `outline`, `support`, `feature`, `full_display`

Implementation notes:

- production `.xsq` files are read only
- the artifact stores generalized pattern summaries, not full copied sequence payloads
- the latest `sequencing_design_handoff_v2` now carries a compact `referenceSequencePatterns` summary
- `sequence_agent` plan metadata now exposes the reference artifact id, density baselines, common effects, active-target baseline, and layered-target baseline
- deterministic effect selection can include reference common effects as transparent context while still filtering through available/trained effect metadata

Follow-up benchmark:

- run ID: `2026-04-27T15-55-54-334Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T15-55-54-334Z/benchmark-run.json`
- sequence duration: `207216ms`
- readback checks: `46 passed`, `0 failed`
- render quality score: `0.14`, band `very_low`
- key remaining gap: command density is `11.58 commands/min`, far below the reference median of `242.02 commands/min`

Read:

- the reference layer is now present in the handoff path
- the generated output is still not using the reference density/coverage strongly enough
- next implementation should turn the reference pattern summary into scale-aware full-pass planning: more section/phrase placements, broader active target use, and more layered targets before render

## Reference-Guided Full-Pass Scale Update

The sequencer now uses the read-only reference-pattern summary to scale a full-display first pass instead of only using reference effects as candidate names.

Implementation notes:

- reference density is bounded before use; the first pass targets a conservative fraction of the production reference baseline instead of jumping directly to the median
- full-display planning now rotates through more active targets and creates deterministic layer overlays on a bounded target subset
- section position maps to reference buckets: `opening`, `early_body`, `middle`, `late_body`, `ending`
- bucket-specific reference effects are used only after filtering through available/trained effect metadata
- generated effects remain anchored to timing boundaries or adjacent effects; free-floating effects are still invalid
- no production sequence payloads are copied into the generation plan

Benchmark after scale update:

- run ID: `2026-04-27T16-01-21-800Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-27T16-01-21-800Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-27T16-01-21-800Z/full-display-benchmark.xsq`
- effect commands: `180`
- plan commands: `191`
- effect density: `52.12 commands/min`
- distinct effects: `7`
- active target ratio: `1`
- multi-layer target count: `6`
- timeline coverage ratio: `0.999995`
- free-floating effects: `0`
- readback checks: `186 passed`, `0 failed`
- apply status: `applied`

Render quality:

- previous score: `0.14`, band `very_low`
- new score: `0.42`, band `weak`
- remaining issues: `large_display_regions_unused`, `design_focus_not_observed`, `lead_model_not_expected_focal_candidate`, `left_right_imbalance`, `top_bottom_imbalance`

Read:

- the reference example layer now improves density, target coverage, effect variety, layering, and timing anchoring
- this is still not a complete sequencing intelligence layer; render critique still sees weak focal intent and poor spatial balance
- the next gap is not basic apply plumbing or sparse output, but musical/design coherence: choosing which display regions should carry the design focus, how those regions should balance across the yard, and how the look should progress across song sections

## Post-Training Trace Benchmark

After the 2026-04-28 render-training promotion, the benchmark runner was updated to:

- filter native validation artifacts to the isolated benchmark sequence so stale project artifacts are not scored
- report blocked Review apply states instead of timing out
- include `sequencer_training_usage_trace_v1` metrics from practical validation
- expose configured behavior, parameter-prior, sourced-prior, and palette-payload coverage in the benchmark headline

An apply blocker was found and fixed before the clean run:

- blocker: `effects.alignToTiming` commands outside the primary owned batch subset were treated as unsupported by direct apply
- fix: direct apply now accepts those alignment commands as no-ops because the effect commands already carry explicit start/end timing

Trace-enabled benchmark:

- run ID: `2026-04-28T14-49-46-813Z`
- report: `var/benchmarks/full-sequence-creation/2026-04-28T14-49-46-813Z/benchmark-run.json`
- sequence: `/Users/robterry/Desktop/Show/_xlightsdesigner_benchmarks/2026-04-28T14-49-46-813Z/full-display-benchmark.xsq`
- sequence duration: `207216ms`
- apply status: `applied`
- xLights API failures: `0`
- modal blockers: none observed

Headline metrics:

- effect commands: `4`
- timeline coverage ratio: `0.1994`
- active target ratio: `1`
- target count: `4`
- distinct effect count: `1`
- distinct effect: `Marquee`
- effect usage score: `0.329`
- configured behavior coverage: `0`
- parameter prior coverage: `0`
- sourced prior coverage: `0`
- palette payload coverage: `1`
- render quality score: `0.509`
- render quality band: `weak`

Read:

- the promoted training is available, and the benchmark can now trace whether it is consumed
- this run did not consume trained behavior records or parameter priors
- the generated proposal had no semantic display tags available, fell back to a narrow four-target arch/cane scope, and produced only four Marquee effects
- the immediate blocker before more training is full-sequence generation scope and training-consumption wiring, not lack of additional render samples

Ranked next gaps:

1. Restore reliable project display metadata/tag availability for the benchmark path.
2. Ensure full-sequence proposal generation produces a real sequencer plan with section/phrase-scale placements, not a four-line narrow edit proposal.
3. Require the sequencer to use configured behavior records and derived parameter priors when selecting and configuring effects.
4. Rerun the trace-enabled benchmark and only then decide whether the remaining `effect-sampling-audit` queue is the next best investment.

## Display Metadata Capture Boundary

The benchmark should not silently manufacture project display metadata from the copied production layout. The intended metadata source is the user/agent display-discovery conversation.

Correct flow:

1. The app exposes xLights-derived structural context from the linked development show folder.
2. The display-discovery agent discusses the display with the user and asks targeted questions.
3. Confirmed user meaning is captured as project display metadata in the xLightsDesigner app project store.
4. The user can review and apply proposed display metadata.
5. Full-sequence generation consumes the confirmed project metadata to choose display targets and roles.

Boundary:

- xLights-derived metadata can suggest questions and candidate groupings.
- It must not become semantic truth by itself.
- Effect render training remains independent of project display metadata.
- Full-sequence generation combines confirmed display metadata with effect training at runtime.

For the current benchmark gap, the next implementation should validate and improve this conversation-to-metadata path rather than seeding metadata directly from layout as a shortcut.
