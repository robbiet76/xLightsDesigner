#!/usr/bin/env python3
import argparse
import json

GEOMETRY_FAMILY_WEIGHT = {
    'matrix': 0,
    'tree': 1,
    'star': 2,
    'spinner': 3,
    'arch': 4,
    'line': 5,
    'icicles': 6,
    'cane': 7,
    'single_node': 8,
}


def geometry_family(profile: str) -> str:
    if profile.startswith('matrix_'):
        return 'matrix'
    if profile.startswith('tree_'):
        return 'tree'
    if profile.startswith('star_'):
        return 'star'
    if profile.startswith('spinner_'):
        return 'spinner'
    if profile.startswith('arch_'):
        return 'arch'
    if profile.startswith('single_line_'):
        return 'single_node' if profile.endswith('single_node') else 'line'
    if profile.startswith('icicles_'):
        return 'icicles'
    if profile.startswith('cane_'):
        return 'cane'
    return 'other'


def recommended_depth(effect: str, coverage_type: str, equalized: bool) -> str:
    if effect == 'On':
        return 'baseline_reduced'
    if coverage_type == 'probe':
        return 'probe_reduced'
    if not equalized:
        return 'expanded_screen'
    return 'gap_fill_reduced'


def main():
    parser = argparse.ArgumentParser(description='Generate a machine-readable Stage 1 coverage backlog from the audit artifact.')
    parser.add_argument('--audit', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    with open(args.audit, 'r', encoding='utf-8') as f:
        audit = json.load(f)

    priority_rank = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    items = []
    for effect_entry in audit['effects']:
        for group_name, coverage_type in [('primaryCoverage', 'primary'), ('probeCoverage', 'probe')]:
            for profile in effect_entry[group_name]['missingProfiles']:
                family = geometry_family(profile)
                items.append({
                    'effect': effect_entry['effect'],
                    'priority': effect_entry['priority'],
                    'status': effect_entry['status'],
                    'equalized': effect_entry['equalized'],
                    'complexityClass': effect_entry['complexityClass'],
                    'coverageType': coverage_type,
                    'geometryProfile': profile,
                    'geometryFamily': family,
                    'recommendedDepth': recommended_depth(effect_entry['effect'], coverage_type, effect_entry['equalized'])
                })

    items.sort(key=lambda x: (
        priority_rank.get(x['priority'], 9),
        0 if x['coverageType'] == 'primary' else 1,
        GEOMETRY_FAMILY_WEIGHT.get(x['geometryFamily'], 99),
        x['effect'],
        x['geometryProfile'],
    ))

    hour1 = items[:40]
    out = {
        'version': '1.0',
        'description': 'Ordered Stage 1 coverage backlog derived from the full-coverage audit.',
        'sourceAudit': args.audit,
        'totalBacklogItems': len(items),
        'recommendedHour1ItemCount': len(hour1),
        'recommendedHour1': hour1,
        'items': items,
    }

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
