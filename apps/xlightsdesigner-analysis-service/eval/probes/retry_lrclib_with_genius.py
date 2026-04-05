#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List
import re


ROOT = Path(__file__).resolve().parents[3]
SERVICE_MAIN = ROOT / "apps" / "xlightsdesigner-analysis-service" / "main.py"


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Retry LRCLIB using high-confidence Genius canonical names.")
    ap.add_argument("--genius-report", required=True, help="Path to Genius corpus report JSON")
    ap.add_argument("--runner-results", required=True, help="Path to progressive runner results.jsonl")
    ap.add_argument("--audio-folder", required=True, help="Folder containing the audio files")
    ap.add_argument("--out", required=True, help="Output JSON report path")
    ap.add_argument("--min-title-agreement", type=float, default=0.9, help="Minimum canonical title agreement")
    ap.add_argument("--request-timeout", type=float, default=5.0, help="Override LRCLIB HTTP timeout for evaluation")
    ap.add_argument("--allow-title-only", action="store_true", help="Include title-only candidates for review scoring")
    return ap.parse_args()


def load_service_module():
    spec = importlib.util.spec_from_file_location("analysis_service_main", SERVICE_MAIN)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


@contextmanager
def patched_requests_timeout(mod: Any, timeout_s: float):
    requests_mod = getattr(mod, "requests", None)
    if requests_mod is None or not hasattr(requests_mod, "get"):
        yield
        return
    original_get = requests_mod.get

    def wrapped_get(*args, **kwargs):
        kwargs["timeout"] = min(float(kwargs.get("timeout") or timeout_s), float(timeout_s))
        return original_get(*args, **kwargs)

    requests_mod.get = wrapped_get
    try:
        yield
    finally:
        requests_mod.get = original_get


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows


def latest_deep_rows(rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    latest: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        if row.get("mode") != "deep":
            continue
        if row.get("ok") is False:
            continue
        track = str(row.get("track") or "").strip()
        if not track:
            continue
        if track not in latest or float(row.get("completedAt") or 0.0) > float(latest[track].get("completedAt") or 0.0):
            latest[track] = row
    return latest


def should_retry_with_genius(genius_row: Dict[str, Any], latest_deep_row: Dict[str, Any], min_title_agreement: float) -> bool:
    if not genius_row or not latest_deep_row:
        return False
    if int(latest_deep_row.get("lyricsCount") or 0) > 0:
        return False
    if str(genius_row.get("matchQuality") or "") != "high":
        return False
    title_agreement = float(
        genius_row.get("canonicalTitleAgreement")
        or genius_row.get("titleSimilarity")
        or 0.0
    )
    if title_agreement < float(min_title_agreement):
        return False
    canonical_strong = genius_row.get("canonicalStrong")
    if canonical_strong is None:
        canonical_strong = str(genius_row.get("querySource") or "") == "identity-cache"
    canonical_artist = str(genius_row.get("canonicalArtist") or genius_row.get("queryArtist") or "").strip()
    if not canonical_artist:
        return False
    artist_agreement = genius_row.get("canonicalArtistAgreement")
    if artist_agreement is None:
        artist_agreement = genius_row.get("artistMatch")
    if not artist_agreement:
        return False
    return True


def is_generic_lyrics_artist(artist: str) -> bool:
    value = re.sub(r"[^a-z0-9]+", " ", str(artist or "").lower()).strip()
    return value in {"christmas songs", "christmas carols", "traditional", "various artists"}


def score_retry_confidence(row: Dict[str, Any]) -> Dict[str, Any]:
    score = 0
    reasons: List[str] = []
    title_agreement = float(row.get("canonicalTitleAgreement") or 0.0)
    if title_agreement >= 0.98:
        score += 2
        reasons.append("exact_title_agreement")
    elif title_agreement >= 0.9:
        score += 1
        reasons.append("strong_title_agreement")
    canonical_artist = str(row.get("canonicalArtist") or "").strip()
    if canonical_artist:
        score += 2
        reasons.append("canonical_artist_present")
    if bool(row.get("canonicalArtistAgreement")):
        score += 3
        reasons.append("artist_agreement")
    if bool(row.get("canonicalStrong")):
        score += 2
        reasons.append("strong_identity_source")
    genius_artist = str(row.get("geniusMatchedArtist") or "").strip()
    if genius_artist and not is_generic_lyrics_artist(genius_artist):
        score += 1
        reasons.append("specific_genius_artist")
    else:
        score -= 2
        reasons.append("generic_genius_artist")
    info = row.get("lrclibInfo") or {}
    duration_sec = info.get("lrclibDurationSec")
    local_duration_ms = int(row.get("localDurationMs") or 0)
    if duration_sec and local_duration_ms > 0:
        delta = abs(float(duration_sec) * 1000.0 - float(local_duration_ms))
        row["durationDeltaMs"] = int(round(delta))
        if delta <= 12000:
            score += 2
            reasons.append("duration_close")
        elif delta <= 25000:
            score += 1
            reasons.append("duration_reasonable")
        else:
            score -= 2
            reasons.append("duration_far")
    label = "reject"
    if row.get("retrySucceeded"):
        if score >= 6:
            label = "likely_correct"
        elif score >= 3:
            label = "plausible_but_weak"
    row["retryConfidenceScore"] = score
    row["retryConfidenceLabel"] = label
    row["retryConfidenceReasons"] = reasons
    return row


def main() -> int:
    args = parse_args()
    mod = load_service_module()
    genius_report = json.loads(Path(args.genius_report).expanduser().resolve().read_text())
    genius_by_track = {str(row.get("track") or ""): row for row in genius_report.get("rows", [])}
    runner_rows = load_jsonl(Path(args.runner_results).expanduser().resolve())
    latest = latest_deep_rows(runner_rows)
    folder = Path(args.audio_folder).expanduser().resolve()
    retried: List[Dict[str, Any]] = []

    with patched_requests_timeout(mod, float(args.request_timeout or 5.0)):
        for track, genius_row in sorted(genius_by_track.items()):
            latest_row = latest.get(track)
            if args.allow_title_only:
                if not genius_row or not latest_row:
                    continue
                if int((latest_row or {}).get("lyricsCount") or 0) > 0:
                    continue
                if str(genius_row.get("matchQuality") or "") != "high":
                    continue
                title_agreement = float(
                    genius_row.get("canonicalTitleAgreement")
                    or genius_row.get("titleSimilarity")
                    or 0.0
                )
                if title_agreement < float(args.min_title_agreement):
                    continue
            elif not should_retry_with_genius(genius_row, latest_row or {}, args.min_title_agreement):
                continue
            canonical_title = str(genius_row.get("canonicalTitle") or genius_row.get("queryTitle") or "").strip()
            canonical_artist = str(genius_row.get("canonicalArtist") or genius_row.get("queryArtist") or "").strip()
            canonical_strong = genius_row.get("canonicalStrong")
            if canonical_strong is None:
                canonical_strong = str(genius_row.get("querySource") or "") == "identity-cache"
            title_agreement = float(
                genius_row.get("canonicalTitleAgreement")
                or genius_row.get("titleSimilarity")
                or 0.0
            )
            artist_agreement = genius_row.get("canonicalArtistAgreement")
            if artist_agreement is None:
                artist_agreement = genius_row.get("artistMatch")
            title = str(genius_row.get("matchedTitle") or "").strip()
            artist = str(genius_row.get("matchedArtist") or "").strip()
            if not title:
                continue
            duration_ms = 300000
            try:
                audio_path = folder / track
                duration_ms = int(round(mod._load_audio_mono(str(audio_path))[1] * 1000))
            except Exception:
                duration_ms = 300000
            marks, error, info = mod._fetch_lrclib_lyrics_direct(
                {"title": title, "artist": artist},
                duration_ms,
                {"enableLyrics": True},
            )
            retried.append(
                {
                    "track": track,
                    "canonicalTitle": canonical_title,
                    "canonicalArtist": canonical_artist,
                    "geniusMatchedTitle": title,
                    "geniusMatchedArtist": artist,
                    "canonicalStrong": bool(canonical_strong),
                    "canonicalTitleAgreement": title_agreement,
                    "canonicalArtistAgreement": bool(artist_agreement),
                    "latestDeepLyricsCount": int(latest_row.get("lyricsCount") or 0) if latest_row else 0,
                    "localDurationMs": duration_ms,
                    "retrySucceeded": bool(marks),
                    "retriedLyricsCount": len(marks),
                    "lrclibError": str(error or ""),
                    "lrclibInfo": info,
                }
            )
            score_retry_confidence(retried[-1])

    report = {
        "candidateCount": len(retried),
        "recoveredCount": len([row for row in retried if row.get("retrySucceeded")]),
        "recoveryRate": round(len([row for row in retried if row.get("retrySucceeded")]) / len(retried), 4) if retried else 0.0,
        "likelyCorrectCount": len([row for row in retried if row.get("retryConfidenceLabel") == "likely_correct"]),
        "plausibleButWeakCount": len([row for row in retried if row.get("retryConfidenceLabel") == "plausible_but_weak"]),
        "rows": retried,
    }
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["candidateCount", "recoveredCount", "recoveryRate"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
