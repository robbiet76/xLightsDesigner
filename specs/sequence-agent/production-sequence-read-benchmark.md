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
  --benchmark-metadata var/benchmarks/production-sequence-read/benchmark-metadata.json \
  --exclude-folder Test \
  --out var/benchmarks/production-sequence-read/manifest.json
```

Validate it with:

```bash
node scripts/sequencer-render-training/tooling/validate-production-sequence-benchmark-manifest.mjs \
  --manifest var/benchmarks/production-sequence-read/manifest.json
```

The manifest artifact is `production_sequence_read_benchmark_manifest_v1`.
The `--benchmark-metadata` file is optional. Without it, sequences are included
with neutral annotations: no inferred style tags and no initial audit subset.
Use metadata when a human wants to mark style tags, initial review subsets,
folder exclusions, or known calibration notes. Folder exclusions can also be
passed with repeated `--exclude-folder` arguments. The builder must not infer
style or quality fields from sequence folder names.

Example metadata:

```json
{
  "initialAuditSubset": ["SequenceA"],
  "sequences": {
    "SequenceA": {
      "styleTags": ["dramatic", "high_energy"],
      "humanReview": {
        "status": "pending",
        "notes": "Use for section contrast calibration.",
        "knownStrengths": [],
        "knownWeaknesses": []
      }
    }
  }
}
```

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
4. Export a house-preview MP4 with sequence audio for selected sequences.
5. Run vision/audio review against the MP4 as the primary quality read.
6. Use `.xsq` and `.fseq` observations as supporting diagnostics only.
7. Compare automated reading against human notes.
8. Adjust intent/style/range scoring before running more generated training.

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

Rendered calibration:

```bash
python3 scripts/sequencer-render-training/tooling/run-mature-sequence-calibration.py \
  --manifest var/benchmarks/production-sequence-read/manifest.json \
  --max-sequences 1 \
  --window opening \
  --out-dir var/benchmarks/production-sequence-read/rendered-calibration
```

Rendered calibration reconstructs display preview-scene windows from existing
`.fseq` output, then extracts render, composition, progression, and critique
observations. This is the first visual read layer: it evaluates what the viewer
would see in selected sequence windows while remaining read-only with respect to
the source show folder.

Primary review video:

```bash
node scripts/sequencer-render-training/tooling/export-xlights-preview-video.mjs \
  --sequence /path/to/production/show/root/SequenceA/SequenceA.xsq \
  --out var/benchmarks/production-sequence-read/videos/SequenceA.mp4 \
  --artifact var/benchmarks/production-sequence-read/videos/SequenceA.preview-video.json \
  --automation-timeout-ms 300000
```

The primary review artifact should be an xLights House Preview MP4 with sequence
audio when the sequence has media. This uses xLights' existing preview video
export path rather than a separate renderer. That keeps the review baseline
stable: the model evaluates the same whole-display visual/audio output a human
would review, while structural and frame-metric observations remain explanation
and debugging aids.

Full-sequence video read:

```bash
node scripts/sequencer-render-training/tooling/run-production-sequence-video-read.mjs \
  --manifest var/benchmarks/production-sequence-read/manifest.json \
  --out-dir var/benchmarks/production-sequence-read/video-review \
  --max-sequences 1 \
  --reuse-existing-videos
```

This runner exports the House Preview MP4 through the owned xLightsDesigner API,
extracts compact sampled video features and a contact sheet, then writes one
`render_review_v1` per production sequence with `full_sequence_render` scope.
Raw sampled frames are not retained unless `--keep-frames` is explicitly used;
the durable artifacts are the MP4, preview export metadata, frame feature JSON,
contact sheet, render review JSON, and run summary. Use
`--reuse-existing-videos` for resumed calibration runs so existing MP4s are
re-read while only missing sequence videos are exported.

If xLights is blocked by a modal during open, render, or export, the exporter
must fail by timeout instead of leaving the unattended training loop hung.

Calibration baseline:

```bash
node scripts/sequencer-render-training/tooling/build-production-video-calibration-baseline.mjs \
  --summary var/benchmarks/production-sequence-read/video-review/production-sequence-video-read-summary.json \
  --out var/benchmarks/production-sequence-read/video-review/production-video-calibration-baseline.json
```

The baseline artifact is `production_video_calibration_baseline_v1`. It keeps
only accepted production video reads, records invalid or rejected references as
excluded rows, and summarizes score/metric/feature ranges for whole-display
calibration. It is still calibration-only: it must not train generation policy,
copy production style, or promote scoring changes without human review.

Scorer diagnostics:

```bash
node scripts/sequencer-render-training/tooling/build-production-scorer-calibration-diagnostics.mjs \
  --baseline var/benchmarks/production-sequence-read/video-review/production-video-calibration-baseline.json \
  --out var/benchmarks/production-sequence-read/video-review/production-scorer-calibration-diagnostics.json
```

The diagnostics artifact is
`production_scorer_calibration_diagnostics_v1`. It flags score dimensions that
are saturated, compressed, or low-variance across accepted production reads.
When diagnostics report `scorer_calibration_needed`, generated training loops
must treat current automated scores as diagnostic baselines rather than direct
optimization targets.

Full-sequence dimensions:

```bash
node scripts/sequencer-render-training/tooling/build-production-full-sequence-dimensions.mjs \
  --baseline var/benchmarks/production-sequence-read/video-review/production-video-calibration-baseline.json \
  --out var/benchmarks/production-sequence-read/video-review/production-full-sequence-dimensions.json
```

The dimensions artifact is `production_full_sequence_dimensions_v1`. It derives
range-aware full-sequence calibration signals from sampled video windows:
energy arc, section contrast, pacing variety, palette evolution, motif
development, and a low-confidence focal-handoff proxy. True focal handoff
requires model-aware or region-aware evidence in addition to the video frame
features, so the proxy must not be promoted as a production-quality handoff
score by itself.

Model-region handoff:

```bash
python3 scripts/sequencer-render-training/tooling/build-production-model-region-handoff.py \
  --manifest var/benchmarks/production-sequence-read/manifest.json \
  --geometry var/benchmarks/production-sequence-read/rendered-calibration/offline-preview-scene-geometry-show.json \
  --baseline var/benchmarks/production-sequence-read/video-review/production-video-calibration-baseline.json \
  --out var/benchmarks/production-sequence-read/video-review/production-model-region-handoff.json
```

The handoff artifact is `production_model_region_handoff_v1`. It maps direct
`.xsq` model targets onto normalized layout regions from preview-scene geometry
and scores lead-target movement across ordered sequence windows. Group targets
or unresolved targets are recorded explicitly and are not inferred from names.
This gives focal handoff and target hierarchy a model-aware evidence layer
without mutating production sequences.
When a production video baseline is supplied, only accepted video references are
scored and invalid source sequences are listed as excluded references.

Calibration profile:

```bash
node scripts/sequencer-render-training/tooling/build-production-scorer-calibration-profile.mjs \
  --video-dimensions var/benchmarks/production-sequence-read/video-review/production-full-sequence-dimensions.json \
  --model-region-handoff var/benchmarks/production-sequence-read/video-review/production-model-region-handoff.json \
  --scorer-diagnostics var/benchmarks/production-sequence-read/video-review/production-scorer-calibration-diagnostics.json \
  --out var/benchmarks/production-sequence-read/video-review/production-scorer-calibration-profile.json
```

The profile artifact is `production_scorer_calibration_profile_v1`. It merges
the video-derived full-sequence dimensions with the model-region handoff layer
into one per-sequence calibration surface. It also records target bands from
the production reference distribution and marks low-variance dimensions as
supporting diagnostics. Generated training may use these ranges only after
human review confirms the production reads and calibration bands.

Human review gate:

```bash
node scripts/sequencer-render-training/tooling/build-production-human-review-calibration.mjs \
  --profile var/benchmarks/production-sequence-read/video-review/production-scorer-calibration-profile.json \
  --notes var/benchmarks/production-sequence-read/human-review-notes.template.json \
  --write-template var/benchmarks/production-sequence-read/human-review-notes.template.json \
  --out var/benchmarks/production-sequence-read/video-review/production-human-review-calibration.json
```

The review artifact is `production_human_review_calibration_v1`. It keeps the
calibration profile blocked until reviewed production references are marked
`reviewed` with recommendation `approve` or `adjust`. The generated notes
template is user-editable and stores structured multiple-choice metric picks,
optional strengths/weaknesses, dimension notes, and optional band adjustments
without modifying source sequences. The structured choices are the primary
calibration signal; free-text notes are supporting context for unusual cases.

Human/scorer alignment:

```bash
node scripts/sequencer-render-training/tooling/build-production-human-scorer-alignment.mjs \
  --human-calibration var/benchmarks/production-sequence-read/video-review/production-human-review-calibration.json \
  --out var/benchmarks/production-sequence-read/video-review/production-human-scorer-alignment.json
```

The alignment artifact is `production_human_scorer_alignment_v1`. It compares
the user's structured review scores against the automated full-sequence profile
dimensions and labels each metric as aligned, partially aligned, weak, inverted,
or needing more variance. Generated training may use human review scores as
full-sequence target labels once the human calibration artifact is approved.
Automated dimensions marked weak or inverted must remain diagnostics until they
are retuned against more reviewed evidence.

Current vendor-show calibration result:

- `energyArc`, `sectionContrast`, and `paletteEvolution` are partially aligned
  and may be used only with human-calibrated guardrails.
- `focalHandoff`, `targetHierarchy`, and `overallFit` are weakly aligned; do
  not optimize generated sequences directly against the current automated
  scores for those dimensions.
- Production references remain read-only. Training should generate new
  candidate sequences and compare those candidates to the human-calibrated
  target ranges, not copy production sequencing choices.

Generated candidate evaluation:

```bash
node scripts/sequencer-render-training/tooling/build-human-calibrated-candidate-evaluation.mjs \
  --human-calibration var/benchmarks/production-sequence-read/video-review/production-human-review-calibration.json \
  --alignment var/benchmarks/production-sequence-read/video-review/production-human-scorer-alignment.json \
  --candidate-score <generated-run-root>/video-aesthetic-score.json \
  --out <generated-run-root>/human-calibrated-candidate-evaluation.json
```

The evaluation artifact is `human_calibrated_candidate_evaluation_v1`. It
turns approved human production reviews into target bands and compares generated
full-sequence candidates against those bands. It does not copy or train on
production sequences. It uses the human/scorer alignment result as policy:

- aligned automated metrics may support optimization
- partially aligned metrics may be used only as human-calibrated guardrails
- weak, inverted, or unknown metrics remain diagnostic only

With the current vendor-show calibration, no metric is aligned enough for
unattended promotion by itself. The artifact is therefore primarily used to
select generated candidates for human review, identify weak scorer dimensions,
and prevent training from optimizing against metrics that disagree with human
review.

The unattended quality loop can write this artifact directly when running live
candidate renders:

```bash
node scripts/sequencer-render-training/tooling/run-sequencing-quality-loop.mjs \
  --latest-run-root <previous-quality-loop-root> \
  --apply-render \
  --human-calibration var/benchmarks/production-sequence-read/video-review/production-human-review-calibration.json \
  --human-scorer-alignment var/benchmarks/production-sequence-read/video-review/production-human-scorer-alignment.json
```

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
