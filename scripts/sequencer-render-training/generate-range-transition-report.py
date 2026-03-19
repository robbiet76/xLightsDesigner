#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


def load_record(path: Path) -> dict:
    with path.open() as f:
        return json.load(f)


def normalize_param_label(param: str) -> str:
    out = []
    for idx, ch in enumerate(param):
        if ch.isupper() and idx > 0:
            out.append("_")
        out.append(ch.lower())
    return "".join(out)


def meaningful_labels(record: dict, param: str):
    param_label = normalize_param_label(param)
    labels = []
    for label in record["observations"]["labels"]:
        if label.startswith(("effect:", "model:", "render_style:")) or label == "decoded_fseq":
            continue
        if label in {"range_sample", param_label}:
            continue
        if re.search(r"_[0-9]+$", label):
            continue
        labels.append(label)
    return sorted(labels)


def signature(record: dict, param: str) -> dict:
    obs = record["observations"]
    return {
        "lookFamily": next((x for x in obs["labels"] if x.endswith("_pattern") or x.endswith("_texture") or x.endswith("_fill") or x in {"static_hold", "shimmer_hold", "ramp_down", "ramp_up", "flat_level"}), "unclassified"),
        "qualityBand": (
            "high" if obs["scores"]["usefulness"] >= 0.8 else
            "medium" if obs["scores"]["usefulness"] >= 0.65 else
            "low"
        ),
        "restraintBand": (
            "high" if obs["scores"]["restraint"] >= 0.75 else
            "medium" if obs["scores"]["restraint"] >= 0.55 else
            "low"
        ),
        "clarityBand": (
            "high" if obs["scores"]["patternClarity"] >= 0.8 else
            "medium" if obs["scores"]["patternClarity"] >= 0.65 else
            "low"
        ),
        "labels": meaningful_labels(record, param)
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--param", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    summary = json.loads((Path(args.run_dir) / "run-summary.json").read_text())
    rows = []
    for result in summary["results"]:
        record = load_record(Path(result["recordPath"]))
        value = record.get("effectSettings", {}).get(args.param)
        rows.append({
            "sampleId": record["sampleId"],
            "param": args.param,
            "value": value,
            "scores": record["observations"]["scores"],
            "signature": signature(record, args.param)
        })

    rows = sorted(rows, key=lambda x: (float(x["value"]) if isinstance(x["value"], (int, float)) else str(x["value"])))
    transitions = []
    for left, right in zip(rows, rows[1:]):
        changed = left["signature"] != right["signature"]
        transitions.append({
            "fromSampleId": left["sampleId"],
            "toSampleId": right["sampleId"],
            "fromValue": left["value"],
            "toValue": right["value"],
            "changed": changed,
            "fromSignature": left["signature"],
            "toSignature": right["signature"]
        })

    payload = {
        "runDir": args.run_dir,
        "param": args.param,
        "samples": rows,
        "transitions": transitions
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
