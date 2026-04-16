#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYSIS_DIR = ROOT / 'analysis'
import sys
sys.path.insert(0, str(ANALYSIS_DIR))

from framework import SequenceAnalysisInput, get_analyzer  # type: ignore


def iter_records(root: Path):
    yield from root.rglob('*.record.json')


def reanalyze_record(path: Path) -> bool:
    record = json.loads(path.read_text())
    features = record.get('features') or {}
    model_metadata = record.get('modelMetadata') or {}
    effect_settings = record.get('effectSettings') or {}
    shared_settings = record.get('sharedSettings') or {}
    effect_name = record.get('effectName') or ''

    resolved_model_type = model_metadata.get('resolvedModelType') or record.get('fixture', {}).get('modelType') or 'unknown'
    resolved_geometry_profile = model_metadata.get('resolvedGeometryProfile') or record.get('fixture', {}).get('geometryProfile') or resolved_model_type

    inp = SequenceAnalysisInput(
        model_type=resolved_geometry_profile,
        decoded_window=features,
        model_metadata=model_metadata,
        effect_name=effect_name,
        effect_settings=effect_settings,
        shared_settings=shared_settings,
    )
    result = get_analyzer(resolved_geometry_profile).analyze(inp)
    result['analysisVersion'] = '1.0'
    result['modelType'] = resolved_model_type
    result['geometryProfile'] = resolved_geometry_profile
    expected_model_type = record.get('fixture', {}).get('expectedModelType')
    if expected_model_type:
        result['expectedModelType'] = expected_model_type
    result['effectName'] = effect_name

    changed = record.get('analysis') != result
    record['analysis'] = result
    if isinstance(record.get('features'), dict):
        record['features']['analysis'] = result
    path.write_text(json.dumps(record, indent=2) + '\n')
    return changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('root')
    args = parser.parse_args()
    root = Path(args.root)
    total = 0
    changed = 0
    for path in iter_records(root):
        total += 1
        if reanalyze_record(path):
            changed += 1
    print(json.dumps({'root': str(root), 'recordCount': total, 'changedCount': changed}, indent=2))


if __name__ == '__main__':
    main()
