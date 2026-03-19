#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_report(path: Path):
    with path.open() as f:
        return json.load(f)


def same_signature(a, b):
    return a["signature"] == b["signature"]


def slice_rows(samples, start_index, end_index):
    return samples[start_index:end_index + 1]


def derive_observed_impact(report, regions):
    samples = report["samples"]
    transitions = report.get("transitions", [])
    changed_count = sum(1 for item in transitions if item.get("changed"))
    sample_count = len(samples)
    region_count = len(regions)
    target = report.get("target", "effectSettings")

    if sample_count <= 1:
        status = "under_sampled"
        rationale = "Only one sampled value was available, so no impact conclusion is defensible."
    elif changed_count == 0 or region_count <= 1:
        status = "context_flat_observed"
        rationale = (
            "The sampled values collapsed into one semantic region in this tested context."
            " This does not imply the parameter is globally low-impact."
        )
    else:
        max_region_size = max(len(region["sampleIds"]) for region in regions)
        if changed_count >= 2 or region_count >= 3 or max_region_size >= 2:
            status = "high_impact_observed"
            rationale = "The sampled values split into multiple stable semantic regions in this tested context."
        else:
            status = "interaction_suspected"
            rationale = (
                "Some semantic change was observed, but the evidence is narrow."
                " This parameter may depend on geometry, render style, or other settings."
            )

    return {
        "status": status,
        "sampleCount": sample_count,
        "changedTransitionCount": changed_count,
        "regionCount": region_count,
        "target": target,
        "rationale": rationale,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--transition-report", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    report = load_report(Path(args.transition_report))
    samples = report["samples"]
    if not samples:
      raise SystemExit("No samples in transition report")

    regions = []
    start_index = 0
    current_index = 0
    for idx, sample in enumerate(samples[1:], start=1):
        if same_signature(samples[current_index], sample):
            current_index = idx
            continue
        region_rows = slice_rows(samples, start_index, current_index)
        regions.append({
            "startValue": samples[start_index]["value"],
            "endValue": samples[current_index]["value"],
            "sampleIds": [row["sampleId"] for row in region_rows],
            "signature": samples[start_index]["signature"],
            "usefulnessRange": {
                "min": min(row["scores"]["usefulness"] for row in region_rows),
                "max": max(row["scores"]["usefulness"] for row in region_rows)
            }
        })
        start_index = idx
        current_index = idx

    region_rows = slice_rows(samples, start_index, current_index)
    regions.append({
        "startValue": samples[start_index]["value"],
        "endValue": samples[current_index]["value"],
        "sampleIds": [row["sampleId"] for row in region_rows],
        "signature": samples[start_index]["signature"],
        "usefulnessRange": {
            "min": min(row["scores"]["usefulness"] for row in region_rows),
            "max": max(row["scores"]["usefulness"] for row in region_rows)
        }
    })

    payload = {
        "runDir": report["runDir"],
        "param": report["param"],
        "parameterName": report["param"],
        "target": report.get("target", "effectSettings"),
        "observedImpact": derive_observed_impact(report, regions),
        "regionCount": len(regions),
        "regions": regions
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
