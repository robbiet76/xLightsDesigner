#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import time
import typing
import difflib
from pathlib import Path
from typing import Any, Dict, List, Tuple


AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".flac"}
ROOT = Path(__file__).resolve().parents[3]
SERVICE_MAIN = ROOT / "apps" / "xlightsdesigner-analysis-service" / "main.py"


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Probe LyricsGenius corpus match rate.")
    ap.add_argument("--folder", required=True, help="Folder of audio files")
    ap.add_argument("--out", required=True, help="Output JSON report path")
    ap.add_argument("--sleep-seconds", type=float, default=0.75, help="Delay between Genius requests")
    ap.add_argument("--exclude", action="append", default=[], help="Exact filename to exclude; may be repeated")
    return ap.parse_args()


def load_service_module():
    spec = importlib.util.spec_from_file_location("analysis_service_main", SERVICE_MAIN)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def normalize_name(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip()).lower()


def list_tracks(folder: Path, excludes: List[str]) -> List[Path]:
    excluded = {normalize_name(name) for name in excludes if str(name).strip()}
    rows = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTS]
    return [p for p in sorted(rows, key=lambda x: x.name.lower()) if normalize_name(p.name) not in excluded]


def strip_numeric_prefix(name: str) -> str:
    value = re.sub(r"^\s*\d+\s*-\s*", "", name)
    value = re.sub(r"^\s*\d+\s+", "", value)
    return value.strip()


def infer_query_from_filename(track_name: str) -> Tuple[str, str, str]:
    stem = Path(track_name).stem.strip()
    base = strip_numeric_prefix(stem)
    base = re.sub(r"\b\d{4}\b", " ", base, flags=re.IGNORECASE)
    base = re.sub(r"\bMp3 Song\b", " ", base, flags=re.IGNORECASE)
    base = re.sub(r"\bSpotify Singles?\b", " ", base, flags=re.IGNORECASE)
    base = re.sub(r"\[(.*?)\]", " ", base)
    base = re.sub(r"\((?:single|edit|live|version|mix)\)", " ", base, flags=re.IGNORECASE)
    base = re.sub(r"\s+", " ", base).strip()
    artist = ""
    title = base
    source = "filename"
    if " - " in base:
        left, right = base.split(" - ", 1)
        left = left.strip()
        right = right.strip()
        if left and right:
            if any(token in left.lower() for token in ("christmas vacation",)):
                artist = right
                title = left
                source = "filename-title-artist-swapped"
            else:
                artist = left
                title = right
            source = "filename-artist-title"
    return title, artist, source


def normalize_compare_text(text: str) -> str:
    value = str(text or "").lower().strip()
    value = re.sub(r"\[(.*?)\]", " ", value)
    value = re.sub(r"\((.*?)\)", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\b(single|edit|mix|version|live|feat|featuring|spotify|mp3|song|main|intro)\b", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def classify_match_quality(result: Dict[str, Any]) -> Tuple[str, float, bool]:
    query_title = normalize_compare_text(result.get("queryTitle", ""))
    matched_title = normalize_compare_text(result.get("matchedTitle", ""))
    query_artist = normalize_compare_text(result.get("queryArtist", ""))
    matched_artist = normalize_compare_text(result.get("matchedArtist", ""))
    title_ratio = difflib.SequenceMatcher(None, query_title, matched_title).ratio() if query_title and matched_title else 0.0
    artist_ok = (not query_artist) or query_artist == matched_artist or query_artist in matched_artist or matched_artist in query_artist
    quality = "high" if title_ratio >= 0.82 and artist_ok else ("medium" if title_ratio >= 0.65 else "low")
    return quality, title_ratio, artist_ok


def best_identity_for_track(mod: Any, track_path: Path) -> Dict[str, Any]:
    fp = mod._audio_fingerprint(str(track_path))
    ident = mod._identity_cache_get(fp) or {}
    if isinstance(ident, dict) and ident.get("title") and ident.get("artist"):
        return ident
    return {}


def probe_track(genius: Any, mod: Any, track_path: Path) -> Dict[str, Any]:
    ident = best_identity_for_track(mod, track_path)
    if ident:
        title = str(ident.get("title") or "").strip()
        artist = str(ident.get("artist") or "").strip()
        query_source = "identity-cache"
    else:
        title, artist, query_source = infer_query_from_filename(track_path.name)
    result: Dict[str, Any] = {
        "track": track_path.name,
        "queryTitle": title,
        "queryArtist": artist,
        "querySource": query_source,
        "matched": False,
        "lyricsLength": 0,
    }
    try:
        song = genius.search_song(title=title, artist=artist or None)
    except Exception as err:
        result["error"] = str(err)
        return result
    if not song:
        return result
    lyrics = str(getattr(song, "lyrics", "") or "").strip()
    quality = "none"
    title_ratio = 0.0
    artist_ok = False
    if lyrics:
        preview = {
            **result,
            "matchedTitle": str(getattr(song, "title", "") or "").strip(),
            "matchedArtist": str(getattr(song, "artist", "") or "").strip(),
        }
        quality, title_ratio, artist_ok = classify_match_quality(preview)
    result.update(
        {
            "matched": bool(lyrics),
            "lyricsLength": len(lyrics),
            "matchedTitle": str(getattr(song, "title", "") or "").strip(),
            "matchedArtist": str(getattr(song, "artist", "") or "").strip(),
            "geniusId": getattr(song, "id", None),
            "url": str(getattr(song, "url", "") or "").strip(),
            "matchQuality": quality,
            "titleSimilarity": round(title_ratio, 3),
            "artistMatch": bool(artist_ok),
        }
    )
    return result


def main() -> int:
    args = parse_args()
    token = os.getenv("GENIUS_ACCESS_TOKEN", "").strip()
    if not token:
        raise SystemExit("GENIUS_ACCESS_TOKEN is required")

    mod = load_service_module()
    if not hasattr(typing, "Self"):
        try:
            from typing_extensions import Self as _Self  # type: ignore
            typing.Self = _Self  # type: ignore[attr-defined]
        except Exception:
            pass
    lyricsgenius = __import__("lyricsgenius")
    genius = lyricsgenius.Genius(
        token,
        timeout=15,
        retries=1,
        sleep_time=0.2,
        remove_section_headers=True,
        skip_non_songs=True,
        excluded_terms=["(Remix)", "(Live)"],
        verbose=False,
    )

    folder = Path(args.folder).expanduser().resolve()
    tracks = list_tracks(folder, args.exclude)
    rows: List[Dict[str, Any]] = []
    for idx, track in enumerate(tracks, start=1):
        row = probe_track(genius, mod, track)
        row["index"] = idx
        rows.append(row)
        if idx < len(tracks):
            time.sleep(max(0.0, float(args.sleep_seconds or 0.0)))

    matched = [r for r in rows if r.get("matched")]
    high = [r for r in matched if r.get("matchQuality") == "high"]
    report = {
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "folder": str(folder),
        "trackCount": len(tracks),
        "matchedCount": len(matched),
        "matchRate": round(len(matched) / len(tracks), 4) if tracks else 0.0,
        "highConfidenceMatchedCount": len(high),
        "highConfidenceMatchRate": round(len(high) / len(tracks), 4) if tracks else 0.0,
        "rows": rows,
    }
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["trackCount", "matchedCount", "matchRate", "highConfidenceMatchedCount", "highConfidenceMatchRate"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
