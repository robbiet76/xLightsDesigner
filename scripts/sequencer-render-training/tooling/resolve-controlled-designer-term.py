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


def score_terms(values_in, required, excluded, weight):
    values = set(values_in or [])
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


def collect_candidates(intent_map, query):
    req_i = query.get('requiredIntents', [])
    exc_i = query.get('excludedIntents', [])
    req_s = query.get('requiredStructuralLabels', [])
    exc_s = query.get('excludedStructuralLabels', [])
    req_f = query.get('requiredPatternFamilies', [])
    exc_f = query.get('excludedPatternFamilies', [])
    effect_filter = set(query.get('effects', []))
    geometry_filter = set(query.get('geometryProfiles', []))
    candidates = []
    for effect_name, effect_payload in intent_map.get('effects', {}).items():
        if effect_filter and effect_name not in effect_filter:
            continue
        for geometry, geometry_payload in effect_payload.get('geometries', {}).items():
            if geometry_filter and geometry not in geometry_filter:
                continue
            seen = set()
            for bucket in geometry_payload.get('intentBuckets', {}).values():
                for descriptor in bucket:
                    key = (
                        descriptor.get('effect'), descriptor.get('geometryProfile'), descriptor.get('parameterName'),
                        descriptor.get('valueRange', {}).get('start'), descriptor.get('valueRange', {}).get('end'),
                        tuple(descriptor.get('patternFamilies', [])), tuple(descriptor.get('structuralLabels', [])),
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    score, missing = score_descriptor(descriptor, req_i, exc_i)
                    structural_score, structural_missing = score_terms(descriptor.get('structuralLabels', []), req_s, exc_s, 2)
                    family_score, family_missing = score_terms(descriptor.get('patternFamilies', []), req_f, exc_f, 3)
                    score += structural_score + family_score
                    if missing or structural_missing or family_missing:
                        continue
                    if any(x in descriptor.get('intentTags', []) for x in exc_i):
                        continue
                    if any(x in descriptor.get('structuralLabels', []) for x in exc_s):
                        continue
                    if any(x in descriptor.get('patternFamilies', []) for x in exc_f):
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


def select_effect(candidates, top_n=12, top_matches=3):
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
        'rankedEffects': [{**item, 'topMatches': item['topMatches'][:top_matches]} for item in ranked]
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--intent-map', required=True)
    parser.add_argument('--vocab', required=True)
    parser.add_argument('--term', required=True)
    parser.add_argument('--out-file')
    args = parser.parse_args()
    intent_map = load_json(Path(args.intent_map))
    vocab = load_json(Path(args.vocab))
    term = vocab['terms'][args.term]
    query = term['query']
    candidates = collect_candidates(intent_map, query)
    selection = select_effect(candidates)
    payload = {
        'term': args.term,
        'description': term.get('description'),
        'query': query,
        'candidateCount': len(candidates),
        **selection,
    }
    text = json.dumps(payload, indent=2) + '\n'
    if args.out_file:
        Path(args.out_file).write_text(text)
    else:
        print(text, end='')

if __name__ == '__main__':
    main()
