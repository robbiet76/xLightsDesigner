#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict


def apply_structural_standard(
    manifest: Dict[str, Any], standards: Dict[str, Any]
) -> Dict[str, Any]:
    normalized = deepcopy(manifest)
    structural = standards.get("structuralTrainingStandard", {})
    palette_profile = structural.get("paletteProfile", "rgb_standard")
    palette = structural.get("palette", {})
    brightness_policy = structural.get("brightnessPolicy", {})
    default_brightness = brightness_policy.get("defaultBrightnessPercent", 100)
    brightness_exceptions = {
        item.get("effect")
        for item in brightness_policy.get("exceptions", [])
        if isinstance(item, dict) and item.get("effect")
    }

    normalized.setdefault("trainingStandard", {})
    normalized["trainingStandard"]["structuralPaletteProfile"] = palette_profile
    normalized["trainingStandard"]["defaultBrightnessPercent"] = default_brightness
    normalized["trainingStandard"]["standardsVersion"] = standards.get("version", "1.0")

    for sample in normalized.get("samples", []):
        effect_name = sample.get("effectName", "")
        shared = sample.setdefault("sharedSettings", {})
        shared.setdefault("paletteProfile", palette_profile)
        if shared.get("paletteProfile") == palette_profile:
            shared["palette"] = deepcopy(palette)
        shared.setdefault("trainingBrightnessPercent", default_brightness)
        shared.setdefault("trainingPaletteStandard", palette_profile)

        # Structural tests should assume full brightness unless the effect
        # semantics explicitly depend on level changes.
        if effect_name not in brightness_exceptions:
            shared.setdefault("brightnessPolicy", "full_default")
        else:
            shared.setdefault("brightnessPolicy", "effect_semantic_exception")

    return normalized


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--standards", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text())
    standards = json.loads(Path(args.standards).read_text())
    normalized = apply_structural_standard(manifest, standards)
    Path(args.out_file).write_text(json.dumps(normalized, indent=2) + "\n")


if __name__ == "__main__":
    main()
