#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def build_eval_index(eval_payload: dict):
    index = {}
    for result in eval_payload.get('results', []):
        effects = result.get('query', {}).get('effects', [])
        for effect in effects:
            index.setdefault(effect, []).append(result)
    return index


def all_cases_passed(results):
    return bool(results) and all(item.get('passed') for item in results)


def effect_maturity(effect_name: str, summary: dict, intent_map: dict, eval_index: dict):
    effect_summary = summary.get('effects', {}).get(effect_name)
    if not effect_summary:
        return None

    geometries = effect_summary.get('geometries', {})
    high_impact = []
    interaction_suspected = []
    context_flat = []
    for geometry_name, geometry in geometries.items():
        for parameter in geometry.get('parameters', []):
            status = parameter.get('observedImpact', {}).get('status')
            entry = {
                'geometryProfile': geometry_name,
                'parameterName': parameter.get('parameterName'),
                'status': status,
            }
            if status == 'high_impact_observed':
                high_impact.append(entry)
            elif status == 'interaction_suspected':
                interaction_suspected.append(entry)
            elif status == 'context_flat_observed':
                context_flat.append(entry)

    effect_intent = intent_map.get('effects', {}).get(effect_name, {})
    in_selector = bool(effect_intent.get('geometries'))
    eval_results = eval_index.get(effect_name, [])
    retrieval_ready = all_cases_passed(eval_results)

    stages = {
        'execution_ready': True,
        'structurally_observable': bool(high_impact),
        'structurally_retrievable': retrieval_ready,
        'selector_ready': in_selector and retrieval_ready,
        'designer_language_candidate': False,
        'layered_effect_ready': False,
    }

    if stages['selector_ready']:
        current_stage = 'selector_ready'
    elif stages['structurally_retrievable']:
        current_stage = 'structurally_retrievable'
    elif stages['structurally_observable']:
        current_stage = 'structurally_observable'
    else:
        current_stage = 'execution_ready'

    return {
        'effect': effect_name,
        'currentStage': current_stage,
        'stages': stages,
        'geometryCount': len(geometries),
        'supportedGeometryProfiles': sorted(geometries.keys()),
        'highImpactObserved': high_impact,
        'interactionSuspected': interaction_suspected,
        'contextFlatObserved': context_flat,
        'evaluation': {
            'caseCount': len(eval_results),
            'passedCount': sum(1 for item in eval_results if item.get('passed')),
            'failedCount': sum(1 for item in eval_results if not item.get('passed')),
            'caseIds': [item.get('caseId') for item in eval_results],
        },
        'notes': [
            'designer_language_candidate remains false until broad style-language evaluation exists',
            'layered_effect_ready remains false until Stage 2 layered-effect training begins',
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--summary', required=True)
    parser.add_argument('--intent-map', required=True)
    parser.add_argument('--eval-results', required=True)
    parser.add_argument('--out-file', required=True)
    args = parser.parse_args()

    summary = load_json(Path(args.summary))
    intent_map = load_json(Path(args.intent_map))
    eval_results = load_json(Path(args.eval_results))
    eval_index = build_eval_index(eval_results)

    effects = []
    for effect_name in sorted(summary.get('effects', {}).keys()):
        item = effect_maturity(effect_name, summary, intent_map, eval_index)
        if item:
            effects.append(item)

    payload = {
        'version': '1.0',
        'description': 'Effect maturity tracking for the render-training system.',
        'summaryPath': args.summary,
        'intentMapPath': args.intent_map,
        'evaluationPath': args.eval_results,
        'effectCount': len(effects),
        'effects': effects,
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + '\n')


if __name__ == '__main__':
    main()
