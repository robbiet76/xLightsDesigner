#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_report(path: Path):
    with path.open() as f:
        return json.load(f)


def same_signature(a, b):
    return a["signature"] == b["signature"]


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
    start = samples[0]
    current = samples[0]
    for sample in samples[1:]:
        if same_signature(current, sample):
            current = sample
            continue
        regions.append({
            "startValue": start["value"],
            "endValue": current["value"],
            "sampleIds": [row["sampleId"] for row in samples if row["value"] >= start["value"] and row["value"] <= current["value"]],
            "signature": start["signature"],
            "usefulnessRange": {
                "min": min(row["scores"]["usefulness"] for row in samples if row["value"] >= start["value"] and row["value"] <= current["value"]),
                "max": max(row["scores"]["usefulness"] for row in samples if row["value"] >= start["value"] and row["value"] <= current["value"])
            }
        })
        start = sample
        current = sample

    regions.append({
        "startValue": start["value"],
        "endValue": current["value"],
        "sampleIds": [row["sampleId"] for row in samples if row["value"] >= start["value"] and row["value"] <= current["value"]],
        "signature": start["signature"],
        "usefulnessRange": {
            "min": min(row["scores"]["usefulness"] for row in samples if row["value"] >= start["value"] and row["value"] <= current["value"]),
            "max": max(row["scores"]["usefulness"] for row in samples if row["value"] >= start["value"] and row["value"] <= current["value"])
        }
    })

    payload = {
        "runDir": report["runDir"],
        "param": report["param"],
        "regionCount": len(regions),
        "regions": regions
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
