#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


BASE_FAMILY_ALLOWED_PROFILES = {
    "Bars": {
        "single_line_horizontal",
        "single_line_vertical",
        "arch_single",
        "arch_multi_layer",
        "arch_grouped",
        "tree_flat_single_layer",
        "tree_360_round",
        "tree_360_spiral",
    },
    "Marquee": {
        "single_line_horizontal",
        "single_line_vertical",
        "arch_single",
        "arch_multi_layer",
        "arch_grouped",
        "tree_flat_single_layer",
        "tree_360_round",
        "tree_360_spiral",
    },
    "Pinwheel": {
        "star_single_layer",
        "star_multi_layer",
        "tree_flat_single_layer",
        "tree_360_round",
        "tree_360_spiral",
        "spinner_standard",
    },
    "Spirals": {
        "tree_flat_single_layer",
        "tree_360_round",
        "tree_360_spiral",
    },
}


def build_report(summary: dict, catalog: dict) -> dict:
    canonical_models = catalog.get("canonicalModels", {})
    profile_index = {}
    for key, item in canonical_models.items():
        profile = item.get("geometryProfile")
        if profile:
            profile_index[profile] = {
                "catalogKey": key,
                "modelName": item.get("modelName"),
                "modelType": item.get("modelType"),
                "analyzerFamily": item.get("analyzerFamily"),
                "notes": item.get("notes", ""),
            }

    effects_out = {}
    for effect_name, allowed_profiles in sorted(BASE_FAMILY_ALLOWED_PROFILES.items()):
        effect_summary = summary.get("effects", {}).get(effect_name, {})
        covered = set(effect_summary.get("geometries", {}).keys())
        missing = sorted(profile for profile in allowed_profiles if profile not in covered)
        covered_list = sorted(profile for profile in allowed_profiles if profile in covered)

        effects_out[effect_name] = {
            "allowedGeometryProfiles": sorted(allowed_profiles),
            "coveredGeometryProfiles": covered_list,
            "missingGeometryProfiles": [
                {
                    "geometryProfile": profile,
                    **profile_index.get(profile, {}),
                }
                for profile in missing
            ],
            "coverageRatio": round(len(covered_list) / len(allowed_profiles), 3) if allowed_profiles else 1.0,
        }

    return {
        "version": "1.0",
        "description": "Standard-model coverage gaps for structurally mature priority effects.",
        "summarySource": summary.get("sourceRuns", []),
        "catalogPath": catalog.get("showDir"),
        "effects": effects_out,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", required=True)
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    summary = load_json(Path(args.summary))
    catalog = load_json(Path(args.catalog))
    payload = build_report(summary, catalog)
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
