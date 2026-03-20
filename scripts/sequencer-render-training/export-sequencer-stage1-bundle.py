#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def load_json(path):
    return json.loads(Path(path).read_text())


def normalize_effect_name(value):
    return str(value or '').strip()


def normalize_list(values):
    return sorted({str(v).strip() for v in (values or []) if str(v).strip()})


def geometry_to_bucket(geometry_profile, model_type):
    gp = str(geometry_profile or '').strip()
    mt = str(model_type or '').strip()
    if mt:
        return mt
    if gp.startswith('single_line_'):
        return 'single_line'
    if gp.startswith('arch_'):
        return 'arch'
    if gp.startswith('tree_360_'):
        return 'tree_360'
    if gp.startswith('tree_flat_'):
        return 'tree_flat'
    if gp.startswith('star_'):
        return 'star'
    if gp.startswith('spinner_'):
        return 'spinner'
    if gp.startswith('matrix_'):
        return 'matrix'
    if gp.startswith('cane_'):
        return 'cane'
    if gp.startswith('icicles_'):
        return 'icicles'
    return ''


def build_catalog_indexes(catalog):
    geometry_to_model_type = {}
    geometry_to_analyzer_family = {}
    for row in (catalog.get('canonicalModels') or {}).values():
        gp = str(row.get('geometryProfile') or '').strip()
        if not gp:
            continue
        geometry_to_model_type[gp] = str(row.get('modelType') or '').strip()
        geometry_to_analyzer_family[gp] = str(row.get('analyzerFamily') or '').strip()
    return geometry_to_model_type, geometry_to_analyzer_family


def gather_effect_map_signals(effect_name, effect_maps):
    geometries = {}
    intent_tags = set()
    pattern_families = set()
    structural_labels = set()
    retained_parameters = {}

    for effect_map in effect_maps:
        effect_row = (((effect_map or {}).get('effects') or {}).get(effect_name) or {})
        for geometry_profile, geometry_row in (effect_row.get('geometries') or {}).items():
            entry = geometries.setdefault(geometry_profile, {
                'resolvedModelTypes': set(),
                'intentTags': set(),
                'patternFamilies': set(),
                'structuralLabels': set(),
            })
            entry['resolvedModelTypes'].update(str(v).strip() for v in (geometry_row.get('resolvedModelTypes') or []) if str(v).strip())
            for retained in (geometry_row.get('retainedParameters') or []):
                param_name = str(retained.get('parameterName') or '').strip()
                if not param_name:
                    continue
                retained_parameters[param_name] = {
                    'parameterName': param_name,
                    'status': str(retained.get('status') or '').strip(),
                    'rationale': str(retained.get('rationale') or '').strip(),
                }
            for bucket_entries in (geometry_row.get('intentBuckets') or {}).values():
                for record in (bucket_entries or []):
                    entry['intentTags'].update(str(v).strip() for v in (record.get('intentTags') or []) if str(v).strip())
                    entry['patternFamilies'].update(str(v).strip() for v in (record.get('patternFamilies') or []) if str(v).strip())
                    entry['structuralLabels'].update(str(v).strip() for v in (record.get('structuralLabels') or []) if str(v).strip())
                    intent_tags.update(str(v).strip() for v in (record.get('intentTags') or []) if str(v).strip())
                    pattern_families.update(str(v).strip() for v in (record.get('patternFamilies') or []) if str(v).strip())
                    structural_labels.update(str(v).strip() for v in (record.get('structuralLabels') or []) if str(v).strip())

    normalized_geometries = {}
    for geometry_profile, row in geometries.items():
        normalized_geometries[geometry_profile] = {
            'resolvedModelTypes': sorted(row['resolvedModelTypes']),
            'intentTags': sorted(row['intentTags']),
            'patternFamilies': sorted(row['patternFamilies']),
            'structuralLabels': sorted(row['structuralLabels'])[:48],
        }

    return {
        'geometries': normalized_geometries,
        'intentTags': sorted(intent_tags),
        'patternFamilies': sorted(pattern_families),
        'structuralLabels': sorted(structural_labels)[:96],
        'retainedParameters': sorted(retained_parameters.values(), key=lambda row: row['parameterName'].lower()),
    }


def build_bundle(equalization, coverage_audit, catalog, effect_maps):
    geometry_to_model_type, geometry_to_analyzer_family = build_catalog_indexes(catalog)
    coverage_by_effect = {normalize_effect_name(row.get('effect')): row for row in (coverage_audit.get('effects') or [])}
    out = {
        'artifactType': 'sequencer_stage1_training_bundle',
        'artifactVersion': '1.0',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'description': 'Repo-managed Stage 1 render-training bundle for sequencer effect selection and planning.',
        'stage1': {
            'effectCount': int(equalization.get('effectCount') or 0),
            'equalizedCount': int(equalization.get('equalizedCount') or 0),
            'targetState': (((equalization.get('equalStateDefinition') or {}).get('targetStage')) or '').strip(),
        },
        'effectsByName': {},
        'selectorReadyEffects': [],
        'modelTypeIndex': {},
    }

    for row in (equalization.get('effects') or []):
        effect_name = normalize_effect_name(row.get('effect'))
        if not effect_name:
            continue
        coverage_row = coverage_by_effect.get(effect_name, {})
        effect_map_signals = gather_effect_map_signals(effect_name, effect_maps)
        covered_profiles = normalize_list(
            ((coverage_row.get('primaryCoverage') or {}).get('coveredProfiles') or []) +
            ((coverage_row.get('probeCoverage') or {}).get('coveredProfiles') or [])
        )
        model_types = set()
        analyzer_families = set()
        for geometry_profile in covered_profiles:
            model_type = geometry_to_bucket(geometry_profile, geometry_to_model_type.get(geometry_profile))
            if model_type:
                model_types.add(model_type)
            analyzer_family = str(geometry_to_analyzer_family.get(geometry_profile) or '').strip()
            if analyzer_family:
                analyzer_families.add(analyzer_family)
        for geometry_profile, geometry_row in (effect_map_signals.get('geometries') or {}).items():
            for model_type in (geometry_row.get('resolvedModelTypes') or []):
                model_types.add(str(model_type).strip())
            if geometry_profile in geometry_to_analyzer_family:
                analyzer_families.add(str(geometry_to_analyzer_family[geometry_profile]).strip())

        effect_bundle = {
            'effectName': effect_name,
            'equalized': bool(row.get('equalized')),
            'currentStage': str(row.get('currentStage') or '').strip(),
            'stages': row.get('stages') or {},
            'selectorEvidence': row.get('selectorEvidence') or {},
            'complexityClass': str(coverage_row.get('complexityClass') or '').strip(),
            'coveragePolicy': str(coverage_row.get('coveragePolicy') or '').strip(),
            'status': str(coverage_row.get('status') or '').strip(),
            'supportedGeometryProfiles': covered_profiles,
            'supportedModelTypes': sorted(v for v in model_types if v),
            'supportedAnalyzerFamilies': sorted(v for v in analyzer_families if v),
            'intentTags': effect_map_signals.get('intentTags') or [],
            'patternFamilies': effect_map_signals.get('patternFamilies') or [],
            'structuralLabels': effect_map_signals.get('structuralLabels') or [],
            'retainedParameters': effect_map_signals.get('retainedParameters') or [],
            'geometries': effect_map_signals.get('geometries') or {},
            'notes': row.get('notes') or [],
        }
        out['effectsByName'][effect_name] = effect_bundle
        if effect_bundle['stages'].get('selector_ready'):
            out['selectorReadyEffects'].append(effect_name)
        for model_type in effect_bundle['supportedModelTypes']:
            out['modelTypeIndex'].setdefault(model_type, []).append(effect_name)

    out['selectorReadyEffects'] = sorted(set(out['selectorReadyEffects']))
    out['modelTypeIndex'] = {key: sorted(set(values)) for key, values in sorted(out['modelTypeIndex'].items())}
    out['effectsByName'] = {key: out['effectsByName'][key] for key in sorted(out['effectsByName'])}
    return out


def write_js_module(bundle, output_path):
    text = json.dumps(bundle, indent=2, sort_keys=False)
    Path(output_path).write_text(
        '// Auto-generated by scripts/sequencer-render-training/export-sequencer-stage1-bundle.py\n'
        'export const STAGE1_TRAINED_EFFECT_BUNDLE = ' + text + ';\n'
    )


def main():
    parser = argparse.ArgumentParser(description='Export a repo-managed Stage 1 training bundle for the sequencer runtime.')
    parser.add_argument('--equalization-board', required=True)
    parser.add_argument('--coverage-audit', required=True)
    parser.add_argument('--catalog', default='scripts/sequencer-render-training/generic-layout-model-catalog.json')
    parser.add_argument('--intent-map', action='append', default=[])
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    bundle = build_bundle(
        load_json(args.equalization_board),
        load_json(args.coverage_audit),
        load_json(args.catalog),
        [load_json(path) for path in args.intent_map],
    )
    write_js_module(bundle, args.output)
    print(json.dumps({
        'output': str(Path(args.output).resolve()),
        'effectCount': len(bundle.get('effectsByName') or {}),
        'selectorReadyEffects': bundle.get('selectorReadyEffects') or [],
    }, indent=2))


if __name__ == '__main__':
    main()
