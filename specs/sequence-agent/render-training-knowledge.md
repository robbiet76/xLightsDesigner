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

The app should learn custom model behavior in layers:

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
3. Run effect probes against the actual custom target when useful:
   - start with low-risk effects and conservative settings
   - render short validation windows on both the parent custom model and important submodels
   - observe coverage, motion, color spread, readability, flicker, and blank-node behavior
   - compare outcomes against the requested intent and metadata
4. Promote learned behavior as custom-structure evidence:
   - keyed by stable target fingerprint and compact structural features
   - scoped to parent or submodel target, effect family, parameter region, and observed outcome
   - reusable only for similar structure and metadata context
   - never promoted solely because of the model name

This means custom model support starts from general effect knowledge and runtime validation, then becomes more confident per display as the app observes how effects render on that target. Mature project metadata helps the agent choose what to try. Render evidence teaches the app what actually works for that user's installation.

Submodels are usually the primary sequencing surface for custom models. The parent custom model is still important for identity, fingerprinting, whole-prop fills, and fallback targeting, but most useful sequencing decisions often happen at the submodel level. Custom learning must therefore model:

- submodel purpose and relationship to the parent
- submodel node coverage, density, and visual region
- sibling overlap or adjacency
- whether a submodel reads as a feature, layer, outline, segment, mouth/eye, spoke/ring, or other structure
- effect behavior when applied to a single submodel versus the parent
- effect behavior when multiple sibling submodels are layered or sequenced in succession

Custom model learning should answer practical questions:

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
