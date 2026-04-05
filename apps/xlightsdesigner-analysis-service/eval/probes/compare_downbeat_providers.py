#!/usr/bin/env python3
import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main  # noqa: E402


def median_ms(values: List[int]) -> float:
    if not values:
        return 0.0
    return float(statistics.median(values))


def sanitize_marks(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return main._sanitize_marks(rows or [])


def estimate_bpm_from_beats(beats: List[Dict[str, Any]]) -> float:
    if len(beats) < 2:
        return 0.0
    starts = [int(row["startMs"]) for row in beats]
    diffs = [b - a for a, b in zip(starts, starts[1:]) if b > a]
    med = median_ms(diffs)
    return round(60000.0 / med, 2) if med > 0 else 0.0


def time_signature_from_beats(beats: List[Dict[str, Any]]) -> str:
    labels = [str(row.get("label", "")).strip() for row in beats if str(row.get("label", "")).strip()]
    nums = []
    for label in labels:
        try:
            nums.append(int(label))
        except Exception:
            continue
    beats_per_bar = max(nums) if nums else 0
    return f"{beats_per_bar}/4" if beats_per_bar > 0 else "unknown"


def summarize_provider(name: str, beats: List[Dict[str, Any]], bars: List[Dict[str, Any]], meta: Dict[str, Any] | None = None) -> Dict[str, Any]:
    meta = meta or {}
    return {
        "provider": name,
        "bpm": estimate_bpm_from_beats(beats),
        "timeSignature": str(meta.get("timeSignature") or time_signature_from_beats(beats)),
        "beatsPerBar": int(meta.get("beatsPerBar") or (int(time_signature_from_beats(beats).split("/")[0]) if "/" in time_signature_from_beats(beats) else 0)),
        "beatCount": len(beats),
        "barCount": len(bars),
        "downbeatCount": len([row for row in beats if str(row.get("label", "")).strip() == "1"]),
        "medianBeatMs": round(median_ms([int(b["startMs"]) - int(a["startMs"]) for a, b in zip(beats, beats[1:]) if int(b["startMs"]) > int(a["startMs"])]), 2),
    }


def analyze_service(provider: str, path: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    data = main._analyze(path.as_posix(), provider)
    beats = sanitize_marks(data.get("beats") or [])
    bars = sanitize_marks(data.get("bars") or [])
    meta = dict(data.get("meta") or {})
    meta["timeSignature"] = data.get("timeSignature") or meta.get("timeSignature")
    return beats, bars, meta


def analyze_madmom_downbeats(path: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    main._ensure_librosa()
    main._ensure_madmom_chords()
    from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor  # type: ignore
    from madmom.audio.signal import Signal  # type: ignore

    y, sr = main.librosa.load(path.as_posix(), sr=22050, mono=True)
    duration_ms = int(round((len(y) / float(sr)) * 1000))
    signal = Signal(y.astype("float32"), sample_rate=sr, num_channels=1)
    activations = RNNDownBeatProcessor()(signal)
    tracker = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)
    result = tracker(activations)

    beat_starts_ms: List[int] = []
    downbeat_starts: List[int] = []
    beat_flags: List[int] = []
    for row in result:
        try:
            t = float(row[0])
            beat_num = int(round(float(row[1])))
        except Exception:
            continue
        ms = int(round(t * 1000.0))
        if 0 <= ms < duration_ms:
            beat_starts_ms.append(ms)
            beat_flags.append(beat_num)
            if beat_num == 1:
                downbeat_starts.append(ms)

    beat_starts_ms = sorted(set(beat_starts_ms))
    detected_bpb = 4
    if beat_flags:
        detected_bpb = max(1, max(beat_flags))

    beats = []
    for i, start in enumerate(beat_starts_ms):
        if i + 1 < len(beat_starts_ms):
            end = int(beat_starts_ms[i + 1])
        else:
            step = int(round(median_ms([b - a for a, b in zip(beat_starts_ms, beat_starts_ms[1:]) if b > a]) or 500))
            end = min(duration_ms, start + max(1, step))
        beats.append({"startMs": start, "endMs": max(start + 1, end)})
    beats = main._label_beats_from_downbeats(beats, downbeat_starts, detected_bpb)
    beats = sanitize_marks(beats)
    bars = main._derive_bars_from_labeled_beats(beats, duration_ms, detected_bpb)
    bars = sanitize_marks(bars)
    return beats, bars, {"beatsPerBar": detected_bpb, "timeSignature": f"{detected_bpb}/4"}


def provider_available(provider: str) -> bool:
    try:
        if provider == "beatnet":
            return main._ensure_beatnet() is not None
        if provider == "librosa":
            return main._ensure_librosa() is not None
    except Exception:
        return False
    return False


def main_cli() -> int:
    ap = argparse.ArgumentParser(description="Compare beat/downbeat providers on local audio files.")
    ap.add_argument("audio", nargs="+", help="Audio files to analyze")
    ap.add_argument("--out", default="", help="Optional JSON report path")
    args = ap.parse_args()

    reports = []
    for raw in args.audio:
        path = Path(raw).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(path)
        row: Dict[str, Any] = {"audioPath": str(path), "file": path.name}
        for provider in ("librosa", "beatnet"):
            if not provider_available(provider):
                row[provider] = {"provider": provider, "available": False}
                continue
            try:
                beats, bars, meta = analyze_service(provider, path)
                rep = summarize_provider(provider, beats, bars, meta)
                rep["available"] = True
                row[provider] = rep
            except HTTPException as err:
                row[provider] = {"provider": provider, "available": False, "error": str(err.detail)}
        try:
            beats, bars, meta = analyze_madmom_downbeats(path)
            rep = summarize_provider("madmom_downbeat", beats, bars, meta)
            rep["available"] = True
            row["madmom_downbeat"] = rep
        except Exception as err:
            row["madmom_downbeat"] = {"provider": "madmom_downbeat", "available": False, "error": str(err)}
        reports.append(row)

    out = {"reports": reports}
    text = json.dumps(out, indent=2)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main_cli())
