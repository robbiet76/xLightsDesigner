#!/usr/bin/env python3
import argparse
import json
from itertools import combinations
from pathlib import Path


CORE_EFFECT_LABELS = {
    "chase_pattern",
    "skip_pattern",
    "fx_texture",
    "sparkle_texture",
    "wash_fill",
    "static_hold",
    "shimmer_hold",
    "ramp_down",
    "ramp_up",
    "flat_level",
}

MOTION_LABELS = {
    "single_direction_chase",
    "bounce_motion",
    "left_motion",
    "right_motion",
    "stable_window",
    "subtle_motion_window",
    "high_motion_window",
    "steady_wash",
    "shimmer_wash",
}

COVERAGE_LABELS = {
    "full_coverage",
    "partial_coverage",
    "blank_sampled_frame",
    "dense_sampled_motion",
    "sparse_sampled_motion",
}

STRUCTURE_LABELS = {
    "long_contiguous_pattern",
    "segmented_pattern",
    "fragmented_pattern",
    "matrix_fill",
    "linear_fill",
    "linear_hold",
    "linear_pattern_fit",
    "cane_pattern_fit",
    "matrix_pattern_fit",
    "linear_sparkle_fit",
    "matrix_sparkle_fit",
}

IGNORED_PREFIXES = ("effect:", "model:", "render_style:")
IGNORED_LABELS = {"decoded_fseq"}


def band(score: float, hi: float = 0.8, mid: float = 0.65) -> str:
    if score >= hi:
        return "high"
    if score >= mid:
        return "medium"
    return "low"


def load_record(path: Path) -> dict:
    with path.open() as f:
        return json.load(f)


def first_match(labels, candidates, fallback):
    for label in labels:
        if label in candidates:
            return label
    return fallback


def collect_style_traits(labels):
    traits = []
    for label in labels:
        if label in CORE_EFFECT_LABELS | MOTION_LABELS | COVERAGE_LABELS | STRUCTURE_LABELS:
            traits.append(label)
            continue
        if label in IGNORED_LABELS or label.startswith(IGNORED_PREFIXES):
            continue
        traits.append(label)
    seen = set()
    ordered = []
    for trait in traits:
        if trait in seen:
            continue
        seen.add(trait)
        ordered.append(trait)
    return ordered


def derive_intent_tags(sample):
    tags = []
    scores = sample["scores"]
    traits = set(sample["styleTraits"])

    if sample["qualityBand"] == "high":
        tags.append("high_value")
    elif sample["qualityBand"] == "low":
        tags.append("low_value")

    if sample["restraintBand"] == "high":
        tags.append("restrained")
    elif sample["restraintBand"] == "low":
        tags.append("bold")

    if sample["clarityBand"] == "high":
        tags.append("clean")
    elif sample["clarityBand"] == "low":
        tags.append("busy")

    if sample["motionFamily"] in {"single_direction_chase", "left_motion", "right_motion"}:
        tags.append("directional")
    if sample["motionFamily"] == "bounce_motion":
        tags.append("bouncy")
    if sample["motionFamily"] in {"steady_wash", "stable_window"}:
        tags.append("steady")
    if sample["motionFamily"] in {"shimmer_wash", "high_motion_window", "subtle_motion_window"}:
        tags.append("animated")

    if sample["lookFamily"] == "fx_texture" or "sparkle_texture" in traits:
        tags.append("texture_heavy")
    if sample["lookFamily"] == "wash_fill":
        tags.append("fill")
    if sample["lookFamily"] in {"chase_pattern", "skip_pattern"}:
        tags.append("patterned")

    if sample["coverageFamily"] == "full_coverage":
        tags.append("full")
    elif sample["coverageFamily"] in {"sparse_sampled_motion", "partial_coverage"}:
        tags.append("sparse")
    elif sample["coverageFamily"] == "dense_sampled_motion":
        tags.append("dense")

    if scores["readability"] >= 0.8:
        tags.append("readable")
    elif scores["readability"] < 0.65:
        tags.append("low_read")

    ordered = []
    seen = set()
    for tag in tags:
        if tag in seen:
            continue
        seen.add(tag)
        ordered.append(tag)
    return ordered


def sample_entry(record_path: Path) -> dict:
    record = load_record(record_path)
    labels = record["observations"]["labels"]
    scores = record["observations"]["scores"]
    effect = record["effectName"]
    model_type = next((x.split(":", 1)[1] for x in labels if x.startswith("model:")), "unknown")
    render_style = next((x.split(":", 1)[1] for x in labels if x.startswith("render_style:")), "unknown")

    look_family = first_match(labels, CORE_EFFECT_LABELS, "unclassified_look")
    motion_family = first_match(labels, MOTION_LABELS, "unclassified_motion")
    coverage_family = first_match(labels, COVERAGE_LABELS, "unclassified_coverage")
    structure_family = first_match(labels, STRUCTURE_LABELS, "unclassified_structure")
    usefulness_band = band(scores["usefulness"])
    restraint_band = band(scores["restraint"], hi=0.75, mid=0.55)
    clarity_band = band(scores["patternClarity"], hi=0.8, mid=0.65)

    diversity_key = "|".join(
        [
            effect.lower(),
            model_type,
            render_style,
            look_family,
            motion_family,
            coverage_family,
            structure_family,
            restraint_band,
            clarity_band,
        ]
    )

    return {
        "sampleId": record["sampleId"],
        "recordPath": str(record_path),
        "effectName": effect,
        "modelName": record.get("modelMetadata", {}).get("modelName"),
        "modelType": model_type,
        "renderStyle": render_style,
        "lookFamily": look_family,
        "motionFamily": motion_family,
        "coverageFamily": coverage_family,
        "structureFamily": structure_family,
        "styleTraits": collect_style_traits(labels),
        "scores": scores,
        "qualityBand": usefulness_band,
        "restraintBand": restraint_band,
        "clarityBand": clarity_band,
        "diversityKey": diversity_key,
        "intentTags": [],
        "window": {
            "startMs": record["artifact"].get("windowStartMs"),
            "endMs": record["artifact"].get("windowEndMs"),
        },
        "artifact": {
            "mode": record["artifact"]["mode"],
            "path": record["artifact"]["path"],
            "batchManifestPath": record["artifact"].get("batchManifestPath"),
        },
    }


def build_clusters(samples):
    clusters = {}
    for sample in samples:
        sample["intentTags"] = derive_intent_tags(sample)
        clusters.setdefault(sample["diversityKey"], []).append(sample)

    out = []
    for key in sorted(clusters):
        members = sorted(clusters[key], key=lambda s: (-s["scores"]["usefulness"], s["sampleId"]))
        rep = members[0]
        out.append(
            {
                "diversityKey": key,
                "effectName": rep["effectName"],
                "modelType": rep["modelType"],
                "renderStyle": rep["renderStyle"],
                "lookFamily": rep["lookFamily"],
                "motionFamily": rep["motionFamily"],
                "coverageFamily": rep["coverageFamily"],
                "structureFamily": rep["structureFamily"],
                "qualityBand": rep["qualityBand"],
                "restraintBand": rep["restraintBand"],
                "clarityBand": rep["clarityBand"],
                "styleTraits": rep["styleTraits"],
                "intentTags": rep["intentTags"],
                "representativeSampleId": rep["sampleId"],
                "representativeUsefulness": rep["scores"]["usefulness"],
                "memberCount": len(members),
                "members": [
                    {
                        "sampleId": s["sampleId"],
                        "usefulness": s["scores"]["usefulness"],
                        "recordPath": s["recordPath"],
                    }
                    for s in members
                ],
            }
        )
    return out


def build_diversity_matrix(samples):
    rows = []
    for left, right in combinations(samples, 2):
        overlap = sorted(set(left["styleTraits"]) & set(right["styleTraits"]))
        rows.append(
            {
                "leftSampleId": left["sampleId"],
                "rightSampleId": right["sampleId"],
                "sameLookFamily": left["lookFamily"] == right["lookFamily"],
                "sameMotionFamily": left["motionFamily"] == right["motionFamily"],
                "sameCoverageFamily": left["coverageFamily"] == right["coverageFamily"],
                "sameStructureFamily": left["structureFamily"] == right["structureFamily"],
                "traitOverlapCount": len(overlap),
                "traitOverlap": overlap,
                "usefulnessDelta": round(abs(left["scores"]["usefulness"] - right["scores"]["usefulness"]), 6),
            }
        )
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir)
    summary_path = run_dir / "run-summary.json"
    if not summary_path.exists():
        raise SystemExit(f"Run summary not found: {summary_path}")

    summary = json.loads(summary_path.read_text())
    record_paths = [Path(x["recordPath"]) for x in summary["results"] if x.get("recordPath")]
    if not record_paths:
        raise SystemExit("No record paths found in run summary")

    samples = [sample_entry(path) for path in record_paths]
    samples = sorted(samples, key=lambda s: s["sampleId"])
    clusters = build_clusters(samples)

    payload = {
        "runDir": str(run_dir),
        "sampleCount": len(samples),
        "distinctLookCount": len(clusters),
        "samples": samples,
        "clusters": clusters,
        "diversityMatrix": build_diversity_matrix(samples),
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
