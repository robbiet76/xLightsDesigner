#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict, List


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

def summarize_alignment(genius_lines: List[str], aligned_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    aligned_count = sum(int(row.get("sourceLineCount") or 0) for row in aligned_rows)
    aligned_phrase_count = len(aligned_rows)
    line_count = len(genius_lines)
    avg_score = sum(float(row.get("score") or 0.0) for row in aligned_rows) / aligned_count if aligned_count else 0.0
    coverage = aligned_count / line_count if line_count else 0.0
    return {
        "geniusLineCount": line_count,
        "alignedLineCount": aligned_count,
        "alignedPhraseCount": aligned_phrase_count,
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
        beat_starts_ms: List[int] = []
        bar_starts_ms: List[int] = []
        section_segments: List[Dict[str, Any]] = []
        if identity:
            timed_marks, _, _ = mod._fetch_lrclib_lyrics_direct(identity, 300000, {"enableLyrics": True})
        analysis = mod._analyze_with_librosa(str(track_path), mod._normalize_analysis_profile("fast"), {})
        beat_starts_ms = [int(row.get("startMs", 0)) for row in (analysis.get("beats") or [])]
        bar_starts_ms = [int(row.get("startMs", 0)) for row in (analysis.get("bars") or [])]
        section_segments = list((((analysis.get("meta") or {}).get("structureBackbone") or {}).get("segments") or []))
        aligned_rows = mod._align_plain_lyrics_to_timed_phrases(
            genius_lines,
            timed_marks,
            beat_starts_ms=beat_starts_ms,
            bar_starts_ms=bar_starts_ms,
            section_segments=section_segments,
            min_score=float(args.min_score),
        )
        out_tracks.append(
            {
                "track": track,
                "geniusMatched": bool(genius_row.get("matched")),
                "geniusMatchQuality": str(genius_row.get("matchQuality") or ""),
                "beatCount": len(beat_starts_ms),
                "barCount": len(bar_starts_ms),
                "sectionBoundaryCount": len(section_segments),
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
