#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def normalize_list(values):
    return [value.strip() for value in values if value and value.strip()]


def score_descriptor(descriptor, required, excluded):
    intents = set(descriptor.get("intentTags", []))
    score = 0
    missing = []
    for item in required:
        if item in intents:
            score += 3
        else:
            missing.append(item)
    for item in excluded:
        if item in intents:
            score -= 4
    if descriptor.get("clarityBand") == "high":
        score += 1
    if descriptor.get("qualityBand") == "high":
        score += 1
    usefulness = descriptor.get("usefulnessRange", {}).get("max")
    if isinstance(usefulness, (int, float)):
        score += usefulness
    return score, missing


def collect_candidates(intent_map, effect_filter, geometry_filter, required, excluded):
    candidates = []
    for effect_name, effect_payload in intent_map.get("effects", {}).items():
        if effect_filter and effect_name not in effect_filter:
            continue
        for geometry, geometry_payload in effect_payload.get("geometries", {}).items():
            if geometry_filter and geometry not in geometry_filter:
                continue
            seen = set()
            for intent_bucket in geometry_payload.get("intentBuckets", {}).values():
                for descriptor in intent_bucket:
                    key = (
                        descriptor.get("effect"),
                        descriptor.get("geometryProfile"),
                        descriptor.get("parameterName"),
                        descriptor.get("valueRange", {}).get("start"),
                        descriptor.get("valueRange", {}).get("end"),
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    score, missing = score_descriptor(descriptor, required, excluded)
                    if missing:
                        continue
                    if any(item in descriptor.get("intentTags", []) for item in excluded):
                        continue
                    candidates.append({
                        "score": round(score, 3),
                        "effect": descriptor.get("effect"),
                        "geometryProfile": descriptor.get("geometryProfile"),
                        "parameterName": descriptor.get("parameterName"),
                        "valueRange": descriptor.get("valueRange"),
                        "patternFamilies": descriptor.get("patternFamilies", []),
                        "intentTags": descriptor.get("intentTags", []),
                        "qualityBand": descriptor.get("qualityBand"),
                        "clarityBand": descriptor.get("clarityBand"),
                        "restraintBand": descriptor.get("restraintBand"),
                        "usefulnessRange": descriptor.get("usefulnessRange", {}),
                        "sampleCount": descriptor.get("sampleCount", 0),
                        "sampleIds": descriptor.get("sampleIds", []),
                    })
    candidates.sort(key=lambda item: (-item["score"], item["effect"], item["geometryProfile"], item["parameterName"]))
    return candidates


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--intent-map", required=True)
    parser.add_argument("--intent", action="append", default=[])
    parser.add_argument("--exclude-intent", action="append", default=[])
    parser.add_argument("--effect", action="append", default=[])
    parser.add_argument("--geometry-profile", action="append", default=[])
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--out-file")
    args = parser.parse_args()

    payload = load_json(Path(args.intent_map))
    required = normalize_list(args.intent)
    excluded = normalize_list(args.exclude_intent)
    effect_filter = set(normalize_list(args.effect))
    geometry_filter = set(normalize_list(args.geometry_profile))

    candidates = collect_candidates(payload, effect_filter, geometry_filter, required, excluded)
    result = {
        "intentQuery": {
            "required": required,
            "excluded": excluded,
            "effects": sorted(effect_filter),
            "geometryProfiles": sorted(geometry_filter),
        },
        "matchCount": len(candidates),
        "matches": candidates[: args.limit],
    }

    text = json.dumps(result, indent=2) + "\n"
    if args.out_file:
        Path(args.out_file).write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
