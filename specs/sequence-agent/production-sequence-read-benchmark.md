# Production Sequence Read Benchmark

Status: Active
Owner: xLightsDesigner Team

## Purpose

Use mature production sequences as read-only calibration references for
whole-display sequence understanding. This benchmark answers whether the system
can read a complete human-authored sequence and identify why it works across the
whole display over time.

This is not generation training and not style copying. Production sequences are
reference material for calibrating the analyzer, scorer, and critique layer.

## Policy

- Source `.xsq` and `.fseq` files are read-only.
- The benchmark must not mutate, rewrite, normalize, or save source sequences.
- The benchmark must not promote stylistic patterns directly into generation
  policy without human review.
- The primary evidence scope is `full_sequence_render`.
- Section-level observations are supporting evidence for the full sequence arc.
- Effect-level observations are capability explanations only.

## Manifest

Build the manifest with:

```bash
python3 scripts/sequencer-render-training/tooling/build-mature-sequence-benchmark-manifest.py \
  --show-root /path/to/production/show/root \
  --out var/benchmarks/production-sequence-read/manifest.json
```

Validate it with:

```bash
node scripts/sequencer-render-training/tooling/validate-production-sequence-benchmark-manifest.mjs \
  --manifest var/benchmarks/production-sequence-read/manifest.json
```

The manifest artifact is `production_sequence_read_benchmark_manifest_v1`.

## Read Goals

Each sequence should be evaluated for:

- whole-display energy arc
- section contrast
- target usage and handoff patterns
- effect vocabulary and variation
- color story
- density and brightness ranges
- submodel usage when present
- repeated motif development
- finale or resolution payoff

The analyzer should produce compact summaries that explain the sequence at
multiple levels, but promotion confidence should be based on the whole-display
and multi-section behavior.

## Human Calibration

Human review is required before using benchmark output as training calibration.
The user should be able to mark:

- known strengths
- known weaknesses
- song sections that are especially strong
- sections that are intentionally sparse, dense, bright, or restrained
- style labels that should not be generalized to every sequence

These notes become calibration targets for the scorer. A high automated score
that conflicts with human review is a scoring defect, not proof that the human
sequence is wrong.

## Workflow

1. Create a read-only manifest from the production show folder.
2. Validate manifest policy and source paths.
3. Build a structural read audit from the `.xsq` files.
4. For an initial subset, inspect available rendered `.fseq` output.
5. Build full-sequence and section-window observations.
6. Compare automated reading against human notes.
7. Adjust intent/style/range scoring before running more generated training.

Structural audit:

```bash
python3 scripts/sequencer-render-training/tooling/build-production-sequence-read-audit.py \
  --manifest var/benchmarks/production-sequence-read/manifest.json \
  --out var/benchmarks/production-sequence-read/read-audit.json
```

The structural audit is intentionally read-only and render-free. It parses
existing `.xsq` files to summarize display elements, timing marks, effect
vocabulary, target usage, and timeline coverage. This validates that the system
can read the sequence as a complete composition before spending time on video
render analysis.

## Relationship To Training

Generated render training remains the place where the system experiments.
Production sequence benchmarks are calibration references:

- use them to tune scoring and critique
- use them to discover missing read dimensions
- use them to check whether whole-display quality metrics match mature work
- do not use them as fixed recipes for generation

## Related Specs

- `sequencing-quality-curriculum.md`
- `render-review-training.md`
- `render-training-knowledge.md`
