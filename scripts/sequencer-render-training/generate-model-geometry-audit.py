#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path


IGNORE_ATTRS = {
    "name",
    "WorldPosX",
    "WorldPosY",
    "WorldPosZ",
    "ScaleX",
    "ScaleY",
    "ScaleZ",
    "RotateX",
    "RotateY",
    "RotateZ",
    "StartChannel",
    "Controller",
    "LayoutGroup",
    "Transparency",
    "PixelSize",
    "Antialias",
    "versionNumber",
}


BASELINE_BY_DISPLAY_AS = {
    "Single Line": "SingleLineHorizontal",
    "Arches": "ArchSingle",
    "Candy Canes": "CaneSingle",
    "Horiz Matrix": "MatrixLowDensity",
    "Tree Flat": "TreeFlat",
    "Tree 360": "TreeRound",
    "Star": "StarSingle",
    "Icicles": "Icicles",
    "Spinner": "Spinner",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-dir", required=True)
    parser.add_argument("--out-file", required=True)
    return parser.parse_args()


def normalize_value(value: str) -> str:
    return value.strip()


def canonical_model_type(display_as: str) -> str:
    raw = (display_as or "").strip()
    mapping = {
        "Single Line": "single_line",
        "Poly Line": "single_line",
        "Arches": "arch",
        "Candy Canes": "cane",
        "Horiz Matrix": "matrix",
        "Vert Matrix": "matrix",
        "Tree Flat": "tree_flat",
        "Tree 360": "tree_360",
        "Star": "star",
        "Icicles": "icicles",
        "Spinner": "spinner",
        "Wreath": "wreath",
    }
    return mapping.get(raw, raw.lower().replace(" ", "_"))


def analyzer_family(model_type: str) -> str:
    if model_type in {"single_line", "arch", "cane", "icicles"}:
        return "linear"
    if model_type in {"tree_flat", "tree_360"}:
        return "tree"
    if model_type == "star":
        return "star"
    if model_type in {"spinner", "wreath"}:
        return "radial"
    if model_type == "matrix":
        return "matrix"
    return "base"


def structural_attributes(model: ET.Element) -> dict[str, str]:
    attrs = {}
    for key, value in sorted(model.attrib.items()):
        if key in IGNORE_ATTRS:
            continue
        attrs[key] = normalize_value(value)
    return attrs


def diff_attrs(base: dict[str, str], other: dict[str, str]) -> dict[str, dict[str, str | None]]:
    keys = sorted(set(base) | set(other))
    diff: dict[str, dict[str, str | None]] = {}
    for key in keys:
        base_val = base.get(key)
        other_val = other.get(key)
        if base_val != other_val:
            diff[key] = {
                "baseline": base_val,
                "variant": other_val,
            }
    return diff


def trait_list(display_as: str, attrs: dict[str, str]) -> list[str]:
    traits: list[str] = []
    model_type = canonical_model_type(display_as)
    traits.append(f"type:{model_type}")

    if attrs.get("LayerSizes"):
        traits.append("layered")
    if attrs.get("CandyCaneSticks", "").lower() == "true":
        traits.append("stick_segments")
    if attrs.get("TreeSpiralRotations") not in {None, "", "0", "0.000000"}:
        traits.append("spiral_enabled")
    if attrs.get("StrandDir"):
        traits.append(f"strand_dir:{attrs['StrandDir'].lower()}")
    if attrs.get("DropPattern"):
        traits.append("drop_pattern")
    if attrs.get("Alternate", "").lower() == "true":
        traits.append("alternate")
    if attrs.get("ZigZag", "").lower() == "true":
        traits.append("zigzag")

    parm1 = attrs.get("parm1")
    parm2 = attrs.get("parm2")
    parm3 = attrs.get("parm3")
    if model_type == "single_line":
        if parm2 == "1":
            traits.append("single_node")
        x2 = float(attrs.get("X2", "0") or "0")
        y2 = float(attrs.get("Y2", "0") or "0")
        if abs(x2) > abs(y2):
            traits.append("horizontal_orientation")
        elif abs(y2) > abs(x2):
            traits.append("vertical_orientation")
    if model_type == "arch":
        if parm1 and int(parm1) > 1:
            traits.append("grouped")
    if model_type == "cane":
        if parm1 and int(parm1) > 1:
            traits.append("grouped")
        if parm2 and int(parm2) <= 20:
            traits.append("low_node_density")
    if model_type == "matrix":
        if parm1 and parm2:
            rows = int(parm1)
            cols = int(parm2)
            traits.append(f"matrix:{rows}x{cols}")
            cells = rows * cols
            if cells <= 256:
                traits.append("density_low")
            elif cells <= 1024:
                traits.append("density_medium")
            else:
                traits.append("density_high")
    if model_type in {"tree_flat", "tree_360"}:
        if parm1 and parm2:
            traits.append(f"strings:{parm1}")
            traits.append(f"nodes_per_string:{parm2}")
    if model_type == "star":
        if parm3:
            traits.append(f"points:{parm3}")
    if model_type == "spinner":
        if parm3:
            traits.append(f"arms:{parm3}")
    return sorted(set(traits))


def main() -> int:
    args = parse_args()
    root = ET.parse(Path(args.show_dir) / "xlights_rgbeffects.xml").getroot()
    models = [m for m in root.iter("model")]
    by_display_as: dict[str, list[ET.Element]] = defaultdict(list)
    for model in models:
        by_display_as[model.attrib.get("DisplayAs", "Unknown")].append(model)

    families = []
    for display_as, family_models in sorted(by_display_as.items()):
        baseline_name = BASELINE_BY_DISPLAY_AS.get(display_as)
        ordered = sorted(family_models, key=lambda m: m.attrib.get("name", ""))
        baseline = next((m for m in ordered if m.attrib.get("name") == baseline_name), ordered[0])
        baseline_attrs = structural_attributes(baseline)
        entries = []
        for model in ordered:
            name = model.attrib.get("name", "")
            attrs = structural_attributes(model)
            entry = {
                "modelName": name,
                "displayAs": display_as,
                "resolvedModelType": canonical_model_type(display_as),
                "analyzerFamily": analyzer_family(canonical_model_type(display_as)),
                "geometryTraits": trait_list(display_as, attrs),
                "structuralSettings": attrs,
            }
            if name != baseline.attrib.get("name"):
                entry["diffFromBaseline"] = diff_attrs(baseline_attrs, attrs)
            entries.append(entry)

        families.append({
            "displayAs": display_as,
            "resolvedModelType": canonical_model_type(display_as),
            "analyzerFamily": analyzer_family(canonical_model_type(display_as)),
            "baselineModelName": baseline.attrib.get("name"),
            "baselineStructuralSettings": baseline_attrs,
            "models": entries,
        })

    output = {
        "layoutName": "RenderTraining",
        "showDir": args.show_dir,
        "generatedBy": "generate-model-geometry-audit.py",
        "families": families,
    }
    Path(args.out_file).write_text(json.dumps(output, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
