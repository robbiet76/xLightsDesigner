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
4. Promote compact records only after they are useful for runtime planning.
5. Regenerate derived bundles from promoted records.
6. Update this document when durable learning changes.

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

Project-local target and submodel behavior learning is stored in `display/target-behavior.json`. Each record is keyed by target/submodel fingerprint, effect family/name, and probe scope. Records keep compact evidence references, structure hints, submodel context, observed coverage/readability outcomes, and aggregate sample counts. This is the durable project layer where accepted render/probe outcomes can accumulate before any optional shared-training promotion.

## Current Learnings

- Generated record packs replaced thousands of loose semantic files.
- Promoted screening records are packed into JSONL shards with an index.
- Proof fixtures were compacted; full geometry dumps are local/generated except for the retained render-training proof input.
- Runtime training bundles are compact generated JavaScript behind `trained-effect-knowledge.js`; exporters should not emit pretty-printed payloads.
- Training records should be consolidated into reusable effect semantics and priors before additional broad training runs.

## Current Gaps

- runtime generated bundles remain large enough to consider lazy loading or further sharding later
- layer-composition knowledge needs broader production-display evidence
- custom model geometry and submodel behavior must feed training cases
- mature sequence examples need stronger extraction and calibration

## Related Artifacts

- `../../scripts/sequencer-render-training/catalog/README.md`
- `../../scripts/sequencer-render-training/catalog/knowledge-inventory.v1.json`
- `../../scripts/sequencer-render-training/proofs/preview-scene-geometry-proof-summaries.json`
