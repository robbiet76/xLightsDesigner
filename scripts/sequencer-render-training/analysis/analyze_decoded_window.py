#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from framework import SequenceAnalysisInput, get_analyzer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--decoded-window", required=True)
    parser.add_argument("--model-metadata", required=True)
    parser.add_argument("--model-type", required=True)
    parser.add_argument("--effect-name", required=True)
    parser.add_argument("--effect-settings", required=True)
    parser.add_argument("--shared-settings", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    decoded_window = json.loads(Path(args.decoded_window).read_text())
    model_metadata = json.loads(Path(args.model_metadata).read_text())
    effect_settings = json.loads(args.effect_settings)
    shared_settings = json.loads(args.shared_settings)

    inp = SequenceAnalysisInput(
        model_type=args.model_type,
        decoded_window=decoded_window,
        model_metadata=model_metadata,
        effect_name=args.effect_name,
        effect_settings=effect_settings,
        shared_settings=shared_settings,
    )
    result = get_analyzer(args.model_type).analyze(inp)
    result["analysisVersion"] = "1.0"
    result["modelType"] = args.model_type
    result["effectName"] = args.effect_name
    Path(args.out_file).write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
