#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path


EFFECT_TEMPLATE_MANIFESTS = {
    'On': 'scripts/sequencer-render-training/manifests/on-singlelinehorizontal-reduced-sweep-v1.json',
    'SingleStrand': 'scripts/sequencer-render-training/manifests/singlestrand-singlelinehorizontal-expanded-sweep-v1.json',
    'Shimmer': 'scripts/sequencer-render-training/manifests/shimmer-singlelinehorizontal-expanded-sweep-v1.json',
    'Color Wash': 'scripts/sequencer-render-training/manifests/colorwash-matrix-expanded-sweep-v2.json',
    'Bars': 'scripts/sequencer-render-training/manifests/bars-singlelinehorizontal-expanded-sweep-v1.json',
    'Marquee': 'scripts/sequencer-render-training/manifests/marquee-singlelinehorizontal-expanded-sweep-v1.json',
    'Pinwheel': 'scripts/sequencer-render-training/manifests/pinwheel-starsingle-expanded-sweep-v1.json',
    'Spirals': 'scripts/sequencer-render-training/manifests/spirals-treeround-expanded-sweep-v1.json',
    'Shockwave': 'scripts/sequencer-render-training/manifests/shockwave-treeflat-expanded-sweep-v1.json',
    'Twinkle': 'scripts/sequencer-render-training/manifests/twinkle-singlelinehorizontal-expanded-sweep-v1.json',
}

DEFAULT_XLIGHTS_PALETTE = {
    "C_BUTTON_Palette1": "#FFFFFF",
    "C_BUTTON_Palette2": "#FF0000",
    "C_BUTTON_Palette3": "#00FF00",
    "C_BUTTON_Palette4": "#0000FF",
    "C_BUTTON_Palette5": "#FFFF00",
    "C_BUTTON_Palette6": "#000000",
}

PALETTE_VARIANTS = [
    {
        "suffix": "mono-white",
        "profile": "mono_white",
        "activationMode": "xlights_default",
        "activeSlots": [1],
        "labelHints": ["palette_mono_white"],
    },
    {
        "suffix": "rgb-primary",
        "profile": "rgb_primary",
        "activationMode": "xlights_default",
        "activeSlots": [2, 3, 4],
        "labelHints": ["palette_rgb_primary"],
    },
]

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate a runnable Stage 1 coverage plan from the ordered backlog.')
    parser.add_argument('--backlog', required=True)
    parser.add_argument('--catalog', default='scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json')
    parser.add_argument('--registry', default='scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json')
    parser.add_argument('--manifest-dir', default='scripts/sequencer-render-training/manifests')
    parser.add_argument('--out-plan', required=True)
    parser.add_argument('--out-manifest-dir', required=True)
    parser.add_argument('--summary-out')
    parser.add_argument('--limit', type=int, default=40)
    parser.add_argument('--completed-ledger')
    return parser.parse_args()


def load_json(path: str | Path) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_completed_keys(path: str | None) -> set[tuple[str, str, str]]:
    if not path:
        return set()
    ledger = load_json(path)
    out = set()
    for item in ledger.get('items', []):
        if item.get('status') != 'completed':
            continue
        out.add((item['effect'], item['geometryProfile'], item['coverageType']))
    return out


def canonical_model_maps(catalog: dict):
    by_profile = {}
    for _, item in catalog['canonicalModels'].items():
        by_profile[item['geometryProfile']] = {
            'modelName': item['modelName'],
            'modelType': item['modelType'],
            'geometryProfile': item['geometryProfile'],
        }
    return by_profile


def choose_parameters(effect: str, coverage_type: str, registry: dict) -> list[str]:
    effect_registry = registry['effects'][effect]['parameters']
    ordered = list(effect_registry.keys())
    if coverage_type == 'primary':
        return ordered
    return [
        name for name, meta in effect_registry.items()
        if meta.get('phase') in {'baseline', 'screen'}
        and meta.get('importance') in {'high', 'medium'}
    ]


def slugify_geometry(profile: str) -> str:
    return profile.replace('_', '-')


def generate_manifest(effect: str, geometry_profile: str, target_model: dict, template_path: Path, out_path: Path) -> str:
    manifest = load_json(template_path)
    generated = deepcopy(manifest)
    fixture = generated.setdefault('fixture', {})
    fixture['sequencePath'] = '/Users/robterry/Projects/xLightsDesigner/render-training/RenderTraining-AnimationFixture.xsq'
    fixture['modelName'] = target_model['modelName']
    fixture['modelType'] = target_model['modelType']
    fixture['notes'] = f"Auto-generated Stage 1 coverage base manifest for {effect} on {target_model['modelName']} ({geometry_profile})."

    effect_slug = effect.lower().replace(' ', '')
    model_slug = target_model['modelName'].lower()
    pack_id = f"{effect_slug}-{model_slug}-stage1-coverage-v1"
    generated['packId'] = pack_id
    generated['description'] = f"Auto-generated Stage 1 coverage base manifest for {effect} on {target_model['modelName']} in the canonical render-training layout."

    expanded_samples = []
    for idx, sample in enumerate(generated.get('samples', []), start=1):
        effect_name = sample.get('effectName', effect)
        base_hints = list(sample.get('labelHints', []))
        base_shared = deepcopy(sample.get('sharedSettings', {}))
        for variant in PALETTE_VARIANTS:
            variant_sample = deepcopy(sample)
            variant_sample['effectName'] = effect_name
            variant_sample['sampleId'] = f"{effect_slug}-{slugify_geometry(geometry_profile)}-{variant['suffix']}-{idx:02d}-v1"
            variant_sample['sharedSettings'] = {
                **base_shared,
                'paletteProfile': variant['profile'],
                'palette': deepcopy(DEFAULT_XLIGHTS_PALETTE),
                'paletteActivationMode': variant['activationMode'],
                'paletteActiveSlots': list(variant['activeSlots']),
            }
            variant_sample['export'] = {
                'mode': 'model_with_render',
                'format': 'gif',
            }
            hints = list(base_hints)
            hints.extend(['stage1_coverage', geometry_profile, 'autogenerated', *variant['labelHints']])
            variant_sample['labelHints'] = sorted(set(hints))
            expanded_samples.append(variant_sample)
    generated['samples'] = expanded_samples

    out_path.write_text(json.dumps(generated, indent=2) + '\n', encoding='utf-8')
    return str(out_path)


def main() -> int:
    args = parse_args()
    backlog = load_json(args.backlog)
    catalog = load_json(args.catalog)
    registry = load_json(args.registry)
    completed_keys = load_completed_keys(args.completed_ledger)
    out_manifest_dir = Path(args.out_manifest_dir)
    out_manifest_dir.mkdir(parents=True, exist_ok=True)

    ordered_items = backlog.get('items') or backlog.get('recommendedHour1', [])
    filtered_items = [
        item for item in ordered_items
        if (item['effect'], item['geometryProfile'], item['coverageType']) not in completed_keys
    ]
    target_items = filtered_items[: args.limit]
    target_by_profile = canonical_model_maps(catalog)
    grouped = {}
    for item in target_items:
        key = (item['effect'], item['geometryProfile'], item['coverageType'])
        grouped.setdefault(key, item)

    plans = []
    summary_rows = []
    for (effect, geometry_profile, coverage_type), item in grouped.items():
        target_model = target_by_profile[geometry_profile]
        parameters = choose_parameters(effect, coverage_type, registry)
        if not parameters:
            continue

        source = 'generated'
        template_path = EFFECT_TEMPLATE_MANIFESTS[effect]
        manifest_path = str(out_manifest_dir / f"{effect.lower().replace(' ', '')}-{geometry_profile}-stage1-base.json")
        generate_manifest(effect, geometry_profile, target_model, Path(template_path), Path(manifest_path))

        plan_id = f"stage1-{effect.lower().replace(' ', '')}-{slugify_geometry(geometry_profile)}"
        plans.append({
            'planId': plan_id,
            'effect': effect,
            'geometryProfile': geometry_profile,
            'baseManifest': manifest_path,
            'parameters': parameters,
        })
        summary_rows.append({
            'planId': plan_id,
            'effect': effect,
            'geometryProfile': geometry_profile,
            'coverageType': coverage_type,
            'priority': item['priority'],
            'recommendedDepth': item['recommendedDepth'],
            'baseManifest': manifest_path,
            'templateSource': template_path,
            'manifestSource': source,
            'parameters': parameters,
        })

    plan = {
        'version': '1.0',
        'description': 'Generated Stage 1 full-coverage round from the ordered backlog.',
        'plans': plans,
    }
    Path(args.out_plan).write_text(json.dumps(plan, indent=2) + '\n', encoding='utf-8')

    if args.summary_out:
        summary = {
            'version': '1.0',
            'description': 'Summary of generated Stage 1 coverage plans.',
            'backlogSource': args.backlog,
            'completedLedger': args.completed_ledger,
            'requestedItemLimit': args.limit,
            'selectedPlanCount': len(plans),
            'plans': summary_rows,
        }
        Path(args.summary_out).write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
