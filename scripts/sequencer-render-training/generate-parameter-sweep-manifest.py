#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", required=True)
    parser.add_argument("--base-manifest", required=True)
    parser.add_argument("--parameter", required=True)
    parser.add_argument("--out-file", required=True)
    parser.add_argument("--pack-id")
    parser.add_argument("--description")
    return parser.parse_args()


def load_single_effect(base_manifest: dict) -> str:
    names = {sample["effectName"] for sample in base_manifest.get("samples", [])}
    if len(names) != 1:
        raise ValueError("base manifest must contain exactly one effect family")
    return next(iter(names))


def build_value_token(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    token = str(value)
    return token.replace(".", "_").replace(" ", "_").replace("/", "_")


def main() -> int:
    args = parse_args()
    registry = json.loads(Path(args.registry).read_text())
    manifest = json.loads(Path(args.base_manifest).read_text())
    effect = load_single_effect(manifest)

    effect_registry = registry["effects"].get(effect)
    if effect_registry is None:
        raise ValueError(f"effect not found in registry: {effect}")
    param_registry = effect_registry["parameters"].get(args.parameter)
    if param_registry is None:
        raise ValueError(f"parameter not found for effect {effect}: {args.parameter}")

    anchors = param_registry.get("anchors", [])
    if not anchors:
        raise ValueError(f"parameter {args.parameter} has no anchors")

    template = deepcopy(manifest["samples"][0])
    base_settings = deepcopy(template.get("effectSettings", {}))
    out = deepcopy(manifest)
    out["samples"] = []
    out["packId"] = args.pack_id or f"{manifest['packId']}-{args.parameter}-generated"
    out["description"] = args.description or (
        f"Registry-generated sweep for {effect} {args.parameter} from {Path(args.base_manifest).name}"
    )
    out.setdefault("registryMetadata", {})
    out["registryMetadata"] = {
        "registryVersion": registry.get("version", "1.0"),
        "effect": effect,
        "parameter": args.parameter,
        "importance": param_registry.get("importance"),
        "phase": param_registry.get("phase"),
        "anchors": anchors,
    }

    for value in anchors:
        sample = deepcopy(template)
        sample["effectSettings"] = deepcopy(base_settings)
        sample["effectSettings"][args.parameter] = value
        token = build_value_token(value)
        sample["sampleId"] = f"{effect.lower()}-{args.parameter.lower()}-{token}-generated-v1"
        hints = list(sample.get("labelHints", []))
        hints.extend(["range_sample", args.parameter, f"{args.parameter}_{token}"])
        sample["labelHints"] = sorted(set(hints))
        out["samples"].append(sample)

    Path(args.out_file).write_text(json.dumps(out, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
