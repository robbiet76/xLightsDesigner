#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path

XLIGHTS_DEFAULT_PALETTE = {
    "C_BUTTON_Palette1": "#FFFFFF",
    "C_BUTTON_Palette2": "#FF0000",
    "C_BUTTON_Palette3": "#00FF00",
    "C_BUTTON_Palette4": "#0000FF",
    "C_BUTTON_Palette5": "#FFFF00",
    "C_BUTTON_Palette6": "#000000"
}

PALETTE_PRESETS = {
    "mono_white": {
        "paletteProfile": "mono_white",
        "paletteActivationMode": "xlights_default",
        "palette": XLIGHTS_DEFAULT_PALETTE,
        "activeSlots": [5]
    },
    "rgb_primary": {
        "paletteProfile": "rgb_primary",
        "paletteActivationMode": "xlights_default",
        "palette": XLIGHTS_DEFAULT_PALETTE,
        "activeSlots": [2, 3, 4]
    },
    "circular_multi": {
        "paletteProfile": "circular_multi",
        "paletteActivationMode": "xlights_default",
        "palette": XLIGHTS_DEFAULT_PALETTE,
        "activeSlots": [2, 3, 4]
    }
}


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


def main() -> int:
    args = parse_args()
    registry = json.loads(Path(args.registry).read_text())
    manifest = json.loads(Path(args.base_manifest).read_text())
    effect = load_single_effect(manifest)

    param_registry, target = lookup_parameter_registry(registry, effect, args.parameter)

    anchors = param_registry.get("anchors", [])
    if not anchors:
        raise ValueError(f"parameter {args.parameter} has no anchors")

    template = deepcopy(manifest["samples"][0])
    base_settings = deepcopy(template.get("effectSettings", {}))
    base_shared = deepcopy(template.get("sharedSettings", {}))
    base_export = deepcopy(template.get("export", {"mode": "model_with_render", "format": "gif"}))
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
        "target": target,
        "screeningPaletteMode": param_registry.get("screeningPaletteMode"),
    }

    for value in anchors:
        sample = deepcopy(template)
        sample["effectSettings"] = deepcopy(base_settings)
        sample["sharedSettings"] = deepcopy(base_shared)
        sample["export"] = deepcopy(base_export)
        palette_mode = param_registry.get("screeningPaletteMode")
        if palette_mode:
            preset = PALETTE_PRESETS.get(palette_mode)
            if preset is None:
                raise ValueError(f"unknown screeningPaletteMode for {effect} {args.parameter}: {palette_mode}")
            sample["sharedSettings"]["paletteProfile"] = preset["paletteProfile"]
            sample["sharedSettings"]["palette"] = deepcopy(preset["palette"])
            sample["sharedSettings"]["paletteActivationMode"] = preset.get("paletteActivationMode", "explicit")
            sample["sharedSettings"]["paletteActiveSlots"] = deepcopy(preset.get("activeSlots", []))
        sample["trainingContext"] = {
            "screenedParameterName": args.parameter,
            "screeningTarget": target,
            "screeningPhase": param_registry.get("phase", "screen"),
            "screeningPriority": param_registry.get("practicalPriority", param_registry.get("importance", "medium")),
            "screeningPaletteMode": palette_mode or "",
        }
        if target == "sharedSettings":
            sample["sharedSettings"][args.parameter] = value
        else:
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
