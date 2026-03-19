#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


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


def load_cases(path: Path):
    with path.open() as f:
        return json.load(f)


def matches_expectation(candidate: dict, expected: dict) -> bool:
    if not expected:
        return True
    if expected.get('effect') and candidate.get('effect') != expected['effect']:
        return False
    if expected.get('geometryProfile') and candidate.get('geometryProfile') != expected['geometryProfile']:
        return False
    if expected.get('parameterName') and candidate.get('parameterName') != expected['parameterName']:
        return False
    pattern_families = set(candidate.get('patternFamilies', []))
    for family in expected.get('patternFamiliesAny', []):
        if family in pattern_families:
            break
    else:
        if expected.get('patternFamiliesAny'):
            return False
    intent_tags = set(candidate.get('intentTags', []))
    for tag in expected.get('intentTagsAll', []):
        if tag not in intent_tags:
            return False
    return True


def evaluate_case(intent_map: dict, case: dict) -> dict:
    required = case.get('requiredIntents', [])
    excluded = case.get('excludedIntents', [])
    effect_filter = set(case.get('effects', []))
    geometry_filter = set(case.get('geometryProfiles', []))
    limit = case.get('limit', 5)
    candidates = collect_candidates(intent_map, effect_filter, geometry_filter, required, excluded)
    top = candidates[:limit]
    expected_top = case.get('expectedTop', {})
    top_match = top[0] if top else None
    passed = bool(top_match) and matches_expectation(top_match, expected_top)
    return {
        'caseId': case['caseId'],
        'description': case['description'],
        'query': {
            'requiredIntents': required,
            'excludedIntents': excluded,
            'effects': sorted(effect_filter),
            'geometryProfiles': sorted(geometry_filter),
        },
        'passed': passed,
        'expectedTop': expected_top,
        'topMatch': top_match,
        'matchCount': len(candidates),
        'matches': top,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--intent-map', required=True)
    parser.add_argument('--cases', required=True)
    parser.add_argument('--out-file', required=True)
    args = parser.parse_args()

    intent_map = load_json(Path(args.intent_map))
    cases = load_cases(Path(args.cases))['cases']
    results = [evaluate_case(intent_map, case) for case in cases]
    payload = {
        'version': '1.0',
        'intentMap': args.intent_map,
        'casesPath': args.cases,
        'caseCount': len(results),
        'passedCount': sum(1 for item in results if item['passed']),
        'failedCount': sum(1 for item in results if not item['passed']),
        'results': results,
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + '\n')


if __name__ == '__main__':
    main()
