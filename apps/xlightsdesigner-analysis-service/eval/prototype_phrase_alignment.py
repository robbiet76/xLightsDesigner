#!/usr/bin/env python3
from __future__ import annotations

import argparse
import difflib
import importlib.util
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple


ROOT = Path(__file__).resolve().parents[3]
SERVICE_MAIN = ROOT / "apps" / "xlightsdesigner-analysis-service" / "main.py"


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Prototype phrase alignment from plain Genius lines to timed LRCLIB lines.")
    ap.add_argument("--genius-report", required=True, help="Path to Genius report JSON with lyricsText/lyricsLines")
    ap.add_argument("--audio-folder", required=True, help="Folder containing the audio files")
    ap.add_argument("--tracks", nargs="+", required=True, help="Track filenames to align")
    ap.add_argument("--out", required=True, help="Output JSON report path")
    ap.add_argument("--min-score", type=float, default=0.72, help="Minimum text similarity score to accept a line alignment")
    return ap.parse_args()


def load_service_module():
    spec = importlib.util.spec_from_file_location("analysis_service_main", SERVICE_MAIN)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def normalize_text(text: str) -> str:
    value = str(text or "").lower()
    value = re.sub(r"\[[^\]]*\]", " ", value)
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\b\d*embed\b", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def greedy_align_lines(genius_lines: List[str], timed_marks: List[Dict[str, Any]], min_score: float) -> List[Dict[str, Any]]:
    aligned: List[Dict[str, Any]] = []
    timed_norm = [normalize_text(row.get("label", "")) for row in timed_marks]
    search_start = 0
    for genius_line in genius_lines:
        gnorm = normalize_text(genius_line)
        if not gnorm:
            continue
        best_idx = -1
        best_score = 0.0
        for idx in range(search_start, len(timed_marks)):
            tnorm = timed_norm[idx]
            if not tnorm:
                continue
            score = difflib.SequenceMatcher(None, gnorm, tnorm).ratio()
            if gnorm in tnorm or tnorm in gnorm:
                score = max(score, 0.9)
            if score > best_score:
                best_score = score
                best_idx = idx
        if best_idx >= 0 and best_score >= min_score:
            row = timed_marks[best_idx]
            aligned.append(
                {
                    "text": genius_line,
                    "normalizedText": gnorm,
                    "matchedTimedText": str(row.get("label", "")),
                    "score": round(best_score, 4),
                    "startMs": int(row.get("startMs", 0)),
                    "endMs": int(row.get("endMs", 0)),
                }
            )
            search_start = best_idx + 1
    return aligned


def summarize_alignment(genius_lines: List[str], aligned_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    aligned_count = len(aligned_rows)
    line_count = len(genius_lines)
    avg_score = sum(float(row.get("score") or 0.0) for row in aligned_rows) / aligned_count if aligned_count else 0.0
    coverage = aligned_count / line_count if line_count else 0.0
    return {
        "geniusLineCount": line_count,
        "alignedLineCount": aligned_count,
        "coverage": round(coverage, 4),
        "averageScore": round(avg_score, 4),
    }


def main() -> int:
    args = parse_args()
    mod = load_service_module()
    genius_report = json.loads(Path(args.genius_report).expanduser().resolve().read_text())
    genius_by_track = {str(row.get("track") or ""): row for row in genius_report.get("rows", [])}
    folder = Path(args.audio_folder).expanduser().resolve()
    out_tracks: List[Dict[str, Any]] = []

    for track in args.tracks:
        track_path = folder / track
        genius_row = genius_by_track.get(track, {})
        genius_lines = [str(row).strip() for row in genius_row.get("lyricsLines", []) if str(row).strip()]
        fp = mod._audio_fingerprint(str(track_path))
        identity = mod._identity_cache_get(fp) or {}
        timed_marks: List[Dict[str, Any]] = []
        if identity:
            timed_marks, _, _ = mod._fetch_lrclib_lyrics(identity, 300000, {"enableLyrics": True})
        aligned_rows = greedy_align_lines(genius_lines, timed_marks, float(args.min_score))
        out_tracks.append(
            {
                "track": track,
                "geniusMatched": bool(genius_row.get("matched")),
                "geniusMatchQuality": str(genius_row.get("matchQuality") or ""),
                "summary": summarize_alignment(genius_lines, aligned_rows),
                "alignedRows": aligned_rows[:80],
            }
        )

    report = {
        "tracks": out_tracks,
        "summary": {
            "trackCount": len(out_tracks),
            "tracksWithAnyAlignment": len([row for row in out_tracks if int(row.get("summary", {}).get("alignedLineCount") or 0) > 0]),
            "averageCoverage": round(
                sum(float(row.get("summary", {}).get("coverage") or 0.0) for row in out_tracks) / len(out_tracks),
                4,
            ) if out_tracks else 0.0,
        },
    }
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
