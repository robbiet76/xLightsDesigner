#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import re
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parents[3]
SERVICE_MAIN = ROOT / "apps" / "xlightsdesigner-analysis-service" / "main.py"


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Compare LRCLIB timed lyrics with LyricsGenius plain lyrics.")
    ap.add_argument("--genius-report", required=True, help="Path to Genius corpus probe report JSON")
    ap.add_argument("--audio-folder", required=True, help="Folder containing the audio files")
    ap.add_argument("--tracks", nargs="+", required=True, help="Track filenames to compare")
    ap.add_argument("--out", required=True, help="Output JSON report path")
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
    value = re.sub(r"\s+", " ", value).strip()
    return value


def normalize_line(text: str) -> str:
    value = normalize_text(text)
    # Genius often appends an "embed" footer token on scraped lyrics pages.
    value = re.sub(r"\b\d*embed\b", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def extract_genius_lines(raw_text: str) -> List[str]:
    text = str(raw_text or "").replace("\r\n", "\n").replace("\r", "\n")
    rows: List[str] = []
    for line in text.split("\n"):
        normalized = normalize_line(line)
        if not normalized:
            continue
        if normalized in {"lyrics"}:
            continue
        rows.append(normalized)
    return rows


def extract_lrclib_lines(marks: List[Dict[str, Any]]) -> List[str]:
    rows: List[str] = []
    for row in marks or []:
        normalized = normalize_line(row.get("label", ""))
        if normalized:
            rows.append(normalized)
    return rows


def line_overlap_metrics(left: List[str], right: List[str]) -> Dict[str, Any]:
    left_set = set(left)
    right_set = set(right)
    shared = sorted(left_set & right_set)
    precision = (len(shared) / len(right_set)) if right_set else 0.0
    recall = (len(shared) / len(left_set)) if left_set else 0.0
    return {
        "lrclibLineCount": len(left),
        "geniusLineCount": len(right),
        "sharedUniqueLineCount": len(shared),
        "sharedUniqueLines": shared[:20],
        "precision": round(precision, 4),
        "recall": round(recall, 4),
    }


def repeated_line_candidates(lines: List[str]) -> List[str]:
    counts: Dict[str, int] = {}
    for line in lines:
        counts[line] = counts.get(line, 0) + 1
    return sorted([line for line, count in counts.items() if count >= 2])


def compare_track(track: str, genius_row: Dict[str, Any], lrclib_marks: List[Dict[str, Any]]) -> Dict[str, Any]:
    lrclib_lines = extract_lrclib_lines(lrclib_marks)
    genius_lines = genius_row.get("lyricsLines")
    if not isinstance(genius_lines, list):
        genius_lines = extract_genius_lines(genius_row.get("lyricsText", ""))
    overlap = line_overlap_metrics(lrclib_lines, genius_lines)
    return {
        "track": track,
        "geniusMatched": bool(genius_row.get("matched")),
        "geniusMatchQuality": str(genius_row.get("matchQuality") or ""),
        "geniusMatchedArtist": str(genius_row.get("matchedArtist") or ""),
        "geniusMatchedTitle": str(genius_row.get("matchedTitle") or ""),
        "lrclibTimedLineCount": len(lrclib_lines),
        "geniusPlainLineCount": len(genius_lines),
        "overlap": overlap,
        "lrclibRepeatedLines": repeated_line_candidates(lrclib_lines)[:20],
        "geniusRepeatedLines": repeated_line_candidates(genius_lines)[:20],
    }


def main() -> int:
    args = parse_args()
    mod = load_service_module()
    genius_report = json.loads(Path(args.genius_report).expanduser().resolve().read_text())
    genius_by_track = {str(row.get("track") or ""): row for row in genius_report.get("rows", [])}
    folder = Path(args.audio_folder).expanduser().resolve()
    out_rows: List[Dict[str, Any]] = []

    for track in args.tracks:
        track_path = folder / track
        genius_row = genius_by_track.get(track, {})
        fp = mod._audio_fingerprint(str(track_path))
        identity = mod._identity_cache_get(fp) or {}
        lrclib_marks: List[Dict[str, Any]] = []
        if identity:
          lrclib_marks, _, _ = mod._fetch_lrclib_lyrics(identity, 300000, {"enableLyrics": True})
        out_rows.append(compare_track(track, genius_row, lrclib_marks))

    report = {
        "tracks": out_rows,
        "summary": {
            "trackCount": len(out_rows),
            "geniusMatchedCount": len([row for row in out_rows if row.get("geniusMatched")]),
            "highConfidenceGeniusCount": len([row for row in out_rows if row.get("geniusMatchQuality") == "high"]),
            "tracksWithTimedLyrics": len([row for row in out_rows if int(row.get("lrclibTimedLineCount") or 0) > 0]),
        },
    }
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
