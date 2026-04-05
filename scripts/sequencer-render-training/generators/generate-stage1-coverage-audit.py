#!/usr/bin/env python3
import argparse
import glob
import json
import os
from collections import defaultdict


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_manifest_coverage(manifest_dir, model_to_profile):
    coverage = defaultdict(set)
    for path in glob.glob(os.path.join(manifest_dir, '*.json')):
        if '-interactions-' in os.path.basename(path):
            continue
        try:
            data = load_json(path)
        except Exception:
            continue
        model_name = data.get('fixture', {}).get('modelName')
        profile = model_to_profile.get(model_name)
        if not profile:
            continue
        for sample in data.get('samples', []):
            effect = sample.get('effectName')
            if effect:
                coverage[effect].add(profile)
    return coverage


def build_ledger_coverage(ledger_path):
    coverage = defaultdict(set)
    if not ledger_path or not os.path.exists(ledger_path):
        return coverage
    data = load_json(ledger_path)
    for item in data.get('items', []):
        if item.get('status') != 'completed':
            continue
        effect = item.get('effect')
        profile = item.get('geometryProfile')
        if effect and profile:
            coverage[effect].add(profile)
    return coverage


def load_equalized(equalization_path):
    if not equalization_path or not os.path.exists(equalization_path):
        return {}
    data = load_json(equalization_path)
    out = {}
    for item in data.get('effects', []):
        out[item['effect']] = {
            'equalized': item.get('equalized', False),
            'currentStage': item.get('currentStage'),
            'selectorEvidence': item.get('selectorEvidence', {})
        }
    return out


def status_for(effect_name, effect_scope, covered_primary, missing_primary, covered_probe, missing_probe, equalized):
    if not covered_primary and missing_primary:
        return 'not_started'
    if missing_primary:
        return 'primary_incomplete'
    if missing_probe:
        return 'probe_pending' if effect_scope['probeProfiles'] else 'primary_complete'
    if equalized:
        return 'fully_covered_and_equalized'
    return 'coverage_complete_not_equalized'


def priority_for(status, equalized):
    if status == 'not_started':
        return 'critical'
    if status == 'primary_incomplete' and not equalized:
        return 'critical'
    if status == 'primary_incomplete':
        return 'high'
    if status == 'coverage_complete_not_equalized':
        return 'high'
    if status == 'probe_pending':
        return 'medium'
    return 'low'


def main():
    parser = argparse.ArgumentParser(description='Audit Stage 1 effect x model coverage against the canonical scope contract.')
    parser.add_argument('--scope', default='scripts/sequencer-render-training/catalog/stage1-effect-model-scope.json')
    parser.add_argument('--catalog', default='scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json')
    parser.add_argument('--registry', default='scripts/sequencer-render-training/catalog/effect-parameter-registry.json')
    parser.add_argument('--manifest-dir', default='scripts/sequencer-render-training/manifests')
    parser.add_argument('--equalization', default='/tmp/render-training-current-effect-equalization.v5.json')
    parser.add_argument('--completed-ledger')
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    scope = load_json(args.scope)
    catalog = load_json(args.catalog)
    registry = load_json(args.registry)
    equalized = load_equalized(args.equalization)

    canonical_models = catalog['canonicalModels']
    model_to_profile = {v['modelName']: v['geometryProfile'] for v in canonical_models.values()}
    profile_to_model = {v['geometryProfile']: v['modelName'] for v in canonical_models.values()}
    manifest_coverage = build_manifest_coverage(args.manifest_dir, model_to_profile)
    ledger_coverage = build_ledger_coverage(args.completed_ledger)
    effective_coverage = defaultdict(set)
    all_effects = set(manifest_coverage.keys()) | set(ledger_coverage.keys())
    for effect in all_effects:
        effective_coverage[effect] = set(manifest_coverage.get(effect, set())) | set(ledger_coverage.get(effect, set()))

    results = []
    for effect_name, effect_scope in scope['effects'].items():
        covered = effective_coverage.get(effect_name, set())
        primary = effect_scope['primaryProfiles']
        probe = effect_scope['probeProfiles']
        covered_primary = sorted([p for p in primary if p in covered])
        missing_primary = sorted([p for p in primary if p not in covered])
        covered_probe = sorted([p for p in probe if p in covered])
        missing_probe = sorted([p for p in probe if p not in covered])
        eq = equalized.get(effect_name, {})
        status = status_for(effect_name, effect_scope, covered_primary, missing_primary, covered_probe, missing_probe, eq.get('equalized', False))
        priority = priority_for(status, eq.get('equalized', False))
        candidate_profiles = missing_primary if missing_primary else missing_probe

        results.append({
            'effect': effect_name,
            'complexityClass': registry['effects'].get(effect_name, {}).get('complexityClass'),
            'coveragePolicy': effect_scope['coveragePolicy'],
            'equalized': eq.get('equalized', False),
            'currentStage': eq.get('currentStage'),
            'status': status,
            'priority': priority,
            'primaryCoverage': {
                'coveredCount': len(covered_primary),
                'targetCount': len(primary),
                'coverageRatio': round(len(covered_primary) / len(primary), 3) if primary else 1.0,
                'coveredProfiles': covered_primary,
                'missingProfiles': missing_primary
            },
            'probeCoverage': {
                'coveredCount': len(covered_probe),
                'targetCount': len(probe),
                'coverageRatio': round(len(covered_probe) / len(probe), 3) if probe else 1.0,
                'coveredProfiles': covered_probe,
                'missingProfiles': missing_probe
            },
            'nextProfiles': [
                {
                    'geometryProfile': p,
                    'modelName': profile_to_model[p],
                    'coverageType': 'primary' if p in missing_primary else 'probe'
                }
                for p in candidate_profiles
            ],
            'notes': effect_scope.get('notes')
        })

    severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    results.sort(key=lambda x: (severity_order.get(x['priority'], 9), x['effect']))

    summary = {
        'version': '1.0',
        'description': 'Stage 1 effect x model coverage audit for the canonical render-training scope.',
        'scopePath': os.path.abspath(args.scope),
        'catalogPath': os.path.abspath(args.catalog),
        'manifestDir': os.path.abspath(args.manifest_dir),
        'completedLedgerPath': os.path.abspath(args.completed_ledger) if args.completed_ledger else None,
        'equalizationPath': os.path.abspath(args.equalization) if args.equalization else None,
        'effectCount': len(results),
        'effectsNeedingWork': len([r for r in results if r['priority'] != 'low']),
        'criticalEffects': [r['effect'] for r in results if r['priority'] == 'critical'],
        'highPriorityEffects': [r['effect'] for r in results if r['priority'] == 'high'],
        'mediumPriorityEffects': [r['effect'] for r in results if r['priority'] == 'medium'],
        'effects': results
    }

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
