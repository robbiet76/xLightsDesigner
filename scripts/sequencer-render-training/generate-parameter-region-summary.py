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
        "target": report.get("target", "effectSettings"),
        "regionCount": len(regions),
        "regions": regions
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
