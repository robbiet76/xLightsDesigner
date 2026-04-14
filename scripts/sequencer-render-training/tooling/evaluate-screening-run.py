#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text())


def distinct_count(values):
    return len({value for value in values if value is not None})


def rounded(value):
    if value is None:
        return None
    return round(float(value), 6)


def evaluate(summary_path: Path):
    summary = load_json(summary_path)
    records = []
    for row in summary.get('results', []):
        record_path = row.get('recordPath')
        if not record_path:
            continue
        record_file = Path(record_path)
        if not record_file.exists():
            continue
        records.append(load_json(record_file))

    features = [row.get('features', {}) for row in records]
    non_blank = [row for row in features if float(row.get('nonBlankSampledFrameRatio') or 0) > 0.05]
    distinct_hashes = distinct_count([row.get('sha256') for row in features])
    distinct_temporal_motion = distinct_count([rounded(row.get('temporalMotionMean')) for row in features])
    distinct_temporal_color = distinct_count([rounded(row.get('temporalColorDeltaMean')) for row in features])
    distinct_temporal_brightness = distinct_count([rounded(row.get('temporalBrightnessDeltaMean')) for row in features])
    distinct_rep_brightness = distinct_count([rounded(row.get('representativeSampledFrameAverageBrightness')) for row in features])
    variation_detected = any(count > 1 for count in [
        distinct_hashes,
        distinct_temporal_motion,
        distinct_temporal_color,
        distinct_temporal_brightness,
        distinct_rep_brightness,
    ])

    if not records:
        status = 'no_records'
    elif not non_blank:
        status = 'blank_or_near_blank'
    elif not variation_detected:
        status = 'collapsed_no_variation'
    else:
        status = 'differentiated'

    return {
        'sampleCount': len(records),
        'nonBlankSampleCount': len(non_blank),
        'distinctArtifactHashCount': distinct_hashes,
        'distinctTemporalMotionCount': distinct_temporal_motion,
        'distinctTemporalColorDeltaCount': distinct_temporal_color,
        'distinctTemporalBrightnessDeltaCount': distinct_temporal_brightness,
        'distinctRepresentativeBrightnessCount': distinct_rep_brightness,
        'variationDetected': variation_detected,
        'qualityStatus': status,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--summary', required=True)
    args = parser.parse_args()
    json.dump(evaluate(Path(args.summary)), sys.stdout, separators=(',', ':'))


if __name__ == '__main__':
    main()
