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
- derived parameter priors
- layer-composition priors
- behavior-capability records
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

## Current Learnings

- Generated record packs replaced thousands of loose semantic files.
- Promoted screening records are packed into JSONL shards with an index.
- Proof fixtures were compacted; full geometry dumps are local/generated except for the retained render-training proof input.
- Training records should be consolidated into reusable effect semantics and priors before additional broad training runs.

## Current Gaps

- runtime generated bundles may still be larger than ideal
- layer-composition knowledge needs broader production-display evidence
- custom model geometry and submodel behavior must feed training cases
- mature sequence examples need stronger extraction and calibration

## Related Artifacts

- `../../scripts/sequencer-render-training/catalog/README.md`
- `../../scripts/sequencer-render-training/catalog/knowledge-inventory.v1.json`
- `../../scripts/sequencer-render-training/proofs/preview-scene-geometry-proof-summaries.json`
