#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path

SINGLESTRAND_MODE_PRESETS = {
    "Chase": {
        "mode": "Chase",
        "colors": "Palette",
        "numberChases": 1,
        "chaseSize": 18,
        "cycles": 1.5,
        "offset": 0,
        "chaseType": "Left-Right",
        "fadeType": "None",
        "groupAllStrands": False,
    },
    "Skips": {
        "mode": "Skips",
        "bandSize": 2,
        "skipSize": 1,
        "startPos": 1,
        "advances": 24,
        "direction": "Left",
    },
    "FX": {
        "mode": "FX",
        "fxName": "Fireworks 1D",
        "fxPalette": "* Colors Only",
        "intensity": 40,
        "speed": 90,
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--summary-out")
    return parser.parse_args()


def effect_policy(registry: dict, effect: str) -> dict:
    effect_registry = registry["effects"].get(effect, {})
    return {
        "complexityClass": effect_registry.get("complexityClass", "moderate"),
        "earlySamplingPolicy": effect_registry.get("earlySamplingPolicy", "standard_screening"),
        "benchmarkGeometryFamilies": effect_registry.get("benchmarkGeometryFamilies", []),
        "benchmarkRole": effect_registry.get("benchmarkRole"),
    }


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


def normalize_effect_settings_for_applies_when(effect: str, base_settings: dict, applies_when: dict | None) -> dict:
    settings = deepcopy(base_settings)
    if not applies_when:
        return settings
    if effect == "SingleStrand":
        mode_values = applies_when.get("mode") or []
        if mode_values:
            preset = SINGLESTRAND_MODE_PRESETS.get(mode_values[0])
            if preset:
                settings = deepcopy(preset)
    for key, allowed in applies_when.items():
        if not allowed:
            continue
        settings[key] = allowed[0]
    return settings


def generate_manifest(registry: dict, base_manifest: dict, parameter: str, out_file: Path) -> dict:
    effect = load_single_effect(base_manifest)
    param_registry, target = lookup_parameter_registry(registry, effect, parameter)
    anchors = param_registry.get("anchors", [])
    templates = [deepcopy(sample) for sample in base_manifest.get("samples", [])]
    if not templates:
        raise ValueError("base manifest contains no samples")

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

    for template_index, template in enumerate(templates, start=1):
        base_settings = normalize_effect_settings_for_applies_when(
            effect,
            template.get("effectSettings", {}),
            param_registry.get("appliesWhen"),
        )
        base_shared = deepcopy(template.get("sharedSettings", {}))
        if not applies_when_ok(base_settings, param_registry.get("appliesWhen")):
            raise ValueError(
                f"base manifest sample does not satisfy appliesWhen for {effect}.{parameter}"
            )
        palette_profile = base_shared.get("paletteProfile")
        palette_suffix = build_value_token(palette_profile) if palette_profile else None
        source_sample_id = build_value_token(template.get("sampleId", f"source-{template_index:02d}"))
        for value in anchors:
            sample = deepcopy(template)
            sample["effectSettings"] = deepcopy(base_settings)
            sample["sharedSettings"] = deepcopy(base_shared)
            if target == "sharedSettings":
                sample["sharedSettings"][parameter] = value
            else:
                sample["effectSettings"][parameter] = value
            token = build_value_token(value)
            sample_id_parts = [effect.lower(), parameter.lower(), token]
            if palette_suffix:
                sample_id_parts.append(palette_suffix)
            sample_id_parts.append(source_sample_id)
            sample_id_parts.append("registry-v1")
            sample["sampleId"] = "-".join(sample_id_parts)
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
    plan_effects = {}
    for item in plan.get("plans", []):
        base_manifest_path = Path(item["baseManifest"])
        base_manifest = json.loads(base_manifest_path.read_text())
        plan_id = item["planId"]
        geometry_profile = item.get("geometryProfile")
        effect = item["effect"]
        policy = effect_policy(registry, effect)
        effect_bucket = plan_effects.setdefault(
            effect,
            {
                "effect": effect,
                "complexityClass": policy["complexityClass"],
                "earlySamplingPolicy": policy["earlySamplingPolicy"],
                "benchmarkGeometryFamilies": policy["benchmarkGeometryFamilies"],
                "benchmarkRole": policy["benchmarkRole"],
                "geometryProfiles": set(),
                "parameters": set(),
            },
        )
        if geometry_profile:
            effect_bucket["geometryProfiles"].add(geometry_profile)
        for parameter in item.get("parameters", []):
            out_file = out_dir / f"{plan_id}.{parameter}.json"
            result = generate_manifest(registry, base_manifest, parameter, out_file)
            result["planId"] = plan_id
            result["geometryProfile"] = geometry_profile
            result["complexityClass"] = policy["complexityClass"]
            result["earlySamplingPolicy"] = policy["earlySamplingPolicy"]
            results.append(result)
            effect_bucket["parameters"].add(parameter)

    effect_summaries = []
    warnings = []
    for effect_name, payload in sorted(plan_effects.items()):
        geometry_profiles = sorted(payload["geometryProfiles"])
        parameters = sorted(payload["parameters"])
        effect_summary = {
            "effect": effect_name,
            "complexityClass": payload["complexityClass"],
            "earlySamplingPolicy": payload["earlySamplingPolicy"],
            "benchmarkGeometryFamilies": payload["benchmarkGeometryFamilies"],
            "benchmarkRole": payload["benchmarkRole"],
            "geometryProfiles": geometry_profiles,
            "geometryCount": len(geometry_profiles),
            "parameterCount": len(parameters),
            "parameters": parameters,
        }
        if payload["complexityClass"] == "complex" and len(geometry_profiles) < 2:
            warnings.append(
                {
                    "effect": effect_name,
                    "severity": "warning",
                    "kind": "complex_effect_undercovered",
                    "message": f"Complex effect {effect_name} has only {len(geometry_profiles)} geometry profile in this plan.",
                }
            )
        effect_summaries.append(effect_summary)

    if args.summary_out:
        Path(args.summary_out).write_text(
            json.dumps(
                {
                    "planVersion": plan.get("version", "1.0"),
                    "description": plan.get("description", ""),
                    "manifestCount": len(results),
                    "effectSummaries": effect_summaries,
                    "warnings": warnings,
                    "results": results,
                },
                indent=2,
            )
            + "\n"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
