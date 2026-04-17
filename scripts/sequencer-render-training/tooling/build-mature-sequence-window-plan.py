#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

DECODER = Path('scripts/sequencer-render-training/tooling/fseq_window_decoder')

WINDOWS = [
    ('opening', 0.08),
    ('support', 0.28),
    ('peak', 0.52),
    ('transition', 0.74),
    ('closing', 0.92),
]


def read_fseq_summary(fseq_path: Path):
    cmd = [
        str(DECODER),
        '--fseq', str(fseq_path),
        '--start-channel', '0',
        '--channel-count', '1',
        '--window-start-ms', '0',
        '--window-end-ms', '100',
        '--node-count', '1',
        '--channels-per-node', '1',
        '--frame-mode', 'full',
    ]
    p = subprocess.run(cmd, capture_output=True, text=True, check=True)
    obj = json.loads(p.stdout)
    return {
        'frameCountTotal': int(obj['frameCountTotal']),
        'stepTimeMs': int(obj['stepTimeMs']),
        'durationMs': int(obj['frameCountTotal']) * int(obj['stepTimeMs']),
    }


def clamp(value, low, high):
    return max(low, min(high, value))


def build_windows(duration_ms: int):
    base = clamp(int(duration_ms * 0.08), 4000, 8000)
    plans = []
    for name, center_ratio in WINDOWS:
        if name == 'opening':
            start = 0
            end = min(duration_ms, base)
        elif name == 'closing':
            end = duration_ms
            start = max(0, duration_ms - base)
        else:
            center = int(duration_ms * center_ratio)
            start = max(0, center - base // 2)
            end = min(duration_ms, start + base)
            start = max(0, end - base)
        plans.append({
            'name': name,
            'startMs': start,
            'endMs': end,
            'durationMs': end - start,
            'centerRatio': center_ratio,
        })
    return plans


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sequence-name', required=True)
    parser.add_argument('--fseq', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    fseq_path = Path(args.fseq)
    summary = read_fseq_summary(fseq_path)
    artifact = {
        'artifactType': 'mature_sequence_window_plan_v1',
        'artifactVersion': 1,
        'sequenceName': args.sequence_name,
        'fseqPath': str(fseq_path),
        'durationMs': summary['durationMs'],
        'frameCountTotal': summary['frameCountTotal'],
        'stepTimeMs': summary['stepTimeMs'],
        'windows': build_windows(summary['durationMs']),
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(artifact, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': True, 'out': str(out), 'durationMs': artifact['durationMs']}, indent=2))


if __name__ == '__main__':
    main()
