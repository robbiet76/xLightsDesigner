#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--intent-map", action="append", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    merged = {
        "version": "1.0",
        "description": "Merged intent map across multiple effect-specific sources.",
        "sourceRuns": [],
        "supportedEffects": [],
        "effects": {},
    }

    for path_str in args.intent_map:
        payload = load_json(Path(path_str))
        merged["sourceRuns"].extend(payload.get("sourceRuns", []))
        merged["supportedEffects"].extend(payload.get("supportedEffects", []))
        for effect_name, effect_payload in payload.get("effects", {}).items():
            merged["effects"][effect_name] = effect_payload

    merged["sourceRuns"] = sorted(dict.fromkeys(merged["sourceRuns"]))
    merged["supportedEffects"] = sorted(dict.fromkeys(merged["supportedEffects"]))

    Path(args.out_file).write_text(json.dumps(merged, indent=2) + "\n")


if __name__ == "__main__":
    main()
