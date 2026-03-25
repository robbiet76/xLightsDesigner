#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

AUDIO_EXTS = {'.mp3', '.wav', '.m4a', '.flac'}
ROOT = Path(__file__).resolve().parents[3]
SERVICE_DIR = ROOT / 'apps' / 'xlightsdesigner-analysis-service'
MAIN_PY = SERVICE_DIR / 'main.py'
SERVICE_PYTHON = SERVICE_DIR / '.venv310' / 'bin' / 'python'


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description='Run progressive audio analysis benchmark with incremental outputs and source-aware reruns.')
    ap.add_argument('--folder', required=True, help='Folder of audio files')
    ap.add_argument('--out-dir', required=True, help='Output directory for manifest/results/summary')
    ap.add_argument('--mode', choices=['fast', 'deep', 'both'], default='both')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--shuffle', action='store_true')
    ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--max-tracks', type=int, default=0)
    ap.add_argument('--max-seconds-per-mode', type=float, default=0.0)
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--loop', action='store_true', help='Continuously rescan for new tracks or new source revision')
    ap.add_argument('--sleep-seconds', type=float, default=15.0, help='Pause between loop cycles')
    ap.add_argument('--min-seconds-between-tracks', type=float, default=1.5, help='Minimum delay between completed track analyses')
    ap.add_argument('--min-seconds-between-deep-tracks', type=float, default=12.0, help='Minimum delay between completed deep analyses to avoid overusing external APIs')
    ap.add_argument('--retry-backoff-seconds', type=float, default=60.0, help='Delay before retrying a failed track on the same source revision')
    return ap.parse_args()


def list_tracks(folder: Path) -> List[Path]:
    rows = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTS]
    return sorted(rows, key=lambda p: p.name.lower())


def load_existing_results(results_path: Path) -> List[Dict[str, Any]]:
    if not results_path.exists():
        return []
    rows: List[Dict[str, Any]] = []
    for line in results_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def append_jsonl(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as fh:
        fh.write(json.dumps(payload) + '\n')


def current_source_revision() -> str:
    try:
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip() or 'unknown'
    except Exception:
        return 'unknown'


def select_python_executable() -> str:
    if SERVICE_PYTHON.exists():
        return str(SERVICE_PYTHON)
    return sys.executable


def latest_result_map(results: List[Dict[str, Any]]) -> Dict[Tuple[str, str], Dict[str, Any]]:
    mapping: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for row in results:
        key = (str(row.get('track') or ''), str(row.get('mode') or ''))
        mapping[key] = row
    return mapping


def summarize(results: List[Dict[str, Any]], manifest: Dict[str, Any]) -> Dict[str, Any]:
    summary: Dict[str, Any] = {
        'createdAt': manifest.get('createdAt'),
        'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'folder': manifest.get('folder'),
        'mode': manifest.get('mode'),
        'sourceRevision': manifest.get('sourceRevision'),
        'trackOrder': manifest.get('trackOrder', []),
        'counts': {},
        'profiles': {},
    }
    profiles = ['fast', 'deep'] if manifest.get('mode') == 'both' else [manifest.get('mode')]
    for mode in profiles:
        rows = [r for r in results if r.get('mode') == mode]
        ok_rows = [r for r in rows if r.get('ok')]
        total_seconds = sum(float(r.get('seconds') or 0.0) for r in rows)
        summary['profiles'][mode] = {
            'completedTracks': len(rows),
            'successfulTracks': len(ok_rows),
            'failedTracks': len(rows) - len(ok_rows),
            'totalSeconds': round(total_seconds, 3),
            'avgSecondsPerTrack': round(total_seconds / len(rows), 3) if rows else None,
            'slowestTrack': max(ok_rows, key=lambda r: float(r.get('seconds') or 0.0), default=None),
        }
    summary['counts']['totalResults'] = len(results)
    return summary


def build_child_code() -> str:
    return r'''
import json, sys, time
from pathlib import Path
root = Path(sys.argv[1])
service_dir = Path(sys.argv[2])
track_path = Path(sys.argv[3])
mode = sys.argv[4]
sys.path.insert(0, str(service_dir))
import main
profile = main._normalize_analysis_profile(mode)
if mode == 'deep':
    profile['enableRemoteIdentity'] = True
    profile['enableLyrics'] = True
    profile['enableWebTempo'] = True
    profile['enableMadmomChords'] = True
    profile['enableMadmomDownbeatCrosscheck'] = True
started = time.time()
data = main._analyze_with_librosa(str(track_path), profile)
seconds = time.time() - started
meta = data.get('meta') or {}
print(json.dumps({
    'track': track_path.name,
    'mode': mode,
    'ok': True,
    'seconds': round(seconds, 3),
    'timeSignature': data.get('timeSignature'),
    'sectionSource': meta.get('sectionSource'),
    'lyricsSource': meta.get('lyricsSource'),
    'lyricsCount': len(data.get('lyrics') or []),
    'sectionCount': len(data.get('sections') or []),
}))
'''


def analyze_track_fresh(track: Path, mode: str, source_revision: str) -> Dict[str, Any]:
    cmd = [
        select_python_executable(),
        '-c',
        build_child_code(),
        str(ROOT),
        str(SERVICE_DIR),
        str(track),
        mode,
    ]
    started = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), check=True)
        payload = json.loads(proc.stdout.strip()) if proc.stdout.strip() else {}
        payload['sourceRevision'] = source_revision
        return payload
    except Exception as err:
        stderr = ''
        if hasattr(err, 'stderr') and getattr(err, 'stderr', None):
            stderr = str(err.stderr).strip()
        return {
            'track': track.name,
            'mode': mode,
            'ok': False,
            'seconds': round(time.time() - started, 3),
            'error': stderr or str(err),
            'sourceRevision': source_revision,
        }


def should_run_track(
    track_name: str,
    mode: str,
    latest_rows: Dict[Tuple[str, str], Dict[str, Any]],
    source_revision: str,
    retry_backoff_seconds: float,
) -> bool:
    row = latest_rows.get((track_name, mode))
    if not row:
        return True
    if str(row.get('sourceRevision') or '') != source_revision:
        return True
    if row.get('ok') is True:
        return False
    completed_at = str(row.get('completedAt') or '').strip()
    if not completed_at:
        return True
    try:
        completed_epoch = float(completed_at)
    except Exception:
        return True
    age = time.time() - completed_epoch
    return age >= max(0.0, float(retry_backoff_seconds or 0.0))


def maybe_sleep_after_track(mode: str, args: argparse.Namespace) -> None:
    base_delay = max(0.0, float(args.min_seconds_between_tracks or 0.0))
    deep_delay = max(0.0, float(args.min_seconds_between_deep_tracks or 0.0))
    required_delay = base_delay
    if mode == 'deep':
        required_delay = max(required_delay, deep_delay)
    if required_delay > 0:
        time.sleep(required_delay)
    return False


def build_track_order(folder: Path, limit: int, shuffle: bool, seed: int | None) -> Tuple[List[Path], int | None]:
    tracks = list_tracks(folder)
    if limit > 0:
        tracks = tracks[:limit]
    applied_seed = seed
    if shuffle:
        applied_seed = int(seed if seed is not None else time.time())
        rng = random.Random(applied_seed)
        rng.shuffle(tracks)
    return tracks, applied_seed


def run_cycle(args: argparse.Namespace, results_path: Path, summary_path: Path, manifest_path: Path, existing_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    folder = Path(args.folder).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    tracks, applied_seed = build_track_order(folder, args.limit, args.shuffle, args.seed)
    source_revision = current_source_revision()
    manifest = {
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'folder': str(folder),
        'mode': args.mode,
        'shuffle': bool(args.shuffle),
        'seed': applied_seed,
        'sourceRevision': source_revision,
        'pythonExecutable': select_python_executable(),
        'trackOrder': [p.name for p in tracks],
        'loop': bool(args.loop),
        'minSecondsBetweenTracks': float(args.min_seconds_between_tracks or 0.0),
        'minSecondsBetweenDeepTracks': float(args.min_seconds_between_deep_tracks or 0.0),
        'retryBackoffSeconds': float(args.retry_backoff_seconds or 0.0),
    }
    write_json(manifest_path, manifest)

    latest_rows = latest_result_map(existing_results)
    modes = ['fast', 'deep'] if args.mode == 'both' else [args.mode]
    for mode in modes:
        mode_started = time.time()
        mode_count = 0
        for track in tracks:
            if not should_run_track(track.name, mode, latest_rows, source_revision, args.retry_backoff_seconds):
                continue
            if args.max_tracks and mode_count >= args.max_tracks:
                break
            if args.max_seconds_per_mode and (time.time() - mode_started) >= args.max_seconds_per_mode:
                break
            row = analyze_track_fresh(track, mode, source_revision)
            row['completedAt'] = round(time.time(), 3)
            append_jsonl(results_path, row)
            existing_results.append(row)
            latest_rows[(track.name, mode)] = row
            mode_count += 1
            write_json(summary_path, summarize(existing_results, manifest))
            print(json.dumps(row), flush=True)
            maybe_sleep_after_track(mode, args)
    write_json(summary_path, summarize(existing_results, manifest))
    return existing_results


def main_cli() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    results_path = out_dir / 'results.jsonl'
    summary_path = out_dir / 'summary.json'
    manifest_path = out_dir / 'manifest.json'
    results = load_existing_results(results_path) if args.resume else []
    while True:
        results = run_cycle(args, results_path, summary_path, manifest_path, results)
        if not args.loop:
            break
        time.sleep(max(1.0, float(args.sleep_seconds or 15.0)))
    return 0


if __name__ == '__main__':
    raise SystemExit(main_cli())
