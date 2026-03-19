#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--summary-out")
    return parser.parse_args()


def build_value_token(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    token = str(value)
    return token.replace(".", "_").replace(" ", "_").replace("/", "_")


def load_single_effect(base_manifest: dict) -> str:
    names = {sample["effectName"] for sample in base_manifest.get("samples", [])}
    if len(names) != 1:
        raise ValueError("base manifest must contain exactly one effect family")
    return next(iter(names))


def lookup_parameter_registry(registry: dict, effect: str, parameter: str) -> tuple[dict, str]:
    effect_registry = registry["effects"].get(effect)
    if effect_registry is not None:
        param_registry = effect_registry["parameters"].get(parameter)
        if param_registry is not None:
            return param_registry, param_registry.get("target", "effectSettings")

    shared_registry = registry.get("sharedParameters", {}).get(parameter)
    if shared_registry is not None:
        return shared_registry, shared_registry.get("target", "sharedSettings")

    raise ValueError(f"parameter not found for effect {effect}: {parameter}")


def applies_when_ok(sample_settings: dict, applies_when: dict | None) -> bool:
    if not applies_when:
        return True
    for key, allowed in applies_when.items():
        if sample_settings.get(key) not in allowed:
            return False
    return True


def generate_manifest(registry: dict, base_manifest: dict, parameter: str, out_file: Path) -> dict:
    effect = load_single_effect(base_manifest)
    param_registry, target = lookup_parameter_registry(registry, effect, parameter)
    anchors = param_registry.get("anchors", [])
    template = deepcopy(base_manifest["samples"][0])
    base_settings = deepcopy(template.get("effectSettings", {}))
    base_shared = deepcopy(template.get("sharedSettings", {}))
    if not applies_when_ok(base_settings, param_registry.get("appliesWhen")):
        raise ValueError(
            f"base manifest sample does not satisfy appliesWhen for {effect}.{parameter}"
        )

    out = deepcopy(base_manifest)
    out["samples"] = []
    out["packId"] = f"{base_manifest['packId']}-{parameter}-registry-v1"
    out["description"] = (
        f"Registry-generated sweep for {effect} {parameter} from {Path(out_file).name}"
    )
    out["registryMetadata"] = {
        "registryVersion": registry.get("version", "1.0"),
        "effect": effect,
        "parameter": parameter,
        "importance": param_registry.get("importance"),
        "phase": param_registry.get("phase"),
        "anchors": anchors,
        "stopRule": param_registry.get("stopRule"),
        "interactionHypotheses": param_registry.get("interactionHypotheses", []),
        "target": target,
    }

    for value in anchors:
        sample = deepcopy(template)
        sample["effectSettings"] = deepcopy(base_settings)
        sample["sharedSettings"] = deepcopy(base_shared)
        if target == "sharedSettings":
            sample["sharedSettings"][parameter] = value
        else:
            sample["effectSettings"][parameter] = value
        token = build_value_token(value)
        sample["sampleId"] = f"{effect.lower()}-{parameter.lower()}-{token}-registry-v1"
        hints = list(sample.get("labelHints", []))
        hints.extend(["range_sample", parameter, f"{parameter}_{token}", "registry_generated"])
        sample["labelHints"] = sorted(set(hints))
        out["samples"].append(sample)

    out_file.write_text(json.dumps(out, indent=2) + "\n")
    return {
        "effect": effect,
        "parameter": parameter,
        "outFile": str(out_file),
        "sampleCount": len(out["samples"]),
        "packId": out["packId"],
    }


def main() -> int:
    args = parse_args()
    registry = json.loads(Path(args.registry).read_text())
    plan = json.loads(Path(args.plan).read_text())
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for item in plan.get("plans", []):
        base_manifest_path = Path(item["baseManifest"])
        base_manifest = json.loads(base_manifest_path.read_text())
        plan_id = item["planId"]
        geometry_profile = item.get("geometryProfile")
        for parameter in item.get("parameters", []):
            out_file = out_dir / f"{plan_id}.{parameter}.json"
            result = generate_manifest(registry, base_manifest, parameter, out_file)
            result["planId"] = plan_id
            result["geometryProfile"] = geometry_profile
            results.append(result)

    if args.summary_out:
        Path(args.summary_out).write_text(
            json.dumps(
                {
                    "planVersion": plan.get("version", "1.0"),
                    "description": plan.get("description", ""),
                    "manifestCount": len(results),
                    "results": results,
                },
                indent=2,
            )
            + "\n"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
