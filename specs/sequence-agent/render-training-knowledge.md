# Render Training Knowledge

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
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

## Current Gaps

- runtime generated bundles remain large enough to consider lazy loading or further sharding later
- layer-composition knowledge needs broader production-display evidence
- custom model geometry and submodel behavior now have package and runtime coverage; the next gap is broader real-display calibration across more accepted apply/render outcomes using the self-improvement loop
- mature sequence examples need stronger extraction and calibration

## Related Artifacts

- `../../scripts/sequencer-render-training/catalog/README.md`
- `../../scripts/sequencer-render-training/catalog/knowledge-inventory.v1.json`
- `../../scripts/sequencer-render-training/proofs/preview-scene-geometry-proof-summaries.json`
