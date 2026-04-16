#!/usr/bin/env python3
import argparse
import json


def main():
    parser = argparse.ArgumentParser(description='Build a filtered Stage 1 backlog subset for a monitored chunk run.')
    parser.add_argument('--backlog', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--geometry-profile', action='append', default=[])
    parser.add_argument('--effect', action='append', default=[])
    args = parser.parse_args()

    with open(args.backlog, 'r', encoding='utf-8') as f:
        backlog = json.load(f)

    geometry_filters = set(args.geometry_profile)
    effect_filters = set(args.effect)

    def include(item):
        if geometry_filters and item.get('geometryProfile') not in geometry_filters:
            return False
        if effect_filters and item.get('effect') not in effect_filters:
            return False
        return True

    items = [item for item in backlog.get('items', []) if include(item)]
    out = {
        'version': backlog.get('version', '1.0'),
        'description': 'Filtered Stage 1 coverage backlog subset.',
        'sourceBacklog': args.backlog,
        'geometryProfiles': sorted(geometry_filters),
        'effects': sorted(effect_filters),
        'totalBacklogItems': len(items),
        'recommendedHour1ItemCount': len(items),
        'recommendedHour1': items[:],
        'items': items,
    }

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
