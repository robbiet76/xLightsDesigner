#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict
from pathlib import Path

SUPPORTED_EFFECTS = {"Bars", "Marquee", "Pinwheel"}

PRIMARY_INTENTS = [
    "directional",
    "segmented",
    "clean",
    "bold",
    "restrained",
    "animated",
    "steady",
    "fill",
    "partial",
    "busy",
]


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def region_descriptor(effect: str, geometry: str, parameter_name: str, region: dict) -> dict:
    return {
        "effect": effect,
        "geometryProfile": geometry,
        "parameterName": parameter_name,
        "valueRange": {
            "start": region.get("startValue"),
            "end": region.get("endValue"),
        },
        "patternFamilies": region.get("patternFamilies", []),
        "intentTags": region.get("intentTags", []),
        "structuralLabels": region.get("structuralLabels", []),
        "qualityBand": region.get("qualityBand"),
        "clarityBand": region.get("clarityBand"),
        "restraintBand": region.get("restraintBand"),
        "usefulnessRange": region.get("usefulnessRange", {}),
        "sampleCount": region.get("sampleCount", 0),
        "sampleIds": region.get("sampleIds", []),
    }


def build_intent_map(summary: dict) -> dict:
    result = {
        "version": "1.0",
        "description": "First-pass intent map derived from structurally mature priority effects.",
        "sourceRuns": summary.get("sourceRuns", []),
        "supportedEffects": sorted(SUPPORTED_EFFECTS),
        "effects": {},
    }

    effects = summary.get("effects", {})
    for effect_name, effect_payload in sorted(effects.items()):
        if effect_name not in SUPPORTED_EFFECTS:
            continue

        effect_result = {"geometries": {}}
        for geometry, geometry_payload in sorted(effect_payload.get("geometries", {}).items()):
            intents = defaultdict(list)
            retained_parameters = []

            for parameter in geometry_payload.get("parameters", []):
                status = parameter.get("observedImpact", {}).get("status")
                parameter_name = parameter.get("parameterName")
                if status not in {"high_impact_observed", "interaction_suspected"}:
                    continue
                retained_parameters.append({
                    "parameterName": parameter_name,
                    "status": status,
                    "rationale": parameter.get("observedImpact", {}).get("rationale"),
                })
                for region in parameter.get("regions", []):
                    descriptor = region_descriptor(effect_name, geometry, parameter_name, region)
                    for intent in region.get("intentTags", []):
                        intents[intent].append(descriptor)

            effect_result["geometries"][geometry] = {
                "resolvedModelTypes": geometry_payload.get("resolvedModelTypes", []),
                "retainedParameters": retained_parameters,
                "intentBuckets": {
                    intent: descriptors
                    for intent, descriptors in sorted(intents.items())
                    if intent in PRIMARY_INTENTS and descriptors
                },
                "allObservedIntents": geometry_payload.get("observedIntentTags", []),
                "allObservedPatternFamilies": geometry_payload.get("observedPatternFamilies", []),
            }

        result["effects"][effect_name] = effect_result

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    summary = load_json(Path(args.summary))
    payload = build_intent_map(summary)
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
