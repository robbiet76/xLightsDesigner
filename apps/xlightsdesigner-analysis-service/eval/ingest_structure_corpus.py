#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


LRCLIB_BASE = "https://lrclib.net/api"
ITUNES_SEARCH = "https://itunes.apple.com/search"


def _get_json(url: str, timeout: float = 20.0) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "xLightsDesigner-structure-ingest/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="ignore"))


def normalize_text(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", (s or "").lower())).strip()


def parse_lrc_lines(synced: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for raw in (synced or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$", line)
        if not m:
            continue
        mm = int(m.group(1))
        ss = int(m.group(2))
        frac = m.group(3) or "0"
        if len(frac) == 1:
            ms = int(frac) * 100
        elif len(frac) == 2:
            ms = int(frac) * 10
        else:
            ms = int(frac[:3])
        text = (m.group(4) or "").strip()
        if not text:
            continue
        start_ms = mm * 60_000 + ss * 1000 + ms
        rows.append({"startMs": start_ms, "text": text})
    rows.sort(key=lambda r: int(r["startMs"]))
    return rows


def split_stanzas_from_synced(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not lines:
        return []
    gaps = []
    for i in range(1, len(lines)):
        gaps.append(max(0, int(lines[i]["startMs"]) - int(lines[i - 1]["startMs"])))
    gap_ms = 7000
    if gaps:
        sorted_g = sorted(gaps)
        p75 = sorted_g[int((len(sorted_g) - 1) * 0.75)]
        med = sorted_g[len(sorted_g) // 2]
        gap_ms = max(3000, min(12000, int(max(p75 * 1.2, med * 1.8))))

    stanzas: List[Dict[str, Any]] = []
    cur: List[Dict[str, Any]] = [lines[0]]
    for i in range(1, len(lines)):
        prev = lines[i - 1]
        now = lines[i]
        if int(now["startMs"]) - int(prev["startMs"]) >= gap_ms:
            stanzas.append(_build_stanza(cur))
            cur = [now]
        else:
            cur.append(now)
    if cur:
        stanzas.append(_build_stanza(cur))
    return stanzas


def _build_stanza(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    start_ms = int(rows[0]["startMs"])
    end_ms = int(rows[-1]["startMs"]) + 1200
    lines = [str(r["text"]).strip() for r in rows if str(r.get("text", "")).strip()]
    return {
        "startMs": start_ms,
        "endMs": max(start_ms + 1, end_ms),
        "lines": lines,
        "text": " | ".join(lines),
    }


def split_stanzas_from_plain(plain: str) -> List[Dict[str, Any]]:
    blocks = [b.strip() for b in re.split(r"\n\s*\n", plain or "") if b.strip()]
    out = []
    for b in blocks:
        lines = [ln.strip() for ln in b.splitlines() if ln.strip()]
        out.append({"startMs": None, "endMs": None, "lines": lines, "text": " | ".join(lines)})
    return out


def score_stanzas(stanzas: List[Dict[str, Any]], title: str) -> List[Dict[str, Any]]:
    title_norm = normalize_text(title)
    line_freq: Dict[str, int] = {}
    norm_lines_per_stanza: List[List[str]] = []
    for s in stanzas:
        norm_lines = [normalize_text(x) for x in s.get("lines", []) if normalize_text(x)]
        norm_lines_per_stanza.append(norm_lines)
        for ln in norm_lines:
            line_freq[ln] = line_freq.get(ln, 0) + 1

    results = []
    seen_patterns = set()
    for i, s in enumerate(stanzas):
        norm_lines = norm_lines_per_stanza[i]
        unique_lines = set(norm_lines)
        repeated_global = sum(1 for ln in norm_lines if line_freq.get(ln, 0) >= 2)
        title_hits = sum(1 for ln in norm_lines if title_norm and title_norm in ln)
        repeated_ratio = (repeated_global / max(1, len(norm_lines))) if norm_lines else 0.0
        title_ratio = (title_hits / max(1, len(norm_lines))) if norm_lines else 0.0
        pattern = "||".join(sorted(unique_lines))
        seen_before = bool(pattern and pattern in seen_patterns)
        if pattern:
            seen_patterns.add(pattern)

        # Heuristic label draft used for weak supervision only.
        if i == 0 and (title_ratio == 0 and repeated_ratio < 0.25):
            label = "Verse"
        elif title_ratio >= 0.34 or repeated_ratio >= 0.50 or seen_before:
            label = "Chorus"
        else:
            label = "Verse"

        results.append({
            **s,
            "index": i,
            "draftLabel": label,
            "titleLineHits": title_hits,
            "titleLineRatio": round(title_ratio, 3),
            "globallyRepeatedLineRatio": round(repeated_ratio, 3),
            "patternSeenBefore": seen_before,
        })
    return results


def fetch_lrclib(title: str, artist: str, timeout: float) -> Optional[Dict[str, Any]]:
    q = urllib.parse.urlencode({"track_name": title, "artist_name": artist})
    url = f"{LRCLIB_BASE}/get?{q}"
    try:
        data = _get_json(url, timeout=timeout)
        if isinstance(data, dict) and data.get("id"):
            return data
    except Exception:
        return None
    return None


def discover_itunes(term: str, limit: int, timeout: float) -> List[Dict[str, str]]:
    q = urllib.parse.urlencode({"term": term, "entity": "song", "limit": str(limit)})
    url = f"{ITUNES_SEARCH}?{q}"
    data = _get_json(url, timeout=timeout)
    out = []
    for row in (data.get("results") or []):
        title = str(row.get("trackName") or "").strip()
        artist = str(row.get("artistName") or "").strip()
        if title and artist:
            out.append({"title": title, "artist": artist})
    return out


def read_catalog(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(path)
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data.get("songs") if isinstance(data, dict) else data
        out = []
        for r in rows or []:
            if not isinstance(r, dict):
                continue
            title = str(r.get("title") or "").strip()
            artist = str(r.get("artist") or "").strip()
            if title and artist:
                out.append({"title": title, "artist": artist})
        return out
    out = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            title = str(r.get("title") or "").strip()
            artist = str(r.get("artist") or "").strip()
            if title and artist:
                out.append({"title": title, "artist": artist})
    return out


def dedupe_songs(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen = set()
    out = []
    for r in rows:
        key = (normalize_text(r.get("title", "")), normalize_text(r.get("artist", "")))
        if not key[0] or not key[1] or key in seen:
            continue
        seen.add(key)
        out.append({"title": r["title"], "artist": r["artist"]})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Build a stanza-structure corpus from catalog songs via LRCLIB.")
    ap.add_argument("--catalog", default="", help="Path to CSV/JSON with columns/keys: title,artist")
    ap.add_argument("--itunes-term", action="append", default=[], help="Optional iTunes discovery term (repeatable)")
    ap.add_argument("--itunes-limit", type=int, default=50, help="Per-term iTunes result limit")
    ap.add_argument("--max-songs", type=int, default=200, help="Max songs to process after dedupe")
    ap.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout seconds")
    ap.add_argument("--out", required=True, help="Output JSON file path")
    args = ap.parse_args()

    songs: List[Dict[str, str]] = []
    if args.catalog:
        songs.extend(read_catalog(Path(args.catalog)))
    for term in args.itunes_term:
        try:
            songs.extend(discover_itunes(term, args.itunes_limit, args.timeout))
        except Exception as err:
            print(f"[warn] iTunes discovery failed for '{term}': {err}", file=sys.stderr)

    songs = dedupe_songs(songs)[: max(1, int(args.max_songs))]
    if not songs:
        print("No songs to process. Provide --catalog and/or --itunes-term.", file=sys.stderr)
        return 2

    results = []
    hit = 0
    for i, song in enumerate(songs, start=1):
        title = song["title"]
        artist = song["artist"]
        try:
            lyr = fetch_lrclib(title, artist, args.timeout)
            if not lyr:
                results.append({"title": title, "artist": artist, "status": "no_lyrics"})
                continue
            synced = str(lyr.get("syncedLyrics") or "").strip()
            plain = str(lyr.get("plainLyrics") or "").strip()
            if synced:
                stanzas = split_stanzas_from_synced(parse_lrc_lines(synced))
                source = "synced"
            else:
                stanzas = split_stanzas_from_plain(plain)
                source = "plain"
            scored = score_stanzas(stanzas, title)
            results.append({
                "title": title,
                "artist": artist,
                "status": "ok",
                "lyricsSource": source,
                "lrclibId": lyr.get("id"),
                "albumName": lyr.get("albumName"),
                "duration": lyr.get("duration"),
                "stanzaCount": len(scored),
                "stanzas": scored,
            })
            hit += 1
        except Exception as err:
            results.append({"title": title, "artist": artist, "status": "error", "error": str(err)})
        if i % 20 == 0:
            print(f"[progress] {i}/{len(songs)} processed; matched={hit}")

    out_obj = {
        "meta": {
            "source": "lrclib",
            "songCount": len(songs),
            "matchedCount": hit,
            "matchRate": round(hit / max(1, len(songs)), 4),
        },
        "songs": results,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out_obj, indent=2), encoding="utf-8")

    print(f"Wrote: {out_path}")
    print(f"Songs processed: {len(songs)}")
    print(f"Lyrics matched: {hit}")
    print(f"Match rate: {round(hit / max(1, len(songs)) * 100, 2)}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
