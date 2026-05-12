# Render Training Knowledge

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-05-12
Supersedes: dated render-training plans, training audits, reset plans, overnight plans/results, and consolidation notes

## Purpose

Define the durable training and learned-knowledge layer for sequence generation.

## Current Knowledge Stack

- promoted effect screening record packs
- generated semantic record packs
- unified training set
- effect capability and parameter semantics
- shared-setting and interaction semantics
- compact runtime bundles for derived parameter priors, layer-composition priors, behavior-capability records, shared settings, and Stage 1 selection knowledge
- proof summaries and retained compact fixtures

## Retention Policy

Keep compact, promoted, reusable knowledge in git. Treat large run logs, generated manifests, raw render artifacts, and one-off dossiers as rebuildable local artifacts unless explicitly promoted.

Durable artifacts should answer:

- what an effect can visually do
- what each important parameter changes
- which parameters interact
- how geometry changes behavior
- what layer combinations work
- which evidence supports the conclusion

## Training Workflow

1. Generate or select candidate sweeps.
2. Run proof or render validation.
3. Store raw run output outside the durable spec layer.
4. Review whole-display section renders with deterministic metrics and, when available, video/vision critique.
5. Promote compact records only after they are useful for runtime planning.
6. Regenerate derived bundles from promoted records.
7. Update this document when durable learning changes.

## Render Review Training

The next training method is section-level render review. Target/effect proof is necessary, but it is not sufficient because it only proves that xLights produced output. Sequencing quality must be judged from the rendered whole-display result over time.

The preferred evidence unit is a short section video or ordered frame sequence. Contact sheets and sampled frames are useful diagnostics, but the durable training artifact should represent temporal behavior: pacing, motion coherence, transitions, energy contour, color evolution, target hierarchy, and musical fit.

`render_review_v1` is the compact review artifact for this layer. It should carry the section intent, local evidence refs, deterministic temporal/visual metrics, quality scores, critique, revision recommendation, and promotion blockers. Raw video and full frame images remain local/generated artifacts unless explicitly retained for a proof.

The first implementation step is deterministic review from ordered frame metrics. Vision review should be added as a second pass once section video or ordered frame strips are reliably available. The long-term self-improvement loop is:

1. generate candidate section
2. apply and render in xLights
3. capture section video or ordered frames
4. score deterministic metrics
5. run artistic/vision critique when available
6. revise the plan
7. re-render
8. compare before/after
9. store accepted improvements as project-local evidence
10. promote only compact repeated patterns

## Custom Model Learning Strategy

Custom models should not be trained by forcing them into built-in model classes. Their construction is user-defined and effectively unbounded, so most custom models will not cleanly match a star, spinner, cane, matrix, tree, or line training profile.

Custom model learning is primarily local, per user installation, and per project/display. Centralized training can provide general effect behavior, parameter priors, conservative probe recipes, and interpretation rules, but it cannot pre-train reliable knowledge for every user's custom props. The app must assume that each installation may contain custom model structures it has never seen before.

The submodel framework must be shared across all model types. Submodels on built-in models, imported models, and custom models should use the same target identity, metadata, render evidence, and learning pipeline. Custom models should only receive extra attention because submodels are more often the primary sequencing surface, not because they use a separate submodel system.

The app should learn model and submodel behavior in layers:

1. Capture objective structure from the current display:
   - node layout and coordinate extents
   - node order/path continuity
   - density, aspect, sparsity, and populated regions
   - submodel definitions, node membership, naming, ranges, and overlap
   - preview/render geometry when available
2. Capture semantic project metadata:
   - what the user says the target represents
   - broad role such as focal, support, accent, or background
   - broad use hints such as character, radial, outline, lyric, slow movement, or sparse accent
   - effect avoidances and special handling
3. Run effect probes against the actual target when useful:
   - start with low-risk effects and conservative settings
   - render short validation windows on both parent models and important submodels
   - observe coverage, motion, color spread, readability, flicker, and blank-node behavior
   - compare outcomes against the requested intent and metadata
4. Promote learned behavior as target/submodel structure evidence:
   - keyed by stable target fingerprint and compact structural features
   - scoped to parent or submodel target, effect family, parameter region, and observed outcome
   - reusable only for similar structure and metadata context
   - never promoted solely because of the model name

This means model and submodel support starts from general effect knowledge and runtime validation, then becomes more confident per display as the app observes how effects render on each target. Mature project metadata helps the agent choose what to try. Render evidence teaches the app what actually works for that user's installation.

Submodels are important across all model types and should be learned consistently. The parent model is still important for identity, fingerprinting, whole-prop fills, and fallback targeting, but many useful sequencing decisions happen at the submodel level. Custom models raise the priority of this work because their useful visual regions are often defined primarily by submodels. The shared learning framework must therefore model:

- submodel purpose and relationship to the parent
- submodel node coverage, density, and visual region
- sibling overlap or adjacency
- whether a submodel reads as a feature, layer, outline, segment, mouth/eye, spoke/ring, or other structure
- effect behavior when applied to a single submodel versus the parent
- effect behavior when multiple sibling submodels are layered or sequenced in succession

Render validation evidence should carry a compact, bounded submodel context for selected parent or submodel targets. This evidence is not a replacement for the full scene graph; it preserves the target id, parent id, sibling count/ids, overlap ids, node coverage, and structure hints needed by the next proposal/revision pass. Keeping this context with the evidence lets later probes reason about why a render did or did not work on a target without copying the entire display model into every artifact.

Candidate selection may derive an advisory submodel probe plan from this evidence. The probe plan should recommend parent controls, submodel-first checks, and sibling-pair checks when the target has feature submodels, small coverage regions, overlapping sibling submodels, or many sibling regions. This plan is guidance for runtime probing and review; it should not silently rewrite user-requested targets.

Model and submodel learning should answer practical questions:

- which effects produce readable coverage on this target
- which effects leave important regions blank
- whether motion reads directionally or as noisy sparkle
- whether submodels should be targeted instead of the full parent
- which submodels are useful lead/detail targets and which are better treated as supporting regions
- whether sibling submodels should be chased, alternated, layered, or kept synchronized
- which settings are too dense, too sparse, too fast, or visually confusing
- whether the target is reliable as a lead, support, accent, or texture surface

The durable shared training layer may eventually aggregate anonymized structural patterns across projects, but project-local evidence should remain valid on its own and should not depend on centralized promotion. A custom model that only exists in one display can still become useful through that display's metadata, render probes, and accepted sequence history.

Local custom-model learning should be stored with the project or user installation, not only in the central training package. It should survive normal project reopen and show-folder refresh, and should be portable when the user explicitly migrates or copies the project. Local learning should remain advisory and reviewable because users may intentionally change props, layouts, wiring, or metadata.

Shared render-training priors are a representative baseline, not an exhaustive model catalog. The vendor fixture is intentionally an average display set used to learn reusable effect behavior, layering principles, pacing, display balance, color discipline, local readability, and creative revision patterns. Runtime selection may apply those priors only when the current target is structurally and semantically compatible. Similarity should be evaluated from canonical type, geometry, dimensions, node layout, density, submodel structure, role metadata, effect context, and palette/intent compatibility. User-defined model names are labels, not compatibility proof.

When a target is unknown, custom, unusually wired, sparsely populated, or otherwise outside the representative baseline, the app should favor project-local validation over confident reuse. The shared prior can propose conservative probes and starting settings, but accepted behavior must accumulate in `display/target-behavior.json` under the target or submodel fingerprint before the selector treats that target as well understood.

Project-local target and submodel behavior learning is stored in `display/target-behavior.json`. Each record is keyed by target/submodel fingerprint, effect family/name, and probe scope. Records keep compact evidence references, structure hints, submodel context, parent context, observed coverage/readability outcomes, and aggregate sample counts. This is the durable project layer where accepted render/probe outcomes can accumulate before any optional shared-training promotion.

The submodel and parent context in behavior learning should come from the effective runtime scene graph after enrichment from `display/model-index.json`. This means target behavior learning can retain parent identity, compact parent custom-structure signals, node coverage, sibling context, and structure hints even when the live scene graph only provided partial submodel data. If a later refresh enriches the submodel metadata, the behavior record should be updated under the same fingerprint/effect/scope aggregate rather than creating a new record id.

Training cleanup and future training exports should derive custom-model and submodel facts from `display/model-index.json` and `display/target-behavior.json`. They should not reintroduce separate custom-model artifact paths or duplicate model parsing logic. The project-local contract is the source layer; central/shared training packages may consume curated exports from it.

Use `scripts/designer-training/export-target-behavior-training-summary.mjs` to create anonymized calibration summaries from a project. These summaries remove target ids, display names, parent names, raw render refs, and full geometry payloads. They are review inputs for possible shared-training promotion, not runtime artifacts.

The sequencer execution training module documents the current package contracts, compact fixtures, runtime coverage, and promotion rules in `../../training-packages/training-package-v1/modules/xlights_sequencer_execution/README.md`.

## Current Learnings

- Generated record packs replaced thousands of loose semantic files.
- Promoted screening records are packed into JSONL shards with an index.
- Proof fixtures were compacted; full geometry dumps are local/generated except for the retained render-training proof input.
- Runtime training bundles are compact generated JavaScript behind `trained-effect-knowledge.js`; exporters should not emit pretty-printed payloads.
- Training records should be consolidated into reusable effect semantics and priors before additional broad training runs.
- Sequencer execution training now has a package-level readiness validator plus compact model-index, target-behavior, and combined target-context fixtures.
- Built-in and custom parent submodels are covered by the same model-index and target-behavior framework in both package fixtures and runtime candidate-selection tests.
- The sequence-agent prompt now defines target-context precedence: live xLights readback, `display/model-index.json`, project display metadata, `display/target-behavior.json`, then names only as labels or fallback identifiers.
- The first self-improvement loop is manifest-driven and starts with `On`, `Bars`, `Color Wash`, and `SingleStrand`; `Shimmer` is intentionally excluded from the initial validation scope because it is lower value for proving sequencing quality. Live custom-submodel probes are opt-in and feed the same project-local target-behavior export and promotion gate.
- The sequencing-quality curriculum is now explicit and controller-facing. The active goal map lives in `../../scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json`, with operating guidance in `sequencing-quality-curriculum.md`. Automated loops should select work from that curriculum, not from unconstrained exploration.
- Unattended RGB display-validation cycles showed a repeatable split in display-level behavior:
  - motion-pacing validation produced consistent first-pass gains around `+0.0105` overall aesthetic score, then repeated neutrally;
  - spatial negative-space and spatial focal-control validations were stable and near-neutral;
  - the original color-purpose/motion validation repeatedly dropped around `-0.0097`, mainly from color-discipline, transition-flow, and motion-interest losses.
- Color-purpose/motion validation should preserve the stable spatial/focal foundation and add restrained disciplined motion. Replacing the foundation with a separate color stack produced measurable whole-display regression. Quality-improvement unattended runs now stop on the first meaningful regression so the agent can adjust the curriculum or strategy before spending more render time.
- The repaired color-purpose/motion path remained stable through repeated validation cycles after the fix, while motion pacing stayed directionally positive but below promotion threshold. The next scoring layer should therefore judge broader video quality rather than only repeated candidate-pass stability. `video_aesthetic_score_model_v2` adds full-display context dimensions for narrative shape, focal handoff stability, palette purpose coverage, and full-sequence context while preserving the selected candidate-pass score for targeted controller decisions.
- Creative revision variants now include focus simplification, focal handoff stability, and pacing balance. These variants should be evaluated against their targeted objective and not only by raw intent-match delta, because the stronger video-level scorer can expose weaknesses such as focal handoff and pacing even when a selected pass is mechanically acceptable.
- Production-video human review is now a working calibration path. Eight accepted production references have structured multiple-choice human labels. The regenerated `production_human_review_calibration_v1` artifact is approved, and `production_human_scorer_alignment_v1` shows current automated full-sequence dimensions are not yet reliable enough as direct optimization targets. Energy arc, section contrast, and palette evolution are partially aligned and should be used with guardrails. Focal handoff, target hierarchy, and overall fit are weakly aligned and must be driven by human labels or retuned evidence before unattended optimization.
- `human_calibrated_candidate_evaluation_v1` is the bridge from calibration to generated training. It consumes generated `video_aesthetic_score_v1` full-sequence candidates, compares them to approved human target bands, and labels each dimension as optimization support, guardrail, or diagnostic based on human/scorer alignment. Current calibration has no fully aligned automated dimensions, so candidate promotion should still require human review or scorer retuning; the artifact is useful now for ranking candidates and preventing weak dimensions from becoming the training objective.
- Calibrated full-sequence loops now run against the vendor fixture. Mono display-quality strategies plateaued near `0.716` overall because palette-purpose coverage remained neutral and color-purpose roles were missing from the selected plan evidence. After expanding the controller's weak-dimension detection and routing palette-purpose weakness to RGB palette repair, `palette_depth_contrast_motion_repair` produced `0.768039` overall, raised palette-purpose coverage from `0.5` to `0.933333`, and kept all human-calibrated guardrail metrics inside the human IQR. The attempt remained neutral rather than promoted because section-quality mean regressed, so the next improvement should preserve the RGB palette role gains while repairing section quality, visual balance, temporal continuity, and quality consistency.
- Full-sequence display-quality scoring must use all eligible evidence windows for display-quality-review candidates. A selected single repair window can falsely look improved while the whole sequence regresses. After switching display-quality candidates to whole-display scoring, `loop-000040` correctly dropped from a selected-section score of `0.767083` to a whole-sequence score of `0.751627`, exposing palette-purpose, quality-consistency, and temporal-continuity regressions that were previously masked.
- The controller should respond to meaningful regressions against the best baseline, not only absolute weak-score thresholds. Palette-purpose coverage around `0.766667` was above the weak threshold but was a large regression from the `1.0` baseline, so routing needed to continue through palette repair rather than unrelated color-discipline work.
- Color-rich display candidates should remain on RGB/palette-preserving strategies. `simultaneous_display_balance_revision` and `focal_consistency_repair` fell back to mono-white branches and erased RGB palette gains, producing large regressions around `0.724` and `0.722`. Once a generated sequence has strong palette-purpose coverage and color discipline, the controller should not select mono-style display repairs for that branch.
- `loop-000045` is the current best calibrated whole-display generated candidate in this run segment: `0.788322` overall versus the `loop-000039` baseline of `0.788374`, with no meaningful dimension regressions, palette-purpose coverage `1.0`, color discipline `0.979167`, and full-sequence context `0.804775`. It is neutral, not promoted, because the human-calibrated gate still has no fully aligned optimization metrics.
- Full-sequence repeat evidence should isolate one selected repeat at a time. Bundling `display_rgb_regional_focus_contrast` and `display_rgb_structure_balance_pacing_repair` in `loop-000047` improved pacing slightly but regressed palette purpose, quality consistency, temporal continuity, and intent match, dropping the whole-display score to `0.752455`. Repeat queues for full-sequence display quality should therefore be single-candidate runs for clearer attribution.
- Isolated display-level repeats confirmed a distinction between local render quality and sequence-level usefulness. `display_rgb_structure_balance_pacing_repair` repeated as stable local evidence with section quality around `0.933708`, but the whole-display candidate scored only `0.751684` because palette-purpose coverage, quality consistency, temporal continuity, and full-sequence context regressed. `display_rgb_regional_focus_contrast` similarly repeated as local evidence but scored `0.762786` whole-display. These records are useful target/effect behavior evidence, not full-sequence composition recipes.
- Section-level effect-fit loops should not drive display-level video-aesthetic repair. Their `video_aesthetic_score_v1` artifacts have `metricScope: section_render` and `promotionUse: sequencing_behavior_candidate`; display full-sequence goals should react only to `metricScope: full_sequence_render` with primary human-level promotion use. Otherwise an effect/model probe can incorrectly pull the controller back into display composition repair.
- Safe local evidence must be tested over a stable palette-spatial foundation, not over the weaker RGB color-discipline base. The first safe-local run over the weaker base scored `0.740696`; adding palette depth/transition/spatial dependencies raised it to `0.768293`; replacing the safe-local pass with restrained palette-spatial structure plus only line/star local details produced the best current generated whole-display score, `loop-000054` at `0.791014`, with no meaningful regressions versus `loop-000039`. This suggests local detail can help when it is layered onto a coherent palette/spatial structure and kept sparse.
- Safe-local validation repeated successfully in `loop-000055`, scoring `0.791093` with no meaningful regressions and promoting `display_safe_local_evidence_repair` as selector-ready. The repeat improved confidence that restrained local detail can be added after palette/spatial structure without harming whole-display readability. The controller correctly moved next to multi-section music structure rather than continuing to over-optimize display scoring.
- Multi-section music structure needs enough whole-display context to read as song structure. The first run was too sparse and scored `0.746440`, with intent match `0.637989`, visual balance `0.399918`, and active coverage mostly below `0.013`. Adding low-brightness tree/background structure to the music passes raised the score to `0.799408`, the best generated whole-display score so far, with strong gains in quality consistency, focal clarity, focal handoff stability, and temporal continuity. Remaining tradeoffs are color discipline, intent match, visual balance, and narrative shape, so the next music revisions should keep the background context while tightening palette restraint and section contrast.
- Applying the generic palette section pacing repair after the music-structure candidate did not help; `loop-000058` dropped to `0.785733` and regressed focal clarity, intent match, and focal handoff stability. The better branch is `loop-000057`. Music-structure improvement should continue by tuning the music passes directly rather than replacing them with a generic display-pacing repair.
- Repeating the full music-structure set with adequate pass budget held the `0.799408` whole-display score with zero regressed dimensions and promoted all four music-structure priors (`section_phrase_energy`, `multi_section_energy_arc`, `motif_reprise_variation`, and `lyric_phrase_release`). A partial repeat that stopped before motif/lyric looked regressed, so controller-driven runs must allow enough passes to execute the complete selected plan before judging whole-display quality.
- Targeted display-aesthetic variants after the music branch did not beat the `loop-000060` baseline. Palette motion/pacing variation, spatial negative space, and motion/pacing reprise each improved some dimensions such as color discipline, narrative shape, pacing variety, or visual balance, but all regressed the whole-display score (`0.784207`, `0.780346`, and `0.786523` versus `0.799408`) by trading away quality consistency, focal clarity, focal handoff stability, temporal continuity, or full-sequence context. These local/display priors are still useful evidence, but they should not become full-sequence recipes without a redesigned strategy.
- The controller now pauses after a cluster of targeted display-aesthetic regressions instead of blindly advancing or generic-repairing a bad branch. The next strategy should redesign display-level candidates around preserving the stable music/background/focal foundation first, then varying one dimension at a time with tighter full-sequence guardrails.
- A redesigned guarded-motion display target needs to be represented as a small sequence candidate, not one isolated pass and not a long dependency chain. The single-pass version scored only as section evidence (`0.724982`), while the dependency-chain version mixed in older weak comparison windows (`0.795460`). The three-window intro/lift/release version scored as full-sequence evidence and produced the new best generated score, `loop-000067`/`loop-000068` at `0.805191`, then repeated exactly with zero regressed dimensions and promoted all three guarded-motion priors. This confirms that whole-display sequence candidates should be compact multi-window structures with explicit progression, while old comparison scaffolding should not be treated as the generated sequence itself.
- The guarded-motion candidate still has tradeoffs: it improved focal handoff stability, full-sequence context, temporal continuity, and quality consistency, but regressed focal clarity, pacing variety, section quality mean, and display evolution relative to `loop-000060`. The next display strategy should preserve this compact intro/lift/release structure while improving focal clarity and pacing variety without adding broad dependency chains.
- A focal/pacing refinement over the guarded candidate did not improve the branch. It scored `0.803624` versus the `loop-000068` baseline of `0.805191`, improving only intent match and visual balance while regressing focal clarity, focal handoff stability, and motion interest. The controller now treats negative-delta redesigned display branches as strategy-expansion blockers instead of repeating their local blocked records, because local pass quality can look promising even when whole-sequence quality moves down.
- Focal-isolation and controlled-counterpoint refinements also failed to beat the guarded-motion baseline. `loop-000070` preserved the original focal anchor and reduced support motion, but scored `0.804826` and regressed motion interest. `loop-000071` restored short low-intensity support motion, but scored `0.804573` and regressed focal handoff stability. The useful learning is that the current `loop-000068` guarded-motion structure is a narrow optimum: removing support motion makes it static, while adding late support motion competes with the focal handoff.
- After these display redesign branches are exhausted, the controller should pivot to other curriculum areas instead of generating more minor display variants. Music structure is preferred when incomplete; otherwise creative-intent coverage is preferred before lower-level RGB layer probes. Low-level section-scope probes should remain behavior evidence and should not be compared directly to the best full-sequence candidate.
- Baseline-preserving synthesized audio overlays work best when they add semantic timing roles over the strongest guarded display foundation instead of rebuilding the display stack. The first overlay was close but lost palette-purpose coverage; assigning the release cue a distinct `lyric_focal_accent` purpose fixed that and promoted the palette-role overlay in `loop-000128` at `0.805218`. Attempts to improve the same branch by adding support motion or increasing the existing phrase motion did not help (`loop-000129` scored `0.805093`), so motion-interest repair should not be chased through extra overlay activity unless the whole-display metric improves.
- Controlled audio-overlay style variation is useful as style-range evidence, not just as a single best recipe. `loop-000130` and `loop-000131` repeated at `0.805989`, `+0.000771` over the promoted palette-role overlay with zero regressed dimensions, and promoted the three style-variation priors. This supports the curriculum direction of learning multiple guarded timing/color-purpose variations for similar musical intent instead of converging every sequence toward one static effect setting.
- Cross-target call/response is risky over the current guarded foundation. `loop-000132` dropped to `0.804616` versus the `loop-000131` style-variation baseline and regressed focal handoff stability by `-0.010478`. This suggests that alternating line-to-star phrase/lyric responses can compete with the established focal handoff even when brightness is restrained. Future call/response attempts should either stay within one focal family/submodel or be validated with human review before promotion.
- Single-target motif variation avoided the call/response focal-handoff problem. `loop-000133` and `loop-000134` both scored `0.805990`, essentially equal to the style-variation baseline with zero regressed dimensions, and promoted all three single-target motif priors. This supports a practical rule for generated audio overlays: preserve the main focal handoff, and place motif/reprise/release echoes on one compatible support target when exploring style range.
- Single-target section-energy swell also held the guarded foundation. `loop-000135` and `loop-000136` both scored `0.805969`, only `-0.000021` from the single-target motif baseline with zero regressed dimensions, and promoted all three swell priors. This adds another usable synthetic timing style: gradual support-target intensity changes can create energy contour without harming focal handoff when kept on the same support target.
- Sparse single-target accents slightly improved the current synthetic-overlay baseline without adding regressions. `loop-000137` and `loop-000138` both scored `0.806002`, `+0.000033` versus the swell baseline, and promoted all three sparse-accent priors. This suggests lower accent density can be a valid style option when the guarded foundation is already carrying display context and focal hierarchy.
- Sparse secondary-palette emphasis failed over the same timing pattern. `loop-000139` dropped to `0.789963`, `-0.016039` versus the sparse-accent baseline, with large regressions in palette-purpose coverage and color discipline. The secondary accent role should not be introduced casually into this sparse support-target overlay; color-purpose changes need stronger semantic justification or human review before promotion.
- Delaying the sparse single-target accents slightly improved the sparse baseline without regressions. `loop-000140` and `loop-000141` both scored `0.806015`, `+0.000013` versus `loop-000138`, and promoted all three sparse-delayed priors. This suggests timing placement can safely expand style range when target selection, sparse density, and color-purpose roles stay stable.
- Early sparse single-target accents are stable but slightly weaker than delayed sparse timing. `loop-000142` and `loop-000143` both scored `0.805887`, `-0.000128` versus the sparse-delayed baseline, with zero regressed dimensions, and promoted all three sparse-early priors. Treat early sparse timing as a valid lower-intensity/front-weighted style option rather than the preferred sparse timing contour.
- Unattended training should now be launched through a training job spec for large chunks. `synthetic-full-sequence-quality-v1` defines the current vendor-fixture full-sequence chunk, default loop guardrails, cleanup behavior, unique run output folders, bounded job-run retention, and major-chunk stop semantics. When the controller reaches idle or strategy exhaustion inside that job, the run summary records `majorChunkStatus: "complete"` instead of turning routine curriculum exhaustion into another per-loop user approval step. The first job run completed at `major_chunk_complete_strategy_exhausted` after repeating sparse-early timing: iteration 1 scored `0.805887` against the delayed sparse baseline with no regressed dimensions, iteration 2 repeated at `0.805887` and promoted the three sparse-early priors, then the controller correctly stopped on exhausted display-redesign strategy coverage. This confirms sparse-early is stable style-range evidence but does not beat sparse-delayed.
- The first style-range expansion job added two more guarded timing families without changing target discipline or color-purpose roles. `synthetic-style-range-expansion-v1` first staged `sparse_release_hold` at `0.806015` and `sparse_syncopated` at `0.806057`; a repeat job promoted all three priors for each family with no promotion blockers. `sparse_release_hold` matched the delayed sparse baseline and is useful for restrained lyric-release holds. `sparse_syncopated` scored slightly higher than the immediate baseline at `0.806057`, but the gain is small enough to treat it as another valid style option rather than a dominant recipe. This reinforces the training direction: learn ranges of guarded timing behavior over a stable whole-display foundation, not one universal best setting.
- Campaign orchestration is now the large-chunk control layer. `vendor-fixture-human-level-sequencing-v1` chains job specs, carries latest run roots and comparison baselines between slices, applies a disk guardrail, writes campaign summaries, and sends macOS notifications on completion or intervention stops. This is the right unit for unattended multi-hour training; individual job loops are implementation detail unless a guardrail trips.
- Pass-scoped video-aesthetic goals need to count durable pass evidence even when the per-pass quality records carry section-review dimensions and the full-sequence aesthetic dimensions live in `video-aesthetic-score.json`. The controller now treats exact pass/palette coverage for `display.video_aesthetic.*` goals as valid durable coverage while still using the full-sequence score/comparison as the promotion guard. This prevented repeated focal-handoff loops from wasting renders after the guarded-context passes were already covered.
- Sparse focal-handoff without enough context is not a useful repair. The compact sparse focal-handoff sequence scored `0.771429` and regressed intent match, local evidence readability, full-sequence context, and color discipline even though the handoff itself read clearly. The guarded-context focal-handoff repair preserved the stable left/right/focal structure and held `0.804628` with selector-ready priors, but did not beat the `0.806057` style-range baseline. Treat guarded focal handoff as stable coverage evidence, not a new best branch.
- The first synthetic timing-structure campaign covered the remaining baseline-preserving call/response and base overlay gaps. Call/response repeated neutrally at `0.804616`, improving focal clarity but slightly weakening focal-handoff stability. The base overlay covered at `0.803640` with a palette-purpose regression of `-0.033333`. These are usable constrained timing priors, but the stronger single-target and sparse timing families remain better default style options.
- The broader timing-style-range chunk confirmed several earlier timing families as already covered and promoted additional neutral evidence: existing-motion overlay repair scored `0.805093` with a small positive delta, while motion repair scored `0.803141` with a small neutral loss. Both promoted three selector-ready priors and preserved cleanup behavior. These are acceptable range evidence, but neither should replace the best sparse/syncopated timing branches as the default.
- Two synthetic timing branches should be avoided in unattended continuation until a repair curriculum or human review is added. Sparse secondary-palette overlay scored `0.789963`, mainly from color-discipline `-0.166666` and palette-purpose `-0.133334`; broad full-sequence audio alignment scored `0.787559`, improving focal clarity but regressing quality consistency `-0.241546`, color discipline `-0.125`, temporal continuity, and full-sequence context. The lesson is consistent: changing color purpose or rebuilding broad audio structure over the guarded foundation can look locally clearer while damaging whole-display quality.
- The repair curriculum confirmed safer replacements for both failed timing branches. `baseline_preserving_audio_overlay_sparse_palette_discipline_repair` scored `0.806002`, improved palette-purpose coverage to `1.0`, improved focal-handoff stability by `+0.021836`, had no regressed dimensions, and promoted all three priors after repeat. This confirms the failure was the reserved secondary-palette role, not the sparse timing shape. `full_sequence_audio_guarded_repair` avoided the broad-audio collapse and repeated neutrally at `0.804886`, promoting all three priors, but it still sits below the sparse-palette-discipline repair and lightly regressed focal-handoff stability on first coverage. Treat it as safe repair evidence, not the preferred default timing branch.
- Unattended cleanup is now part of the training evidence loop. The style-range job deleted 32 raw PPM preview frames per executed loop, removed 64 frame dumps across the repeat run, and left zero retained `preview-media-frames/frame-*.ppm` files under the style-range job root. Job-run retention also wrote `job-retention-summary.json` and kept the two completed style-range runs because the configured cap was not reached. Future long runs should preserve compact JSON evidence and discard raw frame dumps unless a failure specifically needs them for debugging.

## Current Gaps

- runtime generated bundles remain large enough to consider lazy loading or further sharding later
- layer-composition knowledge needs broader production-display evidence
- custom model geometry and submodel behavior now have package and runtime coverage; the next gap is broader real-display calibration across more accepted apply/render outcomes using the self-improvement loop
- mature sequence examples now have a first approved human-review calibration set and a generated-candidate evaluation contract; the next gap is producing full-sequence generated candidates with `video_aesthetic_score_v1`, ranking them against the human target bands, and retuning weak automated dimensions
- creative revision variants now consume stronger video-level dimensions; the next gap is running live evidence to learn which variant reliably improves which weakness
- synthetic timing overlay training now has stable guarded/sparse style ranges; the next gap is a repair curriculum for broad audio-alignment structure and secondary-palette timing so those branches can be tested without sacrificing color discipline, quality consistency, or full-sequence context

## Related Artifacts

- `../../scripts/sequencer-render-training/catalog/README.md`
- `../../scripts/sequencer-render-training/catalog/knowledge-inventory.v1.json`
- `../../scripts/sequencer-render-training/proofs/preview-scene-geometry-proof-summaries.json`
