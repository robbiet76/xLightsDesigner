#!/usr/bin/env python3
import argparse
import importlib.util
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def _load_main(module_path: Path):
    spec = importlib.util.spec_from_file_location("analysis_main", str(module_path))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load analysis service module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _track_paths(args: argparse.Namespace) -> List[Path]:
    rows: List[Path] = []
    if args.track:
        rows.extend(Path(v).expanduser() for v in args.track)
    if args.track_list:
        for line in Path(args.track_list).expanduser().read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if text:
                rows.append(Path(text).expanduser())
    if args.audio_dir:
        rows.extend(sorted(Path(args.audio_dir).expanduser().glob("*.mp3")))
    out: List[Path] = []
    seen = set()
    for row in rows:
        key = str(row.resolve()) if row.exists() else str(row)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def _duration_ms(path: Path) -> int:
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return int(round(float((proc.stdout or "0").strip()) * 1000.0))
    except Exception:
        return 0


def _artist_variants(module: Any, artist: str) -> List[str]:
    values: List[str] = []
    seen = set()

    def add(value: str) -> None:
        text = str(value or "").strip()
        if not text:
            return
        key = module._normalize_compare_text(text)
        if not key or key in seen:
            return
        seen.add(key)
        values.append(text)

    add(artist)
    cleaned = re.sub(r"\s*\([^)]*\)\s*", " ", artist or "").strip()
    add(cleaned)
    primary = re.split(r"\s*(?:;|/|,| feat\. | featuring | w/ | with | & )\s*", cleaned, maxsplit=1, flags=re.I)[0]
    add(primary)
    return values


def _title_variants(module: Any, title: str) -> List[str]:
    values: List[str] = []
    seen = set()

    def add(value: str) -> None:
        text = str(value or "").strip()
        if not text:
            return
        key = module._normalize_compare_text(text)
        if not key or key in seen:
            return
        seen.add(key)
        values.append(text)

    for variant in module._genius_retry_title_variants(title):
        add(variant)
    add(re.split(r"\s*/\s*", title or "", maxsplit=1)[0])
    add(re.sub(r"\s*\[(instrumental|voice)\]\s*", "", title or "", flags=re.I))
    add(re.sub(r"\s*/\s*end title.*$", "", title or "", flags=re.I))
    add(title)
    return values


def _similarity(module: Any, left: str, right: str) -> float:
    norm_left = module._normalize_compare_text(left)
    norm_right = module._normalize_compare_text(right)
    if not norm_left or not norm_right:
        return 0.0
    import difflib
    return difflib.SequenceMatcher(None, norm_left, norm_right).ratio()


def _lrclib_candidates(module: Any, identity: Dict[str, Any], duration_ms: int, limit: int = 5) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    base = os.getenv("LRCLIB_API_BASE", "https://lrclib.net/api").strip().rstrip("/")
    title_variants = _title_variants(module, str(identity.get("title") or ""))
    artist_variants = _artist_variants(module, str(identity.get("artist") or "")) if identity.get("artist") else [""]
    attempts: List[Dict[str, Any]] = []
    candidates: List[Dict[str, Any]] = []
    seen = set()
    for title in title_variants:
        for artist in artist_variants:
            params = {"track_name": title}
            if artist:
                params["artist_name"] = artist
            try:
                resp = requests.get(f"{base}/search", params=params, timeout=20.0)
                attempts.append({"title": title, "artist": artist, "status": resp.status_code})
                if resp.status_code >= 400:
                    continue
                rows = resp.json()
            except Exception as err:
                attempts.append({"title": title, "artist": artist, "error": str(err)})
                continue
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                matched_title = str(row.get("trackName") or row.get("name") or "").strip()
                matched_artist = str(row.get("artistName") or "").strip()
                key = (
                    module._normalize_compare_text(matched_title),
                    module._normalize_compare_text(matched_artist),
                    int(row.get("duration") or 0),
                )
                if key in seen:
                    continue
                seen.add(key)
                cand_duration_ms = int(round(float(row.get("duration") or 0) * 1000.0)) if row.get("duration") else 0
                candidates.append({
                    "title": matched_title,
                    "artist": matched_artist,
                    "album": str(row.get("albumName") or "").strip(),
                    "durationMs": cand_duration_ms,
                    "durationDeltaMs": abs(cand_duration_ms - duration_ms) if cand_duration_ms and duration_ms else None,
                    "hasSyncedLyrics": bool(str(row.get("syncedLyrics") or "").strip()),
                    "titleSimilarity": round(_similarity(module, str(identity.get("title") or ""), matched_title), 3),
                    "artistSimilarity": round(_similarity(module, str(identity.get("artist") or ""), matched_artist), 3),
                })
    candidates.sort(
        key=lambda row: (
            -int(bool(row.get("hasSyncedLyrics"))),
            -(row.get("titleSimilarity") or 0.0),
            -(row.get("artistSimilarity") or 0.0),
            row.get("durationDeltaMs") if row.get("durationDeltaMs") is not None else 10**12,
            row.get("title") or "",
            row.get("artist") or "",
        )
    )
    return attempts, candidates[:limit]


def _genius_candidates(module: Any, identity: Dict[str, Any], limit: int = 5) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not os.getenv("GENIUS_ACCESS_TOKEN", "").strip():
        return [], []
    lyricsgenius = module._ensure_lyricsgenius()
    if not lyricsgenius:
        return [], []
    genius = lyricsgenius.Genius(
        os.getenv("GENIUS_ACCESS_TOKEN", "").strip(),
        timeout=10,
        retries=1,
        sleep_time=0.2,
        remove_section_headers=True,
        skip_non_songs=True,
        excluded_terms=["(Remix)", "(Live)"],
        verbose=False,
    )
    title_variants = _title_variants(module, str(identity.get("title") or ""))
    artist_variants = _artist_variants(module, str(identity.get("artist") or "")) if identity.get("artist") else [""]
    attempts: List[Dict[str, Any]] = []
    candidates: List[Dict[str, Any]] = []
    seen = set()
    for title in title_variants:
        attempt_artists = artist_variants[:] if artist_variants else [""]
        if "" not in attempt_artists:
            attempt_artists.append("")
        for artist in attempt_artists:
            try:
                song = genius.search_song(title=title, artist=artist or None)
                attempts.append({"title": title, "artist": artist, "matched": bool(song)})
            except Exception as err:
                attempts.append({"title": title, "artist": artist, "error": str(err)})
                continue
            if not song:
                continue
            matched_title = str(getattr(song, "title", "") or "").strip()
            matched_artist = str(getattr(song, "artist", "") or "").strip()
            key = (
                module._normalize_compare_text(matched_title),
                module._normalize_compare_text(matched_artist),
            )
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "title": matched_title,
                "artist": matched_artist,
                "titleSimilarity": round(_similarity(module, str(identity.get("title") or ""), matched_title), 3),
                "artistSimilarity": round(_similarity(module, str(identity.get("artist") or ""), matched_artist), 3),
                "lyricsLineCount": len(module._extract_genius_plain_lines(str(getattr(song, "lyrics", "") or ""))),
            })
    candidates.sort(
        key=lambda row: (
            -(row.get("titleSimilarity") or 0.0),
            -(row.get("artistSimilarity") or 0.0),
            -(row.get("lyricsLineCount") or 0),
            row.get("title") or "",
            row.get("artist") or "",
        )
    )
    return attempts, candidates[:limit]


def main() -> int:
    ap = argparse.ArgumentParser(description="Exhaust lyric provider candidate searches before declaring a track unmatched.")
    ap.add_argument("--audio-dir", help="Directory of audio files to scan")
    ap.add_argument("--track", action="append", help="Specific track path to scan; may be repeated")
    ap.add_argument("--track-list", help="Text file containing one track path per line")
    ap.add_argument(
        "--module-path",
        default=str(Path(__file__).resolve().parents[1] / "main.py"),
        help="Path to analysis-service main.py",
    )
    ap.add_argument(
        "--env-file",
        default=str(Path(__file__).resolve().parents[1] / ".env.local"),
        help="Optional env file to load before importing the analysis module",
    )
    args = ap.parse_args()

    _load_env_file(Path(args.env_file).expanduser())
    module = _load_main(Path(args.module_path).expanduser())
    profile_fast = module._normalize_analysis_profile("fast")
    tracks = _track_paths(args)
    if not tracks:
        raise SystemExit("No tracks provided.")

    rows: List[Dict[str, Any]] = []
    for path in tracks:
        identity, _, _, _ = module._resolve_identity_and_web(str(path), profile_fast)
        duration_ms = _duration_ms(path)
        lrclib_attempts, lrclib_candidates = _lrclib_candidates(module, identity, duration_ms)
        genius_attempts, genius_candidates = _genius_candidates(module, identity)
        rows.append({
            "file": path.name,
            "path": str(path),
            "durationMs": duration_ms,
            "identity": {
                "title": identity.get("title"),
                "artist": identity.get("artist"),
                "album": identity.get("album"),
                "provider": identity.get("provider"),
            },
            "lrclibSearch": {
                "attemptCount": len(lrclib_attempts),
                "attempts": lrclib_attempts,
                "topCandidates": lrclib_candidates,
            },
            "geniusSearch": {
                "attemptCount": len(genius_attempts),
                "attempts": genius_attempts,
                "topCandidates": genius_candidates,
            },
        })

    print(json.dumps({"trackCount": len(rows), "rows": rows}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
