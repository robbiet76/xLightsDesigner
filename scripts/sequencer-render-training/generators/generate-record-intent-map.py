#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict
from pathlib import Path


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

SYSTEM_LABEL_PREFIXES = {
    "decoded_fseq",
    "interaction_sweep",
}


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def band(value):
    if not isinstance(value, (int, float)):
        return None
    if value >= 0.8:
        return "high"
    if value >= 0.6:
        return "medium"
    return "low"


def descriptor_from_record(record: dict) -> dict:
    labels = record.get("observations", {}).get("labels", []) or []
    labels = [label for label in labels if label not in SYSTEM_LABEL_PREFIXES]
    pattern_families = sorted(label.split(":", 1)[1] for label in labels if label.startswith("pattern_family:"))
    intent_tags = sorted(label.split(":", 1)[1] for label in labels if label.startswith("intent:"))
    structural_labels = sorted(
        label
        for label in labels
        if not label.startswith("intent:") and not label.startswith("pattern_family:")
    )
    scores = (record.get("observations") or {}).get("scores") or {}
    return {
        "effect": record.get("effectName"),
        "geometryProfile": (record.get("fixture") or {}).get("geometryProfile"),
        "parameterName": record.get("sampleId"),
        "valueRange": {
            "start": record.get("sampleId"),
            "end": record.get("sampleId"),
        },
        "patternFamilies": pattern_families,
        "intentTags": intent_tags,
        "structuralLabels": structural_labels,
        "qualityBand": band(scores.get("usefulness")),
        "clarityBand": band(scores.get("patternClarity")),
        "restraintBand": band(scores.get("restraint")),
        "usefulnessRange": {
            "min": scores.get("usefulness"),
            "max": scores.get("usefulness"),
        },
        "sampleCount": 1,
        "sampleIds": [record.get("sampleId")],
    }


def build_intent_map(run_summaries: list[Path], supported_effects: set[str]) -> dict:
    result = {
        "version": "1.0",
        "description": "Effect-scoped intent map derived from per-record interaction runs.",
        "sourceRuns": [str(path) for path in run_summaries],
        "supportedEffects": sorted(supported_effects),
        "effects": {},
    }

    grouped = defaultdict(lambda: defaultdict(lambda: {"resolvedModelTypes": set(), "descriptors": []}))

    for summary_path in run_summaries:
        summary = load_json(summary_path)
        for item in summary.get("results", []):
            record_path = item.get("recordPath")
            if not record_path:
                continue
            record = load_json(Path(record_path))
            effect = record.get("effectName")
            if effect not in supported_effects:
                continue
            fixture = record.get("fixture") or {}
            geometry = fixture.get("geometryProfile")
            model_type = fixture.get("modelType")
            grouped[effect][geometry]["descriptors"].append(descriptor_from_record(record))
            if model_type:
                grouped[effect][geometry]["resolvedModelTypes"].add(model_type)

    for effect, geometries in sorted(grouped.items()):
        effect_result = {"geometries": {}}
        for geometry, payload in sorted(geometries.items()):
            intents = defaultdict(list)
            descriptors = payload["descriptors"]
            for descriptor in descriptors:
                for intent in descriptor.get("intentTags", []):
                    intents[intent].append(descriptor)
            effect_result["geometries"][geometry] = {
                "resolvedModelTypes": sorted(payload["resolvedModelTypes"]),
                "retainedParameters": [],
                "intentBuckets": {
                    intent: rows
                    for intent, rows in sorted(intents.items())
                    if intent in PRIMARY_INTENTS and rows
                },
                "allObservedIntents": sorted({tag for d in descriptors for tag in d.get("intentTags", [])}),
                "allObservedPatternFamilies": sorted({pf for d in descriptors for pf in d.get("patternFamilies", [])}),
            }
        result["effects"][effect] = effect_result

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-summary", action="append", required=True)
    parser.add_argument("--effect", action="append", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    payload = build_intent_map([Path(p) for p in args.run_summary], set(args.effect))
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
