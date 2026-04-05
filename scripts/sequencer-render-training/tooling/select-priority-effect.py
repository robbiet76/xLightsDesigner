#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict
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


def score_terms(descriptor_values, required, excluded, weight):
    values = set(descriptor_values or [])
    score = 0
    missing = []
    for item in required:
        if item in values:
            score += weight
        else:
            missing.append(item)
    for item in excluded:
        if item in values:
            score -= weight + 1
    return score, missing


def collect_candidates(
    intent_map,
    effect_filter,
    geometry_filter,
    required,
    excluded,
    required_structural,
    excluded_structural,
    required_families,
    excluded_families,
):
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
                        tuple(descriptor.get("patternFamilies", [])),
                        tuple(descriptor.get("structuralLabels", [])),
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    score, missing = score_descriptor(descriptor, required, excluded)
                    structural_score, structural_missing = score_terms(
                        descriptor.get("structuralLabels", []),
                        required_structural,
                        excluded_structural,
                        2,
                    )
                    family_score, family_missing = score_terms(
                        descriptor.get("patternFamilies", []),
                        required_families,
                        excluded_families,
                        3,
                    )
                    score += structural_score + family_score
                    if missing:
                        continue
                    if structural_missing or family_missing:
                        continue
                    if any(item in descriptor.get("intentTags", []) for item in excluded):
                        continue
                    if any(item in descriptor.get("structuralLabels", []) for item in excluded_structural):
                        continue
                    if any(item in descriptor.get("patternFamilies", []) for item in excluded_families):
                        continue
                    candidates.append({
                        "score": round(score, 3),
                        "effect": descriptor.get("effect"),
                        "geometryProfile": descriptor.get("geometryProfile"),
                        "parameterName": descriptor.get("parameterName"),
                        "valueRange": descriptor.get("valueRange"),
                        "patternFamilies": descriptor.get("patternFamilies", []),
                        "structuralLabels": descriptor.get("structuralLabels", []),
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


def group_effect_scores(candidates, top_n):
    grouped = defaultdict(lambda: {"score": 0.0, "matchCount": 0, "topMatches": []})
    for candidate in candidates[:top_n]:
        effect = candidate["effect"]
        grouped[effect]["score"] += candidate["score"]
        grouped[effect]["matchCount"] += 1
        grouped[effect]["topMatches"].append(candidate)
    ranked = []
    for effect, payload in grouped.items():
        ranked.append({
            "effect": effect,
            "aggregateScore": round(payload["score"], 3),
            "matchCount": payload["matchCount"],
            "topMatches": payload["topMatches"],
        })
    ranked.sort(key=lambda item: (-item["aggregateScore"], -item["matchCount"], item["effect"]))
    return ranked


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--intent-map", required=True)
    parser.add_argument("--intent", action="append", default=[])
    parser.add_argument("--exclude-intent", action="append", default=[])
    parser.add_argument("--structural-label", action="append", default=[])
    parser.add_argument("--exclude-structural-label", action="append", default=[])
    parser.add_argument("--pattern-family", action="append", default=[])
    parser.add_argument("--exclude-pattern-family", action="append", default=[])
    parser.add_argument("--geometry-profile", action="append", default=[])
    parser.add_argument("--effect", action="append", default=[])
    parser.add_argument("--top-n-candidates", type=int, default=12)
    parser.add_argument("--top-n-matches", type=int, default=3)
    parser.add_argument("--out-file")
    args = parser.parse_args()

    intent_map = load_json(Path(args.intent_map))
    required = normalize_list(args.intent)
    excluded = normalize_list(args.exclude_intent)
    required_structural = normalize_list(args.structural_label)
    excluded_structural = normalize_list(args.exclude_structural_label)
    required_families = normalize_list(args.pattern_family)
    excluded_families = normalize_list(args.exclude_pattern_family)
    geometry_filter = set(normalize_list(args.geometry_profile))
    effect_filter = set(normalize_list(args.effect))

    candidates = collect_candidates(
        intent_map,
        effect_filter,
        geometry_filter,
        required,
        excluded,
        required_structural,
        excluded_structural,
        required_families,
        excluded_families,
    )
    ranked_effects = group_effect_scores(candidates, args.top_n_candidates)
    result = {
        "query": {
            "requiredIntents": required,
            "excludedIntents": excluded,
            "requiredStructuralLabels": required_structural,
            "excludedStructuralLabels": excluded_structural,
            "requiredPatternFamilies": required_families,
            "excludedPatternFamilies": excluded_families,
            "geometryProfiles": sorted(geometry_filter),
            "effects": sorted(effect_filter),
        },
        "candidateCount": len(candidates),
        "rankedEffects": [
            {
                **item,
                "topMatches": item["topMatches"][: args.top_n_matches],
            }
            for item in ranked_effects
        ],
        "selectedEffect": ranked_effects[0]["effect"] if ranked_effects else None,
    }

    text = json.dumps(result, indent=2) + "\n"
    if args.out_file:
        Path(args.out_file).write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
