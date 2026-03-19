#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def score_descriptor(descriptor, required, excluded):
    intents = set(descriptor.get('intentTags', []))
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
    if descriptor.get('clarityBand') == 'high':
        score += 1
    if descriptor.get('qualityBand') == 'high':
        score += 1
    usefulness = descriptor.get('usefulnessRange', {}).get('max')
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


def collect_candidates(intent_map, effect_filter, geometry_filter, required, excluded, required_structural, excluded_structural, required_families, excluded_families):
    candidates = []
    for effect_name, effect_payload in intent_map.get('effects', {}).items():
        if effect_filter and effect_name not in effect_filter:
            continue
        for geometry, geometry_payload in effect_payload.get('geometries', {}).items():
            if geometry_filter and geometry not in geometry_filter:
                continue
            seen = set()
            for intent_bucket in geometry_payload.get('intentBuckets', {}).values():
                for descriptor in intent_bucket:
                    key = (
                        descriptor.get('effect'),
                        descriptor.get('geometryProfile'),
                        descriptor.get('parameterName'),
                        descriptor.get('valueRange', {}).get('start'),
                        descriptor.get('valueRange', {}).get('end'),
                        tuple(descriptor.get('patternFamilies', [])),
                        tuple(descriptor.get('structuralLabels', [])),
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    score, missing = score_descriptor(descriptor, required, excluded)
                    structural_score, structural_missing = score_terms(descriptor.get('structuralLabels', []), required_structural, excluded_structural, 2)
                    family_score, family_missing = score_terms(descriptor.get('patternFamilies', []), required_families, excluded_families, 3)
                    score += structural_score + family_score
                    if missing or structural_missing or family_missing:
                        continue
                    if any(item in descriptor.get('intentTags', []) for item in excluded):
                        continue
                    if any(item in descriptor.get('structuralLabels', []) for item in excluded_structural):
                        continue
                    if any(item in descriptor.get('patternFamilies', []) for item in excluded_families):
                        continue
                    candidates.append({
                        'score': round(score, 3),
                        'effect': descriptor.get('effect'),
                        'geometryProfile': descriptor.get('geometryProfile'),
                        'parameterName': descriptor.get('parameterName'),
                        'valueRange': descriptor.get('valueRange'),
                        'patternFamilies': descriptor.get('patternFamilies', []),
                        'structuralLabels': descriptor.get('structuralLabels', []),
                        'intentTags': descriptor.get('intentTags', []),
                    })
    candidates.sort(key=lambda item: (-item['score'], item['effect'], item['geometryProfile'], item['parameterName']))
    return candidates


def select_effect(intent_map, case):
    required = case.get('requiredIntents', [])
    excluded = case.get('excludedIntents', [])
    required_structural = case.get('requiredStructuralLabels', [])
    excluded_structural = case.get('excludedStructuralLabels', [])
    required_families = case.get('requiredPatternFamilies', [])
    excluded_families = case.get('excludedPatternFamilies', [])
    effect_filter = set(case.get('effects', []))
    geometry_filter = set(case.get('geometryProfiles', []))
    top_n = case.get('topNCandidates', 12)
    candidates = collect_candidates(intent_map, effect_filter, geometry_filter, required, excluded, required_structural, excluded_structural, required_families, excluded_families)
    grouped = {}
    for candidate in candidates[:top_n]:
        effect = candidate['effect']
        bucket = grouped.setdefault(effect, {'effect': effect, 'aggregateScore': 0.0, 'matchCount': 0, 'topMatches': []})
        bucket['aggregateScore'] += candidate['score']
        bucket['matchCount'] += 1
        bucket['topMatches'].append(candidate)
    ranked = sorted(grouped.values(), key=lambda item: (-item['aggregateScore'], -item['matchCount'], item['effect']))
    return {
        'selectedEffect': ranked[0]['effect'] if ranked else None,
        'rankedEffects': ranked,
        'candidateCount': len(candidates),
    }


def evaluate_case(intent_map, case):
    selection = select_effect(intent_map, case)
    expected = case.get('expectedSelection')
    passed = selection['selectedEffect'] == expected
    return {
        'caseId': case['caseId'],
        'description': case['description'],
        'query': {
            'requiredIntents': case.get('requiredIntents', []),
            'excludedIntents': case.get('excludedIntents', []),
            'requiredStructuralLabels': case.get('requiredStructuralLabels', []),
            'excludedStructuralLabels': case.get('excludedStructuralLabels', []),
            'requiredPatternFamilies': case.get('requiredPatternFamilies', []),
            'excludedPatternFamilies': case.get('excludedPatternFamilies', []),
            'effects': case.get('effects', []),
            'geometryProfiles': case.get('geometryProfiles', []),
        },
        'expectedSelection': expected,
        'selectedEffect': selection['selectedEffect'],
        'passed': passed,
        'candidateCount': selection['candidateCount'],
        'rankedEffects': selection['rankedEffects'],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--intent-map', required=True)
    parser.add_argument('--cases', required=True)
    parser.add_argument('--out-file', required=True)
    args = parser.parse_args()
    intent_map = load_json(Path(args.intent_map))
    cases = load_json(Path(args.cases))['cases']
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
