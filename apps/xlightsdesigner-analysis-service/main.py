from __future__ import annotations

import os
import tempfile
import hashlib
import json
import time
import re
import math
import importlib.util
import difflib
from urllib.parse import quote_plus
import collections
import collections.abc
from typing import Any, Dict, List, Optional

import numpy as np
import requests
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
try:
    import soundfile as sf  # type: ignore
except Exception:  # pragma: no cover
    sf = None

# madmom (used by BeatNet) still references legacy collections symbols.
for _name in ("MutableSequence", "MutableMapping", "MutableSet", "Sequence", "Mapping", "Set"):
    if not hasattr(collections, _name) and hasattr(collections.abc, _name):
        setattr(collections, _name, getattr(collections.abc, _name))

librosa = None
BeatNetEstimator = None
CNNChordFeatureProcessor = None
CRFChordRecognitionProcessor = None
MadmomSignal = None
RNNDownBeatProcessor = None
DBNDownBeatTrackingProcessor = None
_LIBROSA_IMPORT_ATTEMPTED = False
_BEATNET_IMPORT_ATTEMPTED = False
_MADMOM_IMPORT_ATTEMPTED = False
_LYRICSGENIUS_IMPORT_ATTEMPTED = False
LyricsGeniusClient = None


APP_API_KEY = os.getenv("ANALYSIS_API_KEY", "").strip()
DEFAULT_BEATS_PER_BAR = int(os.getenv("ANALYSIS_BEATS_PER_BAR", "4"))
AUDD_API_TOKEN = os.getenv("AUDD_API_TOKEN", "").strip()
AUDD_API_URL = os.getenv("AUDD_API_URL", "https://api.audd.io/").strip()
ENABLE_DSP_SECTION_FALLBACK = os.getenv("ENABLE_DSP_SECTION_FALLBACK", "").strip().lower() in ("1", "true", "yes")
LRCLIB_API_BASE = os.getenv("LRCLIB_API_BASE", "https://lrclib.net/api").strip().rstrip("/")
ENABLE_LYRICS_AUTO_SHIFT = (
    str(os.getenv("ENABLE_LYRICS_AUTO_SHIFT", "0")).strip().lower() in {"1", "true", "yes", "on"}
)
ENABLE_MADMOM_CHORDS = (
    str(os.getenv("ENABLE_MADMOM_CHORDS", "0")).strip().lower() in {"1", "true", "yes", "on"}
)
ENABLE_MADMOM_DOWNBEAT_CROSSCHECK = (
    str(os.getenv("ENABLE_MADMOM_DOWNBEAT_CROSSCHECK", "0")).strip().lower() in {"1", "true", "yes", "on"}
)
ENABLE_REMOTE_IDENTITY_LOOKUP = (
    str(os.getenv("ENABLE_REMOTE_IDENTITY_LOOKUP", "0")).strip().lower() in {"1", "true", "yes", "on"}
)
ENABLE_WEB_TEMPO_LOOKUP = (
    str(os.getenv("ENABLE_WEB_TEMPO_LOOKUP", "0")).strip().lower() in {"1", "true", "yes", "on"}
)
ENABLE_LYRICS_LOOKUP = (
    str(os.getenv("ENABLE_LYRICS_LOOKUP", "0")).strip().lower() in {"1", "true", "yes", "on"}
)
ENABLE_GENIUS_LRCLIB_RETRY = (
    str(os.getenv("ENABLE_GENIUS_LRCLIB_RETRY", "0")).strip().lower() in {"1", "true", "yes", "on"}
)
GENIUS_ACCESS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN", "").strip()
IDENTITY_CACHE_PATH = os.getenv(
    "ANALYSIS_IDENTITY_CACHE_PATH",
    os.path.join(os.path.dirname(__file__), ".cache", "track-identity-cache.json"),
).strip()

ANALYSIS_PROFILE_MODES = {"fast", "deep"}

app = FastAPI(title="xLightsDesigner Analysis Service", version="0.1.0")


def _normalize_analysis_profile(mode: str = "") -> Dict[str, Any]:
    value = str(mode or "").strip().lower()
    normalized = value if value in ANALYSIS_PROFILE_MODES else "deep"
    if normalized == "fast":
        return {
            "mode": "fast",
            "enableRemoteIdentity": False,
            "enableWebTempo": False,
            "enableLyrics": False,
            "enableMadmomChords": False,
            "enableMadmomDownbeatCrosscheck": False,
        }
    return {
        "mode": "deep",
        "enableRemoteIdentity": bool(ENABLE_REMOTE_IDENTITY_LOOKUP),
        "enableWebTempo": bool(ENABLE_WEB_TEMPO_LOOKUP),
        "enableLyrics": bool(ENABLE_LYRICS_LOOKUP),
        "enableMadmomChords": bool(ENABLE_MADMOM_CHORDS),
        "enableMadmomDownbeatCrosscheck": bool(ENABLE_MADMOM_DOWNBEAT_CROSSCHECK),
    }


def _module_available(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def _ensure_librosa():
    global librosa, _LIBROSA_IMPORT_ATTEMPTED
    if not _LIBROSA_IMPORT_ATTEMPTED:
        try:
            import librosa as _librosa  # type: ignore
            librosa = _librosa
        except Exception:
            librosa = None
        _LIBROSA_IMPORT_ATTEMPTED = True
    return librosa


def _ensure_beatnet():
    global BeatNetEstimator, _BEATNET_IMPORT_ATTEMPTED
    if not _BEATNET_IMPORT_ATTEMPTED:
        try:
            from BeatNet.BeatNet import BeatNet as _BeatNetEstimator  # type: ignore
            BeatNetEstimator = _BeatNetEstimator
        except Exception:
            BeatNetEstimator = None
        _BEATNET_IMPORT_ATTEMPTED = True
    return BeatNetEstimator


def _ensure_lyricsgenius():
    global LyricsGeniusClient, _LYRICSGENIUS_IMPORT_ATTEMPTED
    if not _LYRICSGENIUS_IMPORT_ATTEMPTED:
        try:
            import typing
            if not hasattr(typing, "Self"):
                try:
                    from typing_extensions import Self as _Self  # type: ignore
                    typing.Self = _Self  # type: ignore[attr-defined]
                except Exception:
                    pass
            import lyricsgenius as _lyricsgenius  # type: ignore
            LyricsGeniusClient = _lyricsgenius
        except Exception:
            LyricsGeniusClient = None
        _LYRICSGENIUS_IMPORT_ATTEMPTED = True
    return LyricsGeniusClient


def _ensure_madmom_chords():
    global CNNChordFeatureProcessor, CRFChordRecognitionProcessor, MadmomSignal, RNNDownBeatProcessor, DBNDownBeatTrackingProcessor, _MADMOM_IMPORT_ATTEMPTED
    if not _MADMOM_IMPORT_ATTEMPTED:
        try:
            from madmom.features.chords import CNNChordFeatureProcessor as _CNNChordFeatureProcessor, CRFChordRecognitionProcessor as _CRFChordRecognitionProcessor  # type: ignore
            from madmom.features.downbeats import RNNDownBeatProcessor as _RNNDownBeatProcessor, DBNDownBeatTrackingProcessor as _DBNDownBeatTrackingProcessor  # type: ignore
            from madmom.audio.signal import Signal as _MadmomSignal  # type: ignore
            CNNChordFeatureProcessor = _CNNChordFeatureProcessor
            CRFChordRecognitionProcessor = _CRFChordRecognitionProcessor
            MadmomSignal = _MadmomSignal
            RNNDownBeatProcessor = _RNNDownBeatProcessor
            DBNDownBeatTrackingProcessor = _DBNDownBeatTrackingProcessor
        except Exception:
            CNNChordFeatureProcessor = None
            CRFChordRecognitionProcessor = None
            MadmomSignal = None
            RNNDownBeatProcessor = None
            DBNDownBeatTrackingProcessor = None
        _MADMOM_IMPORT_ATTEMPTED = True
    return CNNChordFeatureProcessor, CRFChordRecognitionProcessor, MadmomSignal


def _ensure_auth(x_api_key: Optional[str]) -> None:
    if not APP_API_KEY:
        return
    if (x_api_key or "").strip() != APP_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _sanitize_marks(marks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for idx, mark in enumerate(marks):
        try:
            start = int(round(float(mark.get("startMs", 0))))
        except Exception:
            continue
        end_raw = mark.get("endMs")
        end = None
        if end_raw is not None:
            try:
                end = int(round(float(end_raw)))
            except Exception:
                end = None
        row: Dict[str, Any] = {"startMs": max(0, start)}
        if end is not None and end > row["startMs"]:
            row["endMs"] = end
        label = str(mark.get("label", "")).strip()
        if label:
            row["label"] = label
        rows.append(row)
    return rows


def _provider_config_state() -> Dict[str, Any]:
    missing = []
    if ENABLE_REMOTE_IDENTITY_LOOKUP and not AUDD_API_TOKEN:
        missing.append("AUDD_API_TOKEN")
    return {
        "auddConfigured": bool(AUDD_API_TOKEN),
        "remoteIdentityLookupEnabled": bool(ENABLE_REMOTE_IDENTITY_LOOKUP),
        "webTempoLookupEnabled": bool(ENABLE_WEB_TEMPO_LOOKUP),
        "lyricsLookupEnabled": bool(ENABLE_LYRICS_LOOKUP),
        "madmomChordsEnabled": bool(ENABLE_MADMOM_CHORDS),
        "madmomDownbeatCrosscheckEnabled": bool(ENABLE_MADMOM_DOWNBEAT_CROSSCHECK),
        "dspFallbackEnabled": bool(ENABLE_DSP_SECTION_FALLBACK),
        "identityCachePath": IDENTITY_CACHE_PATH,
        "missing": missing,
    }


def _audio_fingerprint(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _fallback_identity_from_path(path: str) -> Dict[str, Any]:
    stem = os.path.splitext(os.path.basename(str(path) or ""))[0]
    text = str(stem or "").strip()
    if not text:
        return {}
    text = re.sub(r"_+", " ", text)
    text = re.sub(r"^\s*\d+\s*[-.)_ ]+\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    artist = ""
    title = text
    if " - " in text:
        left, right = text.split(" - ", 1)
        if left.strip() and right.strip():
            artist = left.strip()
            title = right.strip()
    return _normalize_identity({
        "provider": "filename",
        "title": title,
        "artist": artist,
    })


def _slugify(s: str) -> str:
    text = str(s or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text


def _extract_numeric_list(pattern: str, text: str) -> List[float]:
    out: List[float] = []
    for m in re.finditer(pattern, text, flags=re.IGNORECASE):
        try:
            v = float(m.group(1))
        except Exception:
            continue
        if math.isfinite(v) and v > 0:
            out.append(v)
    return out


def _extract_bpm_values(text: str) -> List[float]:
    plain = re.sub(r"<[^>]+>", " ", str(text or " "))
    plain = re.sub(r"\s+", " ", plain).strip()
    out: List[float] = []
    alternates: List[float] = []
    for m in re.finditer(r"\b(\d+(?:\.\d+)?)\s*bpm\b", plain, flags=re.IGNORECASE):
        try:
            v = float(m.group(1))
        except Exception:
            continue
        if math.isfinite(v) and v > 0:
            out.append(v)

    alt_patterns = [
        r"half(?:-| )time[^0-9]{0,24}(\d+(?:\.\d+)?)\s*bpm",
        r"(\d+(?:\.\d+)?)\s*bpm[^a-z0-9]{0,24}half(?:-| )time",
        r"double(?:-| )time[^0-9]{0,24}(\d+(?:\.\d+)?)\s*bpm",
        r"(\d+(?:\.\d+)?)\s*bpm[^a-z0-9]{0,24}double(?:-| )time",
    ]
    for pat in alt_patterns:
        for m in re.finditer(pat, plain, flags=re.IGNORECASE):
            try:
                v = float(m.group(1))
            except Exception:
                continue
            if math.isfinite(v) and v > 0:
                alternates.append(v)

    if not alternates:
        return out

    filtered: List[float] = []
    for v in out:
        if any(abs(v - a) <= 0.05 for a in alternates):
            continue
        filtered.append(v)
    return filtered


def _extract_time_signatures(text: str) -> List[str]:
    out: List[str] = []
    for m in re.finditer(r"\b(\d{1,2}\s*/\s*\d{1,2})\b", text):
        sig = re.sub(r"\s+", "", m.group(1))
        if sig not in out:
            out.append(sig)
    # SongBPM often uses prose "N beats per bar"
    for m in re.finditer(r"\b(\d{1,2})\s+beats?\s+per\s+bar\b", text, flags=re.IGNORECASE):
        n = int(m.group(1))
        sig = f"{n}/4"
        if sig not in out:
            out.append(sig)
    return out


def _fetch_songbpm_evidence(identity: Dict[str, Any]) -> Dict[str, Any]:
    title = str(identity.get("title", "")).strip()
    artist = str(identity.get("artist", "")).strip()
    if not title or not artist:
        return {"sources": [], "bpmValues": [], "barsPerMinuteValues": [], "timeSignatures": [], "chosenBeatBpm": None}

    title_slug = _slugify(title)
    artist_slug = _slugify(artist)
    candidates = [
        f"https://songbpm.com/@{artist_slug}/{title_slug}",
        f"https://www.songbpm.com/@{artist_slug}/{title_slug}",
        f"https://getsongbpm.com/search?type=all&lookup={quote_plus(f'{artist} {title}')}",
    ]

    bpm_vals: List[float] = []
    bars_vals: List[float] = []
    sigs: List[str] = []
    used_sources: List[str] = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    }
    for url in candidates:
        try:
            resp = requests.get(url, timeout=15.0, headers=headers)
            if resp.status_code >= 400:
                continue
            text = resp.text or ""
            low = text.lower()
            # Skip anti-bot challenge pages
            if "just a moment" in low and "cloudflare" in low:
                continue
            local_bpm = _extract_bpm_values(text)
            local_bars = _extract_numeric_list(r"\b(\d+(?:\.\d+)?)\s*(?:bars?|measures?)\s*(?:per|/)\s*minute\b", text)
            local_sigs = _extract_time_signatures(text)
            if local_bpm or local_bars or local_sigs:
                used_sources.append(url)
                bpm_vals.extend(local_bpm)
                bars_vals.extend(local_bars)
                for sig in local_sigs:
                    if sig not in sigs:
                        sigs.append(sig)
        except Exception:
            continue

    # Keep values in musically plausible ranges and dedupe by rounded value.
    bpm_vals = [v for v in bpm_vals if 30.0 <= v <= 320.0]
    bars_vals = [v for v in bars_vals if 10.0 <= v <= 160.0]
    bpm_vals = sorted({round(v, 2) for v in bpm_vals})
    bars_vals = sorted({round(v, 2) for v in bars_vals})

    chosen_beat_bpm: Optional[float] = None
    if bpm_vals:
        chosen_beat_bpm = float(np.median(np.asarray(bpm_vals, dtype=float)))
    elif bars_vals and sigs:
        # derive beat bpm from bars/min and first known signature numerator
        m = re.match(r"^(\d+)\s*/\s*(\d+)$", sigs[0])
        if m:
            n = int(m.group(1))
            chosen_beat_bpm = float(np.median(np.asarray(bars_vals, dtype=float))) * max(1, n)

    return {
        "sources": used_sources[:3],
        "bpmValues": bpm_vals[:8],
        "barsPerMinuteValues": bars_vals[:8],
        "timeSignatures": sigs[:4],
        "chosenBeatBpm": round(chosen_beat_bpm, 2) if chosen_beat_bpm and math.isfinite(chosen_beat_bpm) else None,
        "provider": "songbpm+getsongbpm",
    }


def _load_identity_cache() -> Dict[str, Any]:
    try:
        with open(IDENTITY_CACHE_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {"version": 1, "entries": {}}


def _normalize_identity(identity: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(identity, dict):
        return {}
    out = {
        "provider": str(identity.get("provider", "")).strip(),
        "title": str(identity.get("title", "")).strip(),
        "artist": str(identity.get("artist", "")).strip(),
        "album": str(identity.get("album", "")).strip(),
        "releaseDate": str(identity.get("releaseDate", "")).strip(),
        "isrc": str(identity.get("isrc", "")).strip(),
    }
    return {k: v for k, v in out.items() if v}


def _save_identity_cache(cache: Dict[str, Any]) -> None:
    directory = os.path.dirname(IDENTITY_CACHE_PATH)
    if directory:
        os.makedirs(directory, exist_ok=True)
    tmp_path = f"{IDENTITY_CACHE_PATH}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, separators=(",", ":"), ensure_ascii=True)
    os.replace(tmp_path, IDENTITY_CACHE_PATH)


def _identity_cache_get(fingerprint: str) -> Dict[str, Any]:
    cache = _load_identity_cache()
    entries = cache.get("entries") if isinstance(cache, dict) else {}
    row = entries.get(fingerprint) if isinstance(entries, dict) else None
    if isinstance(row, dict):
        identity = row.get("identity")
        if isinstance(identity, dict):
            return _normalize_identity(identity)
    return {}


def _identity_cache_put(fingerprint: str, identity: Dict[str, Any]) -> None:
    normalized = _normalize_identity(identity)
    if not fingerprint or not normalized:
        return
    cache = _load_identity_cache()
    entries = cache.get("entries")
    if not isinstance(entries, dict):
        entries = {}
        cache["entries"] = entries
    entries[fingerprint] = {
        "identity": normalized,
        "updatedAt": int(time.time()),
    }
    _save_identity_cache(cache)


def _parse_lrc_synced_lyrics(lrc_text: str, duration_ms: int) -> List[Dict[str, Any]]:
    if not lrc_text:
        return []
    lines = [str(line).strip() for line in str(lrc_text).splitlines() if str(line).strip()]
    time_re = re.compile(r"\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]")
    offset_re = re.compile(r"^\[offset:([+-]?\d+)\]$", re.IGNORECASE)
    global_offset_ms = 0
    for line in lines:
        m = offset_re.match(line)
        if m:
            try:
                global_offset_ms = int(m.group(1))
            except Exception:
                global_offset_ms = 0
            break
    marks: List[Dict[str, Any]] = []
    for line in lines:
        if offset_re.match(line):
            continue
        tags = list(time_re.finditer(line))
        if not tags:
            continue
        lyric = time_re.sub("", line).strip()
        # Keep true lyric lines only; skip pure timestamp/meta rows.
        if not lyric:
            continue
        for tag in tags:
            mm = int(tag.group(1))
            ss = int(tag.group(2))
            frac = tag.group(3) or "0"
            if len(frac) == 1:
                frac_ms = int(frac) * 100
            elif len(frac) == 2:
                frac_ms = int(frac) * 10
            else:
                frac_ms = int(frac[:3])
            start = mm * 60000 + ss * 1000 + frac_ms + global_offset_ms
            if start < 0 or start >= duration_ms:
                continue
            row: Dict[str, Any] = {"startMs": int(start)}
            row["label"] = lyric
            marks.append(row)
    marks.sort(key=lambda x: int(x.get("startMs", 0)))
    out: List[Dict[str, Any]] = []
    for i, row in enumerate(marks):
        start = int(row["startMs"])
        next_start = int(marks[i + 1]["startMs"]) if i + 1 < len(marks) else duration_ms
        end = max(start + 1, min(duration_ms, next_start))
        if end <= start:
            continue
        out_row: Dict[str, Any] = {"startMs": start, "endMs": end}
        label = str(row.get("label", "")).strip()
        if label:
            out_row["label"] = label
        out.append(out_row)
    return _sanitize_marks(out)


def _normalize_lyric_text(text: str) -> str:
    s = str(text or "").lower().strip()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _lyric_token_set(text: str) -> set[str]:
    return {token for token in _normalize_lyric_text(text).split(" ") if token}


def _jaccard_similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return float(len(a & b) / len(union))


def _stanza_similarity(a_lines: List[str], b_lines: List[str]) -> float:
    if not a_lines or not b_lines:
        return 0.0
    a_tokens = _lyric_token_set(" ".join(a_lines))
    b_tokens = _lyric_token_set(" ".join(b_lines))
    token_sim = _jaccard_similarity(a_tokens, b_tokens)
    line_count_ratio = min(len(a_lines), len(b_lines)) / max(len(a_lines), len(b_lines))
    exact_line_matches = 0
    normalized_b = {_normalize_lyric_text(line) for line in b_lines}
    for line in a_lines:
        if _normalize_lyric_text(line) in normalized_b:
            exact_line_matches += 1
    exact_line_score = exact_line_matches / max(1, min(len(a_lines), len(b_lines)))
    return (token_sim * 0.6) + (line_count_ratio * 0.15) + (exact_line_score * 0.25)


def _lyric_window_looks_like_outro(rows: List[Dict[str, Any]]) -> bool:
    if not rows:
        return False
    normalized = [_normalize_lyric_text(row.get("label", "")) for row in rows]
    normalized = [text for text in normalized if text]
    if not normalized:
        return True
    all_tokens: List[str] = []
    for text in normalized:
        all_tokens.extend([token for token in text.split(" ") if token])
    unique_tokens = {token for token in all_tokens if token}
    if len(unique_tokens) <= 3:
        return True
    repeated_line_share = 1.0 - (len(set(normalized)) / max(1.0, float(len(normalized))))
    short_line_share = sum(1 for text in normalized if len(_lyric_token_set(text)) <= 2) / max(1.0, float(len(normalized)))
    if repeated_line_share >= 0.45 and short_line_share >= 0.5:
        return True
    prefix_counts: Dict[tuple[str, ...], int] = {}
    for text in normalized:
        tokens = [token for token in text.split(" ") if token]
        if len(tokens) < 3:
            continue
        prefix = tuple(tokens[:4])
        prefix_counts[prefix] = prefix_counts.get(prefix, 0) + 1
    if prefix_counts:
        dominant_prefix_count = max(prefix_counts.values())
        if dominant_prefix_count >= max(2, int(len(normalized) * 0.5)):
            return True
    suffix_counts: Dict[tuple[str, ...], int] = {}
    for text in normalized:
        tokens = [token for token in text.split(" ") if token]
        if len(tokens) < 4:
            continue
        suffix = tuple(tokens[1:4])
        suffix_counts[suffix] = suffix_counts.get(suffix, 0) + 1
    if suffix_counts:
        dominant_suffix_count = max(suffix_counts.values())
        if dominant_suffix_count >= max(2, int(len(normalized) * 0.5)):
            return True
    return False


def _find_repeated_lyric_line_spans(rows: List[Dict[str, Any]]) -> List[tuple[int, int]]:
    if len(rows) < 4:
        return []
    normalized_lines = [_normalize_lyric_text(row.get("label", "")) for row in rows]
    token_sets = [_lyric_token_set(text) for text in normalized_lines]
    exact_families: List[List[int]] = []
    for idx, text in enumerate(normalized_lines):
        if not text:
            continue
        tokens = token_sets[idx]
        if len(tokens) < 2 or len(tokens) <= 1:
            continue
        matched_family = None
        for family in exact_families:
            ref_idx = family[0]
            sim = _jaccard_similarity(tokens, token_sets[ref_idx])
            if sim >= 0.72:
                matched_family = family
                break
        if matched_family is None:
            exact_families.append([idx])
        else:
            matched_family.append(idx)
    prefix_families: Dict[tuple[str, ...], List[int]] = {}
    for idx, text in enumerate(normalized_lines):
        tokens = [token for token in text.split(" ") if token]
        unique_tokens = {token for token in tokens if token}
        if len(tokens) < 3 or len(unique_tokens) < 2:
            continue
        prefix = tuple(tokens[:3])
        prefix_families.setdefault(prefix, []).append(idx)
    candidate_families: List[List[int]] = []
    for family in exact_families:
        if len(family) < 2:
            continue
        ref_tokens = token_sets[family[0]]
        if len(ref_tokens) < 3 and len(family) < 3:
            continue
        candidate_families.append(list(sorted(set(int(idx) for idx in family))))
    for family in prefix_families.values():
        unique_family = list(sorted(set(int(idx) for idx in family)))
        if len(unique_family) < 3:
            continue
        candidate_families.append(unique_family)
    if not candidate_families:
        return []
    best_count = max(len(family) for family in candidate_families)
    anchor_indexes: set[int] = set()
    for family in candidate_families:
        if len(family) < best_count:
            continue
        for idx in family:
            anchor_indexes.add(int(idx))
    spans: List[tuple[int, int]] = []
    for idx in sorted(anchor_indexes):
        start_ms = int(rows[idx].get("startMs", 0))
        end_ms = int(rows[idx].get("endMs", start_ms + 1))
        if idx + 1 < len(rows):
            next_start = int(rows[idx + 1].get("startMs", end_ms))
            next_end = int(rows[idx + 1].get("endMs", next_start + 1))
            if 0 <= next_start - end_ms <= 2500 and next_end > end_ms:
                end_ms = next_end
        if end_ms > start_ms:
            spans.append((start_ms, end_ms))
    return spans


def _infer_sections_from_lyrics(lyrics_marks: List[Dict[str, Any]], duration_ms: int) -> List[Dict[str, Any]]:
    rows = sorted(
        [r for r in (lyrics_marks or []) if isinstance(r, dict) and "startMs" in r and "endMs" in r],
        key=lambda r: int(r.get("startMs", 0)),
    )
    if not rows:
        return []
    # Derive adaptive stanza split threshold from actual lyric pacing.
    gaps: List[int] = []
    for i in range(1, len(rows)):
        prev_end = int(rows[i - 1].get("endMs", rows[i - 1].get("startMs", 0)))
        gap = int(rows[i].get("startMs", 0)) - prev_end
        if gap > 0:
            gaps.append(gap)
    if gaps:
        g = np.asarray(gaps, dtype=float)
        med = float(np.median(g))
        p75 = float(np.percentile(g, 75))
        stanza_gap_ms = int(max(2500.0, min(12000.0, max(p75 * 1.35, med * 2.1))))
    else:
        stanza_gap_ms = 6000

    texts = [_normalize_lyric_text(r.get("label", "")) for r in rows]

    # Split into stanzas by adaptive inter-line silence.
    stanzas: List[tuple[int, int]] = []
    stanza_start = 0
    for i in range(1, len(rows)):
        prev_end = int(rows[i - 1].get("endMs", rows[i - 1].get("startMs", 0)))
        gap = int(rows[i].get("startMs", 0)) - prev_end
        if gap >= stanza_gap_ms:
            stanzas.append((stanza_start, i))
            stanza_start = i
    stanzas.append((stanza_start, len(rows)))

    chorus_spans: List[tuple[int, int]] = []
    stanza_payloads: List[Dict[str, Any]] = []
    for idx, (a, b) in enumerate(stanzas):
        if a >= b:
            continue
        start_ms = int(rows[a].get("startMs", 0))
        end_ms = int(rows[b - 1].get("endMs", start_ms + 1))
        stanza_lines = [str(rows[line_idx].get("label", "")) for line_idx in range(a, b)]
        stanza_payloads.append({
            "index": idx,
            "range": (a, b),
            "startMs": start_ms,
            "endMs": end_ms,
            "lines": stanza_lines,
        })

    # Keep exact repeated windows as a strong chorus hint when they exist.
    window_hits: Dict[tuple[str, ...], List[int]] = {}
    n = len(texts)
    for k in (4, 3, 2):
        if n < k:
            continue
        for i in range(0, n - k + 1):
            win = tuple(texts[i : i + k])
            if any(not t for t in win):
                continue
            if sum(len(t) for t in win) < 20:
                continue
            window_hits.setdefault(win, []).append(i)

    exact_chorus_spans: List[tuple[int, int]] = []
    for win, starts in window_hits.items():
        k = len(win)
        chosen: List[int] = []
        for s in sorted(starts):
            if not chosen or s >= (chosen[-1] + k):
                chosen.append(s)
        if len(chosen) < 2:
            continue
        for sidx in chosen:
            eidx = min(len(rows) - 1, sidx + k - 1)
            start_ms = int(rows[sidx].get("startMs", 0))
            end_ms = int(rows[eidx].get("endMs", start_ms + 1))
            if end_ms > start_ms:
                exact_chorus_spans.append((start_ms, end_ms))

    similar_groups: List[List[int]] = []
    for i, stanza in enumerate(stanza_payloads):
        group = [i]
        for j in range(i + 1, len(stanza_payloads)):
            sim = _stanza_similarity(stanza["lines"], stanza_payloads[j]["lines"])
            if sim >= 0.58:
                group.append(j)
        if len(group) >= 2:
            similar_groups.append(group)

    best_group: List[int] = []
    best_group_score = -1.0
    for group in similar_groups:
        spans = [stanza_payloads[idx] for idx in group]
        first_idx = min(int(row["index"]) for row in spans)
        total_lines = sum(len(row["lines"]) for row in spans)
        total_duration = sum(max(1, int(row["endMs"]) - int(row["startMs"])) for row in spans)
        coverage = len(group) / max(1.0, float(len(stanza_payloads)))
        score = (len(group) * 2.0) + (total_lines * 0.15) + (coverage * 1.5) - (first_idx * 0.1) + (total_duration / max(1.0, float(duration_ms)))
        if score > best_group_score:
            best_group = group
            best_group_score = score

    repeated_line_spans: List[tuple[int, int]] = []
    if len(stanza_payloads) <= 1:
        repeated_line_spans = _find_repeated_lyric_line_spans(rows)
    if repeated_line_spans:
        chorus_spans.extend(repeated_line_spans)
    elif exact_chorus_spans:
        chorus_spans.extend(exact_chorus_spans)
    else:
        for group_index in best_group:
            stanza = stanza_payloads[group_index]
            start_ms = int(stanza["startMs"])
            end_ms = int(stanza["endMs"])
            if end_ms > start_ms:
                chorus_spans.append((start_ms, end_ms))
    chorus_stanza_idx = set(int(idx) for idx in best_group)
    chorus_spans.sort()
    merged_chorus_spans: List[tuple[int, int]] = []
    for start_ms, end_ms in chorus_spans:
        if not merged_chorus_spans or start_ms > merged_chorus_spans[-1][1]:
            merged_chorus_spans.append((start_ms, end_ms))
        else:
            prev_start, prev_end = merged_chorus_spans[-1]
            merged_chorus_spans[-1] = (prev_start, max(prev_end, end_ms))

    def _rows_in_window(start_ms: int, end_ms: int) -> List[Dict[str, Any]]:
        return [
            row for row in rows
            if int(row.get("startMs", 0)) < end_ms and int(row.get("endMs", row.get("startMs", 0))) > start_ms
        ]

    segments: List[Dict[str, Any]] = []
    first_start = int(rows[0]["startMs"])
    if first_start > 500:
        segments.append({"startMs": 0, "endMs": first_start, "label": "Intro"})

    if merged_chorus_spans:
        prev_boundary = first_start
        chorus_count = 0
        for idx, (chorus_start, chorus_end) in enumerate(merged_chorus_spans):
            non_chorus_rows = _rows_in_window(prev_boundary, chorus_start)
            if chorus_start - prev_boundary >= 500:
                if non_chorus_rows:
                    label = "Verse"
                    if chorus_count >= 2 and idx == len(merged_chorus_spans) - 1:
                        label = "Bridge"
                    segments.append({"startMs": prev_boundary, "endMs": chorus_start, "label": label})
                else:
                    segments.append({"startMs": prev_boundary, "endMs": chorus_start, "label": "Instrumental"})
            chorus_count += 1
            segments.append({"startMs": chorus_start, "endMs": chorus_end, "label": "Chorus"})
            prev_boundary = chorus_end
        if duration_ms - prev_boundary >= 500:
            tail_rows = _rows_in_window(prev_boundary, duration_ms)
            if tail_rows:
                tail_duration = duration_ms - prev_boundary
                tail_label = "Outro" if (
                    tail_duration <= max(12000, stanza_gap_ms * 2)
                    or (
                        tail_duration <= max(24000, stanza_gap_ms * 3)
                        and _lyric_window_looks_like_outro(tail_rows)
                    )
                    or (
                        idx == len(merged_chorus_spans) - 1
                        and len(tail_rows) <= 2
                        and tail_duration <= max(20000, stanza_gap_ms * 3)
                    )
                ) else "Verse"
                segments.append({"startMs": prev_boundary, "endMs": duration_ms, "label": tail_label})
            else:
                segments.append({"startMs": prev_boundary, "endMs": duration_ms, "label": "Outro"})
    else:
        prev_end = first_start
        for idx, (a, b) in enumerate(stanzas):
            if a >= b:
                continue
            s = int(rows[a].get("startMs", 0))
            e = int(rows[b - 1].get("endMs", s + 1))
            if e <= s:
                continue
            if s - prev_end >= stanza_gap_ms:
                segments.append({"startMs": prev_end, "endMs": s, "label": "Instrumental"})
            label = "Chorus" if idx in chorus_stanza_idx else "Verse"
            segments.append({"startMs": s, "endMs": e, "label": label})
            prev_end = e

        if duration_ms - prev_end >= 500:
            tail_label = "Outro" if duration_ms - prev_end <= max(12000, stanza_gap_ms * 2) else "Instrumental"
            segments.append({"startMs": prev_end, "endMs": duration_ms, "label": tail_label})

    cleaned: List[Dict[str, Any]] = []
    for seg in sorted(segments, key=lambda x: int(x.get("startMs", 0))):
        s = max(0, int(seg.get("startMs", 0)))
        e = min(duration_ms, int(seg.get("endMs", s + 1)))
        if e <= s:
            continue
        label = str(seg.get("label", "Section")).strip() or "Section"
        if cleaned and cleaned[-1]["label"] == label and s <= int(cleaned[-1]["endMs"]):
            cleaned[-1]["endMs"] = max(int(cleaned[-1]["endMs"]), e)
        else:
            cleaned.append({"startMs": s, "endMs": e, "label": label})
    return _build_numbered_sections(cleaned)


def _first_lrc_timestamp_ms(lrc_text: str) -> Optional[int]:
    if not lrc_text:
        return None
    time_re = re.compile(r"\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]")
    first: Optional[int] = None
    for line in str(lrc_text).splitlines():
        m = time_re.search(str(line))
        if not m:
            continue
        mm = int(m.group(1))
        ss = int(m.group(2))
        frac = m.group(3) or "0"
        if len(frac) == 1:
            frac_ms = int(frac) * 100
        elif len(frac) == 2:
            frac_ms = int(frac) * 10
        else:
            frac_ms = int(frac[:3])
        ts = mm * 60000 + ss * 1000 + frac_ms
        if first is None or ts < first:
            first = ts
    return first


def _normalize_compare_text(text: str) -> str:
    value = str(text or "").lower().strip()
    value = re.sub(r"\[(.*?)\]", " ", value)
    value = re.sub(r"\((.*?)\)", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\b(single|edit|mix|version|live|feat|featuring|spotify|mp3|song|main|intro)\b", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _build_plain_phrase_windows(lines: List[str], max_window: int = 3) -> List[Dict[str, Any]]:
    windows: List[Dict[str, Any]] = []
    clean = [str(row).strip() for row in lines if _normalize_compare_text(str(row))]
    for start in range(len(clean)):
        for width in range(1, max_window + 1):
            end = start + width
            if end > len(clean):
                break
            phrase_lines = clean[start:end]
            windows.append(
                {
                    "startIndex": start,
                    "endIndex": end - 1,
                    "lineCount": len(phrase_lines),
                    "text": " ".join(phrase_lines),
                    "lines": phrase_lines,
                }
            )
    return windows


def _build_timed_phrase_windows(timed_marks: List[Dict[str, Any]], max_window: int = 3) -> List[Dict[str, Any]]:
    windows: List[Dict[str, Any]] = []
    clean = [row for row in (timed_marks or []) if _normalize_compare_text(row.get("label", ""))]
    for start in range(len(clean)):
        for width in range(1, max_window + 1):
            end = start + width
            if end > len(clean):
                break
            phrase_marks = clean[start:end]
            windows.append(
                {
                    "startIndex": start,
                    "endIndex": end - 1,
                    "lineCount": len(phrase_marks),
                    "text": " ".join(str(row.get("label", "")).strip() for row in phrase_marks),
                    "marks": phrase_marks,
                    "startMs": int(phrase_marks[0].get("startMs", 0)),
                    "endMs": int(phrase_marks[-1].get("endMs", 0)),
                }
            )
    return windows


def _nearest_boundary_delta_ms(value_ms: int, boundaries_ms: List[int]) -> Optional[int]:
    if not boundaries_ms:
        return None
    value = int(value_ms)
    return min(abs(value - int(boundary)) for boundary in boundaries_ms)


def _phrase_boundary_bonus(
    start_ms: int,
    end_ms: int,
    *,
    beat_starts_ms: Optional[List[int]] = None,
    bar_starts_ms: Optional[List[int]] = None,
    section_boundaries_ms: Optional[List[int]] = None,
) -> float:
    bonus = 0.0
    beat_starts = [int(v) for v in (beat_starts_ms or [])]
    bar_starts = [int(v) for v in (bar_starts_ms or [])]
    section_bounds = [int(v) for v in (section_boundaries_ms or [])]
    start_bar_delta = _nearest_boundary_delta_ms(start_ms, bar_starts)
    end_bar_delta = _nearest_boundary_delta_ms(end_ms, bar_starts)
    start_section_delta = _nearest_boundary_delta_ms(start_ms, section_bounds)
    end_section_delta = _nearest_boundary_delta_ms(end_ms, section_bounds)
    start_beat_delta = _nearest_boundary_delta_ms(start_ms, beat_starts)
    end_beat_delta = _nearest_boundary_delta_ms(end_ms, beat_starts)
    if start_section_delta is not None and start_section_delta <= 250:
        bonus += 0.015
    if end_section_delta is not None and end_section_delta <= 250:
        bonus += 0.01
    if start_bar_delta is not None and start_bar_delta <= 180:
        bonus += 0.01
    if end_bar_delta is not None and end_bar_delta <= 220:
        bonus += 0.008
    if start_beat_delta is not None and start_beat_delta <= 90:
        bonus += 0.004
    if end_beat_delta is not None and end_beat_delta <= 120:
        bonus += 0.004
    return bonus


def _snap_phrase_boundary_ms(
    value_ms: int,
    *,
    beat_starts_ms: Optional[List[int]] = None,
    bar_starts_ms: Optional[List[int]] = None,
    section_boundaries_ms: Optional[List[int]] = None,
    tolerance_ms: int = 250,
) -> int:
    candidates = [int(v) for v in (section_boundaries_ms or [])] + [int(v) for v in (bar_starts_ms or [])] + [int(v) for v in (beat_starts_ms or [])]
    if not candidates:
        return int(value_ms)
    target = int(value_ms)
    nearest = min(candidates, key=lambda v: abs(v - target))
    if abs(nearest - target) <= int(tolerance_ms):
        return int(nearest)
    return target


def _align_plain_lyrics_to_timed_phrases(
    plain_lines: List[str],
    timed_marks: List[Dict[str, Any]],
    *,
    beat_starts_ms: Optional[List[int]] = None,
    bar_starts_ms: Optional[List[int]] = None,
    section_segments: Optional[List[Dict[str, Any]]] = None,
    min_score: float = 0.72,
) -> List[Dict[str, Any]]:
    aligned: List[Dict[str, Any]] = []
    plain_windows = _build_plain_phrase_windows(plain_lines, max_window=3)
    timed_windows = _build_timed_phrase_windows(timed_marks, max_window=3)
    next_plain_index = 0
    next_timed_index = 0
    section_boundaries_ms = []
    for row in (section_segments or []):
        start_ms = int(row.get("startMs", 0))
        end_ms = int(row.get("endMs", start_ms))
        section_boundaries_ms.extend([start_ms, end_ms])
    while next_plain_index < len(plain_lines) and next_timed_index < len(timed_marks):
        candidate_windows = [row for row in plain_windows if row["startIndex"] == next_plain_index]
        best_match = None
        best_text_score = 0.0
        best_total_score = 0.0
        for plain_window in candidate_windows:
            pnorm = _normalize_compare_text(plain_window["text"])
            if not pnorm:
                continue
            for timed_window in timed_windows:
                if timed_window["startIndex"] < next_timed_index:
                    continue
                tnorm = _normalize_compare_text(timed_window["text"])
                if not tnorm:
                    continue
                text_score = difflib.SequenceMatcher(None, pnorm, tnorm).ratio()
                if pnorm in tnorm or tnorm in pnorm:
                    text_score = max(text_score, 0.9)
                if plain_window["lineCount"] > 1 and timed_window["lineCount"] > 1:
                    text_score = max(text_score, min(1.0, text_score + 0.005))
                boundary_bonus = _phrase_boundary_bonus(
                    int(timed_window["startMs"]),
                    int(timed_window["endMs"]),
                    beat_starts_ms=beat_starts_ms,
                    bar_starts_ms=bar_starts_ms,
                    section_boundaries_ms=section_boundaries_ms,
                )
                timing_gap = max(0, int(timed_window["startIndex"]) - int(next_timed_index))
                total_score = text_score + boundary_bonus
                if timing_gap:
                    total_score -= min(0.2, 0.015 * timing_gap)
                better_text = text_score > (best_text_score + 0.02)
                near_tie = abs(text_score - best_text_score) <= 0.02
                if better_text or (near_tie and total_score > best_total_score):
                    best_text_score = text_score
                    best_total_score = total_score
                    best_match = (plain_window, timed_window, pnorm)
        if not best_match or best_text_score < float(min_score):
            next_plain_index += 1
            continue
        plain_window, timed_window, pnorm = best_match
        snapped_start = _snap_phrase_boundary_ms(
            int(timed_window["startMs"]),
            beat_starts_ms=beat_starts_ms,
            bar_starts_ms=bar_starts_ms,
            section_boundaries_ms=section_boundaries_ms,
        )
        snapped_end = _snap_phrase_boundary_ms(
            int(timed_window["endMs"]),
            beat_starts_ms=beat_starts_ms,
            bar_starts_ms=bar_starts_ms,
            section_boundaries_ms=section_boundaries_ms,
        )
        aligned.append(
            {
                "text": plain_window["text"],
                "normalizedText": pnorm,
                "sourceLineCount": int(plain_window["lineCount"]),
                "matchedTimedText": timed_window["text"],
                "matchedTimedLineCount": int(timed_window["lineCount"]),
                "score": round(best_total_score, 4),
                "textScore": round(best_text_score, 4),
                "startMs": int(timed_window["startMs"]),
                "endMs": int(timed_window["endMs"]),
                "snappedStartMs": int(min(snapped_start, snapped_end)),
                "snappedEndMs": int(max(snapped_start, snapped_end)),
            }
        )
        next_plain_index = int(plain_window["endIndex"]) + 1
        next_timed_index = int(timed_window["endIndex"]) + 1
    return aligned


def _is_generic_lyrics_artist(artist: str) -> bool:
    value = _normalize_compare_text(artist)
    return value in {"christmas songs", "christmas carols", "traditional", "various artists"}


def _genius_retry_title_variants(title: str) -> List[str]:
    values: List[str] = []
    seen = set()

    def add(value: str) -> None:
        text = str(value or "").strip()
        if not text:
            return
        key = _normalize_compare_text(text)
        if not key or key in seen:
            return
        seen.add(key)
        values.append(text)

    add(re.sub(r"\s*\((single|edit|version|remaster[^)]*|live)\)\s*", "", title, flags=re.I))
    add(re.sub(r"\s*\(feat\.[^)]*\)\s*", "", title, flags=re.I))
    add(title)
    return values


def _lookup_genius_lrclib_retry_identity(identity: Dict[str, Any]) -> Dict[str, Any]:
    if not ENABLE_GENIUS_LRCLIB_RETRY or not GENIUS_ACCESS_TOKEN:
        return {}
    title = str(identity.get("title") or "").strip()
    artist = str(identity.get("artist") or "").strip()
    if not title:
        return {}
    lyricsgenius = _ensure_lyricsgenius()
    if not lyricsgenius:
        return {}
    try:
        genius = lyricsgenius.Genius(
            GENIUS_ACCESS_TOKEN,
            timeout=10,
            retries=1,
            sleep_time=0.2,
            remove_section_headers=True,
            skip_non_songs=True,
            excluded_terms=["(Remix)", "(Live)"],
            verbose=False,
        )
        song = None
        for candidate_title in _genius_retry_title_variants(title):
            song = genius.search_song(title=candidate_title, artist=artist or None)
            if song:
                title = candidate_title
                break
    except Exception:
        return {}
    if not song:
        return {}
    matched_title = str(getattr(song, "title", "") or "").strip()
    matched_artist = str(getattr(song, "artist", "") or "").strip()
    title_ratio = (
        difflib.SequenceMatcher(
            None,
            _normalize_compare_text(title),
            _normalize_compare_text(matched_title),
        ).ratio()
        if title and matched_title else 0.0
    )
    if title_ratio < 0.9:
        return {}
    artist_match = False
    if artist:
        artist_match = _normalize_compare_text(artist) == _normalize_compare_text(matched_artist)
        artist_match = artist_match or _normalize_compare_text(artist) in _normalize_compare_text(matched_artist)
        artist_match = artist_match or _normalize_compare_text(matched_artist) in _normalize_compare_text(artist)
        if not artist_match:
            return {}
    if not matched_artist or _is_generic_lyrics_artist(matched_artist):
        return {}
    if artist and _normalize_compare_text(title) == _normalize_compare_text(matched_title) and (
        _normalize_compare_text(artist) == _normalize_compare_text(matched_artist)
    ):
        return {}
    return {
        "title": matched_title,
        "artist": matched_artist,
        "source": "genius-lrclib-retry",
        "titleSimilarity": round(title_ratio, 3),
        "artistMatched": bool(artist_match),
        "titleOnly": not bool(artist),
    }


def _duration_delta_close_enough(duration_ms: int, info: Dict[str, Any], max_delta_ms: int = 15000) -> bool:
    try:
        lrclib_duration_sec = float(info.get("lrclibDurationSec") or 0)
    except Exception:
        lrclib_duration_sec = 0.0
    if lrclib_duration_sec <= 0 or duration_ms <= 0:
        return False
    delta_ms = abs(int(round(lrclib_duration_sec * 1000.0)) - int(duration_ms))
    return delta_ms <= int(max_delta_ms)


def _fetch_lrclib_lyrics_direct(identity: Dict[str, Any], duration_ms: int, analysis_profile: Optional[Dict[str, Any]] = None) -> tuple[List[Dict[str, Any]], str, Dict[str, Any]]:
    profile = analysis_profile or _normalize_analysis_profile("")
    if not profile.get("enableLyrics"):
        return [], "lrclib skipped: lookup disabled", {}
    title = str(identity.get("title", "")).strip()
    artist = str(identity.get("artist", "")).strip()
    album = str(identity.get("album", "")).strip()
    duration_s = int(round(max(1, duration_ms) / 1000.0))
    if not title or not artist:
        return [], "lrclib skipped: missing title/artist", {}
    try:
        selected_payload: Dict[str, Any] = {}
        params = {
            "track_name": title,
            "artist_name": artist,
            "duration": duration_s,
        }
        resp = requests.get(f"{LRCLIB_API_BASE}/get", params=params, timeout=20.0)
        if resp.status_code == 404:
            # Secondary attempt with album hint if available.
            if album:
                resp_album = requests.get(
                    f"{LRCLIB_API_BASE}/get",
                    params={**params, "album_name": album},
                    timeout=20.0,
                )
                if resp_album.status_code < 400:
                    payload = resp_album.json() if isinstance(resp_album.json(), dict) else {}
                    selected_payload = payload if isinstance(payload, dict) else {}
                else:
                    payload = {}
            else:
                payload = {}
            if not selected_payload:
                # Fallback search if direct get could not locate a record.
                search = requests.get(
                    f"{LRCLIB_API_BASE}/search",
                    params={"track_name": title, "artist_name": artist},
                    timeout=20.0,
                )
                if search.status_code >= 400:
                    return [], f"lrclib search failed: HTTP {search.status_code}", {}
                arr = search.json()
                if isinstance(arr, list) and arr:
                    # Prefer rows with synced lyrics, then closest duration.
                    best = None
                    best_key = None
                    for row in arr:
                        if not isinstance(row, dict):
                            continue
                        synced = str(row.get("syncedLyrics") or "").strip()
                        has_synced = 1 if synced else 0
                        d = int(row.get("duration") or 0)
                        delta = abs(d - duration_s) if d > 0 else 10**9
                        first_ts = _first_lrc_timestamp_ms(synced) if synced else None
                        # Avoid pathological near-zero first timestamps when better matches exist.
                        early_penalty = 1 if first_ts is not None and first_ts < 3000 else 0
                        key = (-has_synced, delta, early_penalty, str(row.get("id", "")))
                        if best is None or key < best_key:
                            best = row
                            best_key = key
                    payload = best if isinstance(best, dict) else {}
                    selected_payload = payload if isinstance(payload, dict) else {}
                else:
                    return [], "lrclib: no matches from search", {}
            else:
                payload = selected_payload
        else:
            if resp.status_code >= 400:
                return [], f"lrclib get failed: HTTP {resp.status_code}", {}
            payload = resp.json() if isinstance(resp.json(), dict) else {}
            selected_payload = payload if isinstance(payload, dict) else {}
        lrc = str(payload.get("syncedLyrics") or "").strip()
        if not lrc:
            plain = str(payload.get("plainLyrics") or "").strip()
            if plain:
                return [], "lrclib: plain lyrics available, synced timestamps unavailable", {}
            return [], "lrclib: no synced lyrics", {}
        marks = _parse_lrc_synced_lyrics(lrc, duration_ms)
        if not marks:
            return [], "lrclib: synced lyrics parse empty", {}
        info = {
            "lrclibId": str(payload.get("id", "")).strip(),
            "lrclibAlbum": str(payload.get("albumName", "")).strip(),
            "lrclibDurationSec": payload.get("duration"),
            "lrclibFirstTimestampMs": _first_lrc_timestamp_ms(lrc),
        }
        return marks, "", info
    except Exception as err:
        return [], f"lrclib fetch failed: {err}", {}


def _fetch_lrclib_lyrics(identity: Dict[str, Any], duration_ms: int, analysis_profile: Optional[Dict[str, Any]] = None) -> tuple[List[Dict[str, Any]], str, Dict[str, Any]]:
    marks, error, info = _fetch_lrclib_lyrics_direct(identity, duration_ms, analysis_profile)
    if marks:
        return marks, error, info
    retry_identity = _lookup_genius_lrclib_retry_identity(identity)
    if not retry_identity:
        return marks, error, info
    retry_marks, retry_error, retry_info = _fetch_lrclib_lyrics_direct(
        {"title": retry_identity.get("title"), "artist": retry_identity.get("artist")},
        duration_ms,
        analysis_profile,
    )
    if retry_marks:
        if not _duration_delta_close_enough(duration_ms, retry_info):
            merged_error = error
            duration_error = "genius retry: lrclib duration mismatch"
            if duration_error:
                merged_error = f"{error} | {duration_error}" if error else duration_error
            return marks, merged_error, info
        merged_info = {
            **retry_info,
            "lyricsRetrySource": str(retry_identity.get("source") or "genius-lrclib-retry"),
            "lyricsRetryMatchedTitle": str(retry_identity.get("title") or "").strip(),
            "lyricsRetryMatchedArtist": str(retry_identity.get("artist") or "").strip(),
            "lyricsRetryTitleSimilarity": retry_identity.get("titleSimilarity"),
            "lyricsRetryTitleOnly": bool(retry_identity.get("titleOnly")),
        }
        return retry_marks, "", merged_info
    merged_error = error
    if retry_error:
        merged_error = f"{error} | genius retry: {retry_error}" if error else f"genius retry: {retry_error}"
    return marks, merged_error, info


def _identify_track_with_audd(path: str, analysis_profile: Optional[Dict[str, Any]] = None) -> tuple[Dict[str, Any], bool]:
    profile = analysis_profile or _normalize_analysis_profile("")
    fingerprint = _audio_fingerprint(path)
    cached = _identity_cache_get(fingerprint)
    # Always prefer cached identity for the same audio fingerprint to avoid
    # repeated AudD usage on subsequent analyses of the same track.
    if cached:
        return cached, True
    if not profile.get("enableRemoteIdentity"):
        return {}, False
    if not AUDD_API_TOKEN:
        return {}, False
    with open(path, "rb") as fh:
        files = {"file": fh}
        data = {"api_token": AUDD_API_TOKEN}
        resp = requests.post(AUDD_API_URL, data=data, files=files, timeout=45.0)
    resp.raise_for_status()
    body = resp.json()
    if not isinstance(body, dict):
        return {}, False
    result = body.get("result")
    if not isinstance(result, dict):
        if cached:
            return cached, True
        return {}, False
    # AudD can expose ISRC either at top-level result or under provider-specific payloads.
    isrc = str(result.get("isrc", "")).strip()
    if not isrc:
        spotify = result.get("spotify")
        if isinstance(spotify, dict):
            external_ids = spotify.get("external_ids")
            if isinstance(external_ids, dict):
                isrc = str(external_ids.get("isrc", "")).strip()
    if not isrc:
        apple_music = result.get("apple_music")
        if isinstance(apple_music, dict):
            isrc = str(apple_music.get("isrc", "")).strip()
    if not isrc:
        deezer = result.get("deezer")
        if isinstance(deezer, dict):
            isrc = str(deezer.get("isrc", "")).strip()
    identity = _normalize_identity(
        {
            "provider": "audd",
            "title": str(result.get("title", "")).strip(),
            "artist": str(result.get("artist", "")).strip(),
            "album": str(result.get("album", "")).strip(),
            "releaseDate": str(result.get("release_date", "")).strip(),
            "isrc": isrc,
        }
    )
    if not identity and cached:
        return cached, True
    _identity_cache_put(fingerprint, identity)
    return identity, False


def _bars_from_beats(beats: List[Dict[str, Any]], beats_per_bar: int = 4) -> List[Dict[str, Any]]:
    if beats_per_bar <= 0:
        beats_per_bar = 4
    bars: List[Dict[str, Any]] = []
    for i in range(0, len(beats) - beats_per_bar + 1, beats_per_bar):
        first = beats[i]
        last = beats[i + beats_per_bar - 1]
        nxt = beats[i + beats_per_bar] if i + beats_per_bar < len(beats) else None
        start = int(first["startMs"])
        end = int(nxt["startMs"]) if nxt else int(last.get("endMs", start + 1))
        if end <= start:
            end = start + 1
        bars.append({"startMs": start, "endMs": end, "label": str(len(bars) + 1)})
    return bars


def _bars_from_downbeats(
    beats: List[Dict[str, Any]],
    downbeat_starts: List[int],
    duration_ms: int,
) -> List[Dict[str, Any]]:
    starts = sorted(set(int(x) for x in downbeat_starts if int(x) >= 0))
    if len(starts) < 2:
        return _bars_from_beats(beats, DEFAULT_BEATS_PER_BAR)
    bars: List[Dict[str, Any]] = []
    for i, s in enumerate(starts):
        if i + 1 < len(starts):
            e = int(starts[i + 1])
        else:
            e = int(duration_ms)
        if e <= s:
            continue
        bars.append({"startMs": s, "endMs": e, "label": str(len(bars) + 1)})
    return _sanitize_marks(bars)


def _build_chord_templates() -> List[tuple[str, np.ndarray]]:
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    out: List[tuple[str, np.ndarray]] = []
    for i, root in enumerate(names):
        maj = np.zeros(12, dtype=float)
        maj[i] = 1.0
        maj[(i + 4) % 12] = 0.8
        maj[(i + 7) % 12] = 0.7
        minv = np.zeros(12, dtype=float)
        minv[i] = 1.0
        minv[(i + 3) % 12] = 0.8
        minv[(i + 7) % 12] = 0.7
        out.append((root, maj / max(1e-9, np.linalg.norm(maj))))
        out.append((f"{root}m", minv / max(1e-9, np.linalg.norm(minv))))
    return out


CHORD_TEMPLATES = _build_chord_templates()


def _normalize_madmom_chord_label(raw: Any) -> str:
    text = str(raw or "").strip()
    if not text:
        return "N"
    upper = text.upper()
    if upper == "N":
        return "N"
    if ":" not in text:
        return text
    root, quality = text.split(":", 1)
    root = root.strip()
    q = quality.strip().lower()
    if q.startswith("maj"):
        return root
    if q.startswith("min"):
        return f"{root}m"
    return root


def _merge_adjacent_label_marks(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    for row in rows:
        label = str(row.get("label", "")).strip()
        start = int(row.get("startMs", 0))
        end = int(row.get("endMs", start + 1))
        if end <= start:
            continue
        if merged and str(merged[-1].get("label", "")).strip() == label:
            merged[-1]["endMs"] = max(int(merged[-1].get("endMs", start)), end)
        else:
            merged.append({"startMs": start, "endMs": end, "label": label})
    return merged


def _detect_chords_madmom(
    y: np.ndarray,
    sr: int,
    duration_ms: int,
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    _ensure_madmom_chords()
    _ensure_librosa()
    if CNNChordFeatureProcessor is None or CRFChordRecognitionProcessor is None or MadmomSignal is None:
        return [], {"engine": "none", "error": "madmom chord processors unavailable"}
    if not isinstance(y, np.ndarray) or y.size == 0:
        return [], {"engine": "none", "error": "empty waveform"}

    try:
        y_in = np.asarray(y, dtype=np.float32)
        sr_in = int(sr)
        # madmom chord models are calibrated for 44.1kHz input.
        if sr_in != 44100 and librosa is not None:
            y_in = librosa.resample(y_in, orig_sr=sr_in, target_sr=44100)
            sr_in = 44100
        sig = MadmomSignal(y_in, sample_rate=sr_in, num_channels=1)
        feat = CNNChordFeatureProcessor()
        decode = CRFChordRecognitionProcessor()
        seq = decode(feat(sig))
        rows: List[Dict[str, Any]] = []
        for item in list(seq):
            try:
                start_ms = int(round(float(item[0]) * 1000.0))
                end_ms = int(round(float(item[1]) * 1000.0))
                label = _normalize_madmom_chord_label(item[2])
            except Exception:
                continue
            start_ms = max(0, min(int(duration_ms) - 1, start_ms))
            end_ms = max(start_ms + 1, min(int(duration_ms), end_ms))
            if (end_ms - start_ms) < 250:
                continue
            rows.append({"startMs": start_ms, "endMs": end_ms, "label": label})
        rows = _sanitize_marks(_merge_adjacent_label_marks(rows))
        labeled = [r for r in rows if str(r.get("label", "")).strip().upper() != "N"]
        labeled_ratio = float(len(labeled) / max(1, len(rows)))
        if not labeled:
            return [], {
                "engine": "madmom-crf-chords-v1",
                "timelineAligned": False,
                "chordMarkCount": int(len(rows)),
                "labeledRatio": round(labeled_ratio, 4),
                "error": "madmom produced no labeled chords",
            }
        return rows, {
            "engine": "madmom-crf-chords-v1",
            "timelineAligned": False,
            "chordMarkCount": int(len(rows)),
            "labeledRatio": round(labeled_ratio, 4),
            "avgMarginConfidence": None,
        }
    except Exception as err:
        return [], {"engine": "madmom-crf-chords-v1", "error": str(err)}


def _detect_chords(
    y: np.ndarray,
    sr: int,
    duration_ms: int,
    analysis_profile: Optional[Dict[str, Any]] = None,
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    profile = analysis_profile or _normalize_analysis_profile("")
    if not profile.get("enableMadmomChords"):
        chords_fb, meta_fb = _detect_chords_independent(y, sr, duration_ms)
        meta_fb["engine"] = str(meta_fb.get("engine") or "librosa-chroma-template")
        meta_fb["madmomDisabled"] = True
        return chords_fb, meta_fb
    # Preferred path: madmom CRF chord recognizer from WAV (better full-song stability).
    chords, meta = _detect_chords_madmom(y, sr, duration_ms)
    if chords:
        return chords, meta
    madmom_error = str(meta.get("error", "")).strip() if isinstance(meta, dict) else ""

    # Fallback path: lightweight chroma/template chord estimate.
    chords_fb, meta_fb = _detect_chords_independent(y, sr, duration_ms)
    if madmom_error:
        base = str(meta_fb.get("error", "")).strip() if isinstance(meta_fb, dict) else ""
        meta_fb["error"] = f"{base} | madmom: {madmom_error}" if base else f"madmom: {madmom_error}"
    return chords_fb, meta_fb


def _classify_chord_profile(profile: np.ndarray) -> tuple[str, float, float]:
    norm = float(np.linalg.norm(profile))
    if not np.isfinite(norm) or norm <= 0:
        return "N", 0.0, 0.0
    p = profile / norm
    scored: List[tuple[str, float]] = []
    for label, tpl in CHORD_TEMPLATES:
        score = float(np.dot(p, tpl))
        if np.isfinite(score):
            scored.append((label, score))
    if not scored:
        return "N", 0.0, 0.0
    scored.sort(key=lambda x: x[1], reverse=True)
    best_label, best_score = scored[0]
    second_score = scored[1][1] if len(scored) > 1 else -1.0
    margin = float(best_score - second_score)
    out_label = best_label if (best_score >= 0.35 and margin >= 0.03) else "N"
    return out_label, max(0.0, margin), max(0.0, float(best_score))


def _build_chord_rows_from_labels(
    labels: List[str],
    starts_ms: List[int],
    duration_ms: int,
    min_segment_ms: int = 250,
) -> tuple[List[Dict[str, Any]], List[float], float]:
    rows: List[Dict[str, Any]] = []
    if not labels or not starts_ms:
        return rows, [], 0.0
    n = min(len(labels), len(starts_ms))
    if n <= 0:
        return rows, [], 0.0
    i = 0
    while i < n:
        label = str(labels[i] or "N").strip() or "N"
        j = i + 1
        while j < n and str(labels[j] or "N").strip() == label:
            j += 1
        start_ms = max(0, min(int(duration_ms) - 1, int(starts_ms[i])))
        if j < n:
            end_ms = int(starts_ms[j])
        else:
            end_ms = int(duration_ms)
        end_ms = max(start_ms + 1, min(int(duration_ms), end_ms))
        if (end_ms - start_ms) >= int(max(1, min_segment_ms)):
            rows.append({"startMs": start_ms, "endMs": end_ms, "label": label})
        i = j

    merged: List[Dict[str, Any]] = []
    for row in rows:
        cur_label = str(row.get("label", "")).strip()
        prev_label = str(merged[-1].get("label", "")).strip() if merged else ""
        if merged and cur_label == prev_label:
            merged[-1]["endMs"] = int(row.get("endMs", merged[-1].get("endMs", 0)))
        else:
            merged.append(dict(row))

    clean = _sanitize_marks(merged)
    non_n = [r for r in clean if str(r.get("label", "")).strip().upper() != "N"]
    labeled_ratio = float(len(non_n) / max(1, len(clean)))
    return clean, [], labeled_ratio


def _detect_chords_independent(
    y: np.ndarray,
    sr: int,
    duration_ms: int,
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    confidences: List[float] = []
    if librosa is None or not isinstance(y, np.ndarray) or y.size == 0:
        return [], {"engine": "none", "error": "librosa unavailable for chord extraction"}
    hop = 512
    try:
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    except Exception as err:
        return [], {"engine": "none", "error": f"chroma_cqt failed: {err}"}
    if not isinstance(chroma, np.ndarray) or chroma.size == 0 or chroma.shape[1] < 2:
        return [], {"engine": "none", "error": "insufficient chroma frames"}

    frame_starts = [
        int(round(v))
        for v in (librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=hop) * 1000.0)
    ]
    labels: List[str] = []
    margins: List[float] = []
    for i in range(chroma.shape[1]):
        out_label, margin, best_score = _classify_chord_profile(np.asarray(chroma[:, i], dtype=float))
        labels.append(out_label)
        margins.append(margin)
        if out_label != "N":
            confidences.append(max(0.0, margin * best_score))

    # Majority smoothing over a tiny window reduces jitter without forcing bar alignment.
    smooth = list(labels)
    for i in range(1, len(labels) - 1):
        a, b, c = labels[i - 1], labels[i], labels[i + 1]
        if a == c and b != a:
            smooth[i] = a
    labels = smooth

    clean, _, labeled_ratio = _build_chord_rows_from_labels(labels, frame_starts, duration_ms, min_segment_ms=250)
    confidence = float(np.mean(np.asarray(confidences, dtype=float))) if confidences else 0.0
    if confidence < 0.08 or labeled_ratio < 0.35:
        return [], {
            "engine": "librosa-chroma-template-v2-independent",
            "timelineAligned": False,
            "chordMarkCount": int(len(clean)),
            "avgMarginConfidence": round(confidence, 4),
            "labeledRatio": round(labeled_ratio, 4),
            "error": "low-confidence chord estimate",
        }
    return clean, {
        "engine": "librosa-chroma-template-v2-independent",
        "timelineAligned": False,
        "chordMarkCount": int(len(clean)),
        "avgMarginConfidence": round(confidence, 4),
        "labeledRatio": round(labeled_ratio, 4),
    }


def _detect_chords_from_beats(
    y: np.ndarray,
    sr: int,
    duration_ms: int,
    beat_starts_ms: List[int],
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if librosa is None or not isinstance(y, np.ndarray) or y.size == 0:
        return [], {"engine": "none", "error": "librosa unavailable for chord extraction"}
    starts = sorted({int(x) for x in (beat_starts_ms or []) if 0 <= int(x) < int(duration_ms)})
    if len(starts) < 8:
        return _detect_chords_independent(y, sr, duration_ms)
    hop = 512
    try:
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    except Exception as err:
        return [], {"engine": "none", "error": f"chroma_cqt failed: {err}"}
    if not isinstance(chroma, np.ndarray) or chroma.size == 0 or chroma.shape[1] < 2:
        return [], {"engine": "none", "error": "insufficient chroma frames"}

    beat_sec = np.asarray(starts, dtype=float) / 1000.0
    beat_frames = librosa.time_to_frames(beat_sec, sr=sr, hop_length=hop)
    beat_frames = np.asarray(sorted(set(int(max(0, f)) for f in beat_frames.tolist())), dtype=int)
    max_frame = int(chroma.shape[1] - 1)
    beat_frames = beat_frames[(beat_frames >= 0) & (beat_frames <= max_frame)]
    if beat_frames.size < 2:
        return _detect_chords_independent(y, sr, duration_ms)
    try:
        sync = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
    except Exception:
        return _detect_chords_independent(y, sr, duration_ms)
    if not isinstance(sync, np.ndarray) or sync.size == 0:
        return _detect_chords_independent(y, sr, duration_ms)

    seg_count = min(sync.shape[1], len(starts))
    labels: List[str] = []
    confidences: List[float] = []
    for i in range(seg_count):
        out_label, margin, best_score = _classify_chord_profile(np.asarray(sync[:, i], dtype=float))
        labels.append(out_label)
        if out_label != "N":
            confidences.append(max(0.0, margin * best_score))

    # Smooth single-beat flips.
    smooth = list(labels)
    for i in range(1, len(labels) - 1):
        a, b, c = labels[i - 1], labels[i], labels[i + 1]
        if a == c and b != a:
            smooth[i] = a
    labels = smooth

    clean, _, labeled_ratio = _build_chord_rows_from_labels(
        labels,
        starts[:len(labels)],
        duration_ms,
        min_segment_ms=350,
    )
    confidence = float(np.mean(np.asarray(confidences, dtype=float))) if confidences else 0.0
    if confidence < 0.08 or labeled_ratio < 0.35:
        return [], {
            "engine": "librosa-chroma-template-v3-beat-synchronous",
            "timelineAligned": "beat",
            "chordMarkCount": int(len(clean)),
            "avgMarginConfidence": round(confidence, 4),
            "labeledRatio": round(labeled_ratio, 4),
            "error": "low-confidence chord estimate",
        }
    return clean, {
        "engine": "librosa-chroma-template-v3-beat-synchronous",
        "timelineAligned": "beat",
        "chordMarkCount": int(len(clean)),
        "avgMarginConfidence": round(confidence, 4),
        "labeledRatio": round(labeled_ratio, 4),
    }


def _align_sections_to_bar_starts(
    sections: List[Dict[str, Any]],
    bars: List[Dict[str, Any]],
    duration_ms: int,
) -> List[Dict[str, Any]]:
    rows = [dict(s) for s in (sections or []) if isinstance(s, dict) and "startMs" in s]
    if not rows or not bars:
        return _sanitize_marks(rows)
    boundaries = sorted(set([0] + [int(b.get("startMs", 0)) for b in bars if int(b.get("startMs", 0)) >= 0]))
    if not boundaries:
        return _sanitize_marks(rows)

    rows.sort(key=lambda r: int(r.get("startMs", 0)))
    snapped: List[Dict[str, Any]] = []
    prev_start = -1
    for idx, row in enumerate(rows):
        orig_start = int(row.get("startMs", 0))
        label = str(row.get("label", "")).strip()

        if idx == 0 and orig_start <= boundaries[0]:
            start = 0
        else:
            # snap to nearest bar start
            start = min(boundaries, key=lambda x: abs(x - orig_start))
        if start <= prev_start:
            nxt = next((b for b in boundaries if b > prev_start), None)
            if nxt is None:
                continue
            start = int(nxt)
        snapped.append({"startMs": int(start), "label": label})
        prev_start = int(start)

    out: List[Dict[str, Any]] = []
    for i, row in enumerate(snapped):
        start = int(row["startMs"])
        if i + 1 < len(snapped):
            end = int(snapped[i + 1]["startMs"])
        else:
            end = int(duration_ms)
        if end <= start:
            continue
        next_row: Dict[str, Any] = {"startMs": start, "endMs": end}
        if row.get("label"):
            next_row["label"] = str(row["label"]).strip()
        out.append(next_row)
    return _sanitize_marks(out)


def _downbeats_from_labeled_beats(beats: List[Dict[str, Any]]) -> List[int]:
    out: List[int] = []
    for row in (beats or []):
        try:
            label = str(row.get("label", "")).strip()
            if label != "1":
                continue
            s = int(row.get("startMs", 0))
            if s >= 0:
                out.append(s)
        except Exception:
            continue
    return sorted(set(out))


def _derive_bars_from_labeled_beats(
    beats: List[Dict[str, Any]],
    duration_ms: int,
    beats_per_bar: int,
) -> List[Dict[str, Any]]:
    downbeats = _downbeats_from_labeled_beats(beats)
    if len(downbeats) >= 2:
        return _bars_from_downbeats(beats, downbeats, duration_ms)
    return _bars_from_beats(beats, beats_per_bar)


def _estimate_bpm_from_beat_starts(beat_starts_ms: List[int]) -> Optional[float]:
    if len(beat_starts_ms) < 2:
        return None
    diffs = np.diff(np.asarray(beat_starts_ms, dtype=float))
    med = float(np.median(diffs)) if diffs.size else 0.0
    if med <= 0:
        return None
    return round(60000.0 / med, 2)


def _median_beat_ms_from_starts(beat_starts_ms: List[int]) -> Optional[float]:
    if len(beat_starts_ms) < 2:
        return None
    diffs = [int(b) - int(a) for a, b in zip(beat_starts_ms, beat_starts_ms[1:]) if int(b) > int(a)]
    if not diffs:
        return None
    return float(np.median(np.asarray(diffs, dtype=float)))


def _detect_madmom_downbeat_summary(y: np.ndarray, sr: int, duration_ms: int, analysis_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = analysis_profile or _normalize_analysis_profile("")
    if not profile.get("enableMadmomDownbeatCrosscheck"):
        return {"enabled": False, "available": False, "reason": "disabled"}
    _ensure_madmom_chords()
    if MadmomSignal is None or RNNDownBeatProcessor is None or DBNDownBeatTrackingProcessor is None:
        return {"enabled": True, "available": False, "reason": "madmom_unavailable"}

    try:
        signal = MadmomSignal(y.astype("float32"), sample_rate=sr, num_channels=1)
        activations = RNNDownBeatProcessor()(signal)
        tracker = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)
        result = tracker(activations)
    except Exception as err:
        return {"enabled": True, "available": False, "reason": str(err)}

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
    if not beat_starts_ms:
        return {"enabled": True, "available": False, "reason": "no_beats"}

    detected_bpb = max(1, max(beat_flags)) if beat_flags else DEFAULT_BEATS_PER_BAR
    beats_out: List[Dict[str, Any]] = []
    for i, start in enumerate(beat_starts_ms):
        if i + 1 < len(beat_starts_ms):
            end = int(beat_starts_ms[i + 1])
        else:
            step = int(round(_median_beat_ms_from_starts(beat_starts_ms) or 500))
            end = min(duration_ms, start + max(1, step))
        beats_out.append({"startMs": int(start), "endMs": max(int(start) + 1, int(end))})

    beats_out = _label_beats_from_downbeats(beats_out, downbeat_starts, detected_bpb)
    beats_out = _sanitize_marks(beats_out)
    bars_out = _derive_bars_from_labeled_beats(beats_out, duration_ms, detected_bpb)

    return {
        "enabled": True,
        "available": True,
        "provider": "madmom_downbeat",
        "timeSignature": f"{detected_bpb}/4",
        "beatsPerBar": int(detected_bpb),
        "beatCount": len(beats_out),
        "barCount": len(bars_out),
        "downbeatCount": len([row for row in beats_out if str(row.get("label", "")).strip() == "1"]),
        "bpm": _estimate_bpm_from_beat_starts([int(row["startMs"]) for row in beats_out]),
        "medianBeatMs": _median_beat_ms_from_starts([int(row["startMs"]) for row in beats_out]),
        "beats": beats_out,
        "bars": bars_out,
    }


def _summarize_secondary_rhythm(candidate: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(candidate, dict):
        return {"enabled": False, "available": False, "reason": "invalid"}
    summary = dict(candidate)
    summary.pop("beats", None)
    summary.pop("bars", None)
    return summary


def _build_rhythm_provider_results(
    *,
    primary_provider: str,
    primary_beats_per_bar: int,
    primary_time_signature: str,
    primary_bpm: Optional[float],
    primary_beats: List[Dict[str, Any]],
    primary_bars: List[Dict[str, Any]],
    secondary_candidate: Dict[str, Any],
    selected_provider: str,
) -> Dict[str, Any]:
    primary_summary = {
        "provider": str(primary_provider or "unknown"),
        "available": True,
        "selected": str(selected_provider or "") == str(primary_provider or ""),
        "beatsPerBar": int(primary_beats_per_bar),
        "timeSignature": str(primary_time_signature or ""),
        "bpm": float(primary_bpm) if primary_bpm is not None else None,
        "beatCount": len(primary_beats or []),
        "barCount": len(primary_bars or []),
        "beats": _sanitize_marks(primary_beats or []),
        "bars": _sanitize_marks(primary_bars or []),
    }
    secondary_full = dict(secondary_candidate) if isinstance(secondary_candidate, dict) else {}
    secondary_provider = str(secondary_full.get("provider") or "madmom_downbeat")
    secondary_available = bool(secondary_full.get("available"))
    if secondary_available:
        secondary_full["selected"] = str(selected_provider or "") == secondary_provider
        secondary_full["beats"] = _sanitize_marks(secondary_full.get("beats") or [])
        secondary_full["bars"] = _sanitize_marks(secondary_full.get("bars") or [])
    else:
        secondary_full = {
            "provider": secondary_provider,
            "enabled": bool(secondary_full.get("enabled")),
            "available": False,
            "selected": False,
            "reason": str(secondary_full.get("reason") or "unavailable"),
        }

    return {
        "selectedProvider": str(selected_provider or primary_provider or "unknown"),
        "providers": {
            str(primary_provider or "unknown"): primary_summary,
            secondary_provider: secondary_full,
        },
    }


def _build_harmony_provider_results(
    *,
    chord_meta: Dict[str, Any],
    chords: List[Dict[str, Any]],
) -> Dict[str, Any]:
    meta = dict(chord_meta) if isinstance(chord_meta, dict) else {}
    provider = str(meta.get("engine") or "unknown")
    provider_summary = {
        **meta,
        "provider": provider,
        "available": bool(chords),
        "selected": True,
        "chordCount": len(chords or []),
        "chords": _sanitize_marks(chords or []),
    }
    return {
        "selectedProvider": provider,
        "providers": {
            provider: provider_summary
        }
    }


def _build_lyrics_provider_results(
    *,
    lyrics_source: str,
    lyrics_error: str,
    lyrics_shift_ms: int,
    lyrics_info: Dict[str, Any],
    lyrics_marks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    source = str(lyrics_source or "none")
    info = dict(lyrics_info) if isinstance(lyrics_info, dict) else {}
    provider_summary = {
        **info,
        "provider": source,
        "available": bool(lyrics_marks),
        "selected": True,
        "lineCount": len(lyrics_marks or []),
        "globalShiftMs": int(lyrics_shift_ms or 0),
        "error": str(lyrics_error or info.get("error") or "").strip(),
        "lines": _sanitize_marks(lyrics_marks or []),
    }
    return {
        "selectedProvider": source,
        "providers": {
            source: provider_summary
        }
    }


def _resolve_lyrics_source(lyrics_marks: List[Dict[str, Any]], lyrics_info: Dict[str, Any]) -> str:
    if not lyrics_marks:
        return "none"
    retry_source = str((lyrics_info or {}).get("lyricsRetrySource") or "").strip()
    if retry_source:
        return f"lrclib+{retry_source}"
    return "lrclib"


def _should_prefer_secondary_meter(
    *,
    primary_beats_per_bar: int,
    primary_beat_count: int,
    primary_bpm: Optional[float],
    secondary_candidate: Dict[str, Any],
) -> bool:
    if not isinstance(secondary_candidate, dict):
        return False
    if not secondary_candidate.get("available"):
        return False
    secondary_bpb = int(secondary_candidate.get("beatsPerBar") or 0)
    if int(primary_beats_per_bar) != 4 or secondary_bpb != 3:
        return False
    secondary_bpm = secondary_candidate.get("bpm")
    if primary_bpm is None or secondary_bpm is None:
        return False
    bpm_delta = abs(float(primary_bpm) - float(secondary_bpm))
    if bpm_delta > 2.0:
        return False
    secondary_beat_count = int(secondary_candidate.get("beatCount") or 0)
    if primary_beat_count <= 0 or secondary_beat_count <= 0:
        return False
    beat_ratio = secondary_beat_count / float(primary_beat_count)
    if beat_ratio < 0.9 or beat_ratio > 1.1:
        return False
    return True


def _build_rhythm_provider_agreement(
    *,
    primary_provider: str,
    primary_beats_per_bar: int,
    primary_time_signature: str,
    primary_bpm: Optional[float],
    secondary_summary: Dict[str, Any],
) -> Dict[str, Any]:
    enabled = bool(secondary_summary.get("enabled"))
    available = bool(secondary_summary.get("available"))
    secondary_bpb = int(secondary_summary.get("beatsPerBar") or 0) if available else 0
    secondary_sig = str(secondary_summary.get("timeSignature") or "") if available else ""
    secondary_bpm = secondary_summary.get("bpm") if available else None
    primary_bpm_num = float(primary_bpm) if primary_bpm is not None else None
    secondary_bpm_num = float(secondary_bpm) if secondary_bpm is not None else None
    bpm_delta = None
    if primary_bpm_num is not None and secondary_bpm_num is not None:
        bpm_delta = round(abs(primary_bpm_num - secondary_bpm_num), 2)

    return {
        "enabled": enabled,
        "available": available,
        "primaryProvider": str(primary_provider),
        "secondaryProvider": str(secondary_summary.get("provider") or "madmom_downbeat"),
        "primary": {
            "beatsPerBar": int(primary_beats_per_bar),
            "timeSignature": str(primary_time_signature),
            "bpm": primary_bpm_num,
        },
        "secondary": secondary_summary if available else {
            "reason": str(secondary_summary.get("reason") or "unavailable")
        },
        "agreedOnBeatsPerBar": bool(available and secondary_bpb == int(primary_beats_per_bar)),
        "agreedOnTimeSignature": bool(available and secondary_sig == str(primary_time_signature)),
        "bpmDelta": bpm_delta,
    }


def _label_beats_from_downbeats(
    beats: List[Dict[str, Any]],
    downbeat_starts: List[int],
    beats_per_bar: int,
) -> List[Dict[str, Any]]:
    rows = [dict(b) for b in (beats or []) if isinstance(b, dict) and "startMs" in b]
    if not rows:
        return rows
    bpb = max(1, int(beats_per_bar or 4))
    beat_starts = [int(r.get("startMs", 0)) for r in rows]
    unique_downbeats = sorted(set(int(x) for x in (downbeat_starts or [])))

    # Map downbeat timestamps to nearest beat indices.
    anchor_indices: set[int] = set()
    for db in unique_downbeats:
        best_idx = -1
        best_delta = 10**9
        for i, s in enumerate(beat_starts):
            d = abs(s - db)
            if d < best_delta:
                best_delta = d
                best_idx = i
        if best_idx >= 0 and best_delta <= 300:
            anchor_indices.add(best_idx)
    if not anchor_indices:
        for i, row in enumerate(rows):
            row["label"] = str((i % bpb) + 1)
        return rows

    labels = [0] * len(rows)

    # Forward pass: reset to 1 on each anchored downbeat, otherwise increment.
    prev = 0
    for i in range(len(rows)):
        if i in anchor_indices:
            labels[i] = 1
            prev = 1
        else:
            if prev <= 0:
                labels[i] = 0
            else:
                prev = (prev % bpb) + 1
                labels[i] = prev

    # Backfill before first anchor so pickup beats are phase-correct.
    first_anchor = min(anchor_indices)
    if labels[first_anchor] != 1:
        labels[first_anchor] = 1
    for i in range(first_anchor - 1, -1, -1):
        nxt = labels[i + 1] if labels[i + 1] > 0 else 1
        labels[i] = bpb if nxt == 1 else nxt - 1

    # Fill any remaining zeros forward.
    for i in range(len(labels)):
        if labels[i] <= 0:
            prev_label = labels[i - 1] if i > 0 else 1
            labels[i] = (prev_label % bpb) + 1

    for i, row in enumerate(rows):
        row["label"] = str(labels[i])
    return rows


def _downbeat_anchor_indices(beat_starts: List[int], downbeat_starts: List[int]) -> List[int]:
    anchors: List[int] = []
    unique_downbeats = sorted(set(int(x) for x in (downbeat_starts or [])))
    if not beat_starts or not unique_downbeats:
        return anchors
    for db in unique_downbeats:
        best_idx = -1
        best_delta = 10**9
        for i, s in enumerate(beat_starts):
            d = abs(int(s) - int(db))
            if d < best_delta:
                best_delta = d
                best_idx = i
        if best_idx >= 0 and best_delta <= 300:
            anchors.append(best_idx)
    return sorted(set(anchors))


def _estimate_beats_per_bar(
    beat_starts: List[int],
    downbeat_starts: List[int],
    default_bpb: int = DEFAULT_BEATS_PER_BAR,
) -> int:
    anchors = _downbeat_anchor_indices(beat_starts, downbeat_starts)
    if len(anchors) < 2:
        return max(1, int(default_bpb or 4))
    intervals: List[int] = []
    for i in range(len(anchors) - 1):
        interval = int(anchors[i + 1] - anchors[i])
        if 2 <= interval <= 12:
            intervals.append(interval)
    if len(intervals) < 2:
        return max(1, int(default_bpb or 4))
    counts: Dict[int, int] = {}
    for val in intervals:
        counts[val] = counts.get(val, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], abs(kv[0] - int(default_bpb or 4))))
    return int(ranked[0][0]) if ranked else max(1, int(default_bpb or 4))


def _beats_per_bar_from_phase_values(phase_values: List[float]) -> int:
    ints: List[int] = []
    for raw in (phase_values or []):
        try:
            val = float(raw)
        except Exception:
            continue
        rounded = int(round(val))
        if rounded < 1 or rounded > 12:
            continue
        if abs(val - rounded) > 0.2:
            continue
        ints.append(rounded)
    if len(ints) < 16:
        return 0
    uniq = sorted(set(ints))
    if not uniq:
        return 0
    max_phase = int(max(uniq))
    if max_phase < 2:
        return 0
    present_ratio = len(uniq) / float(max_phase)
    return max_phase if present_ratio >= 0.66 else 0


def _best_accent_phase(
    beat_starts_ms: List[int],
    y: np.ndarray,
    sr: int,
    beats_per_bar: int,
) -> tuple[int, float]:
    bpb = int(beats_per_bar)
    if bpb < 2 or len(beat_starts_ms) < bpb * 6:
        return 0, -1.0
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    if onset_env.size <= 0:
        return 0, -1.0
    frame_times = librosa.times_like(onset_env, sr=sr)
    accents: List[float] = []
    for ms in beat_starts_ms:
        t = max(0.0, float(ms) / 1000.0)
        idx = int(np.searchsorted(frame_times, t, side="left"))
        lo = max(0, idx - 1)
        hi = min(len(onset_env), idx + 2)
        if hi <= lo:
            accents.append(0.0)
        else:
            accents.append(float(np.max(onset_env[lo:hi])))
    arr = np.asarray(accents, dtype=float)
    if arr.size < bpb * 6:
        return 0, -1.0
    arr = (arr - float(np.mean(arr))) / (float(np.std(arr)) + 1e-6)
    indices = np.arange(arr.size)
    best_offset = 0
    best_score = -1.0
    for offset in range(bpb):
        phase_vals = arr[(indices % bpb) == offset]
        other_vals = arr[(indices % bpb) != offset]
        if phase_vals.size < 4 or other_vals.size < 4:
            continue
        score = float(np.mean(phase_vals) - np.mean(other_vals))
        if score > best_score:
            best_score = score
            best_offset = offset
    return best_offset, best_score


def _beat_times_from_librosa(y: np.ndarray, sr: int, duration_ms: int) -> List[int]:
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    _ = tempo
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    out: List[int] = []
    for t in beat_times:
        ms = int(round(float(t) * 1000.0))
        if 0 <= ms < duration_ms:
            out.append(ms)
    return sorted(set(out))


def _beat_quality_metrics(beat_times_ms: List[int], y: np.ndarray, sr: int, duration_ms: int) -> Dict[str, float]:
    if len(beat_times_ms) < 8:
        return {
            "score": -1.0,
            "onsetZ": -1.0,
            "jumpRatio": 1.0,
            "coverageRatio": 0.0,
            "intervalCv": 10.0,
        }
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    frame_times = librosa.times_like(onset_env, sr=sr)
    aligned: List[float] = []
    for ms in beat_times_ms:
        t = max(0.0, float(ms) / 1000.0)
        idx = int(np.searchsorted(frame_times, t, side="left"))
        lo = max(0, idx - 1)
        hi = min(len(onset_env), idx + 2)
        if hi <= lo:
            aligned.append(0.0)
        else:
            aligned.append(float(np.max(onset_env[lo:hi])))
    aligned_arr = np.asarray(aligned, dtype=float)
    onset_mean = float(np.mean(onset_env)) if onset_env.size else 0.0
    onset_std = float(np.std(onset_env)) if onset_env.size else 1.0
    onset_z = (float(np.mean(aligned_arr)) - onset_mean) / max(1e-6, onset_std)

    diffs = np.diff(np.asarray(beat_times_ms, dtype=float))
    diffs = diffs[diffs > 1.0]
    if diffs.size == 0:
        return {
            "score": -1.0,
            "onsetZ": onset_z,
            "jumpRatio": 1.0,
            "coverageRatio": 0.0,
            "intervalCv": 10.0,
        }
    med = float(np.median(diffs))
    cv = float(np.std(diffs) / max(1e-6, np.mean(diffs)))
    rel = np.abs(np.diff(diffs)) / np.maximum(1.0, diffs[:-1])
    jump_ratio = float(np.mean(rel > 0.35)) if rel.size else 0.0
    expected_count = max(1.0, duration_ms / max(1.0, med))
    coverage_ratio = min(2.0, len(beat_times_ms) / expected_count)

    # Higher is better:
    # strong onset alignment, low abrupt jump ratio, and reasonable interval spread.
    score = (1.00 * onset_z) - (1.20 * jump_ratio) - (0.35 * cv) - (0.50 * abs(1.0 - coverage_ratio))
    return {
        "score": float(score),
        "onsetZ": float(onset_z),
        "jumpRatio": float(jump_ratio),
        "coverageRatio": float(coverage_ratio),
        "intervalCv": float(cv),
    }


def _infer_beats_per_bar_from_accent(
    beat_starts_ms: List[int],
    y: np.ndarray,
    sr: int,
    default_bpb: int,
) -> tuple[int, int, Dict[int, float]]:
    scores: Dict[int, float] = {}
    offsets: Dict[int, int] = {}
    best_bpb = int(default_bpb or 4)
    best_score = -1.0
    best_offset = 0
    for cand in (2, 3, 4):
        off, score = _best_accent_phase(beat_starts_ms, y, sr, cand)
        scores[cand] = float(score)
        offsets[cand] = int(off)
        if score > best_score:
            best_score = float(score)
            best_bpb = int(cand)
            best_offset = int(off)
    if best_score < 0.05:
        return max(1, int(default_bpb or 4)), 0, scores
    # 2/4 vs 4/4 is the most common ambiguity in this repertoire. When the
    # accent evidence is nearly tied, prefer 4/4 because it produces musically
    # safer bar resets for pop/holiday material than collapsing to 2/4.
    if best_bpb == 2:
        score4 = float(scores.get(4, -1.0))
        if score4 >= max(0.05, best_score - 0.02):
            return 4, int(offsets.get(4, 0)), scores
    return best_bpb, best_offset, scores


def _should_probe_fast_triple_meter(
    inferred_beats_per_bar: int,
    scores: Dict[int, float],
) -> bool:
    if int(inferred_beats_per_bar) != 4:
        return False
    score3 = float(scores.get(3, -1.0))
    score4 = float(scores.get(4, -1.0))
    if score3 < 0.05 or score4 < 0.05:
        return False
    return (score4 - score3) <= 0.09


def _subdivide_beat_times_linear(beat_times_ms: List[int], factor: int = 2) -> List[int]:
    src = sorted(set(int(x) for x in (beat_times_ms or []) if int(x) >= 0))
    f = max(1, int(factor))
    if f <= 1 or len(src) < 2:
        return src
    out: List[int] = []
    for i, s in enumerate(src):
        out.append(int(s))
        if i + 1 >= len(src):
            continue
        n = int(src[i + 1])
        if n <= s:
            continue
        span = n - s
        for k in range(1, f):
            p = int(round(s + (span * k) / float(f)))
            if s < p < n:
                out.append(p)
    return sorted(set(out))


def _select_best_beat_grid(
    beat_times_ms: List[int],
    y: np.ndarray,
    sr: int,
    duration_ms: int,
) -> tuple[List[int], Dict[str, Any]]:
    base = sorted(set(int(x) for x in (beat_times_ms or []) if int(x) >= 0))
    cands: List[tuple[str, List[int], float]] = []
    q_base = _beat_quality_metrics(base, y, sr, duration_ms)
    cands.append(("1x", base, float(q_base.get("score", -1.0))))
    sub2 = _subdivide_beat_times_linear(base, 2)
    q_sub2 = _beat_quality_metrics(sub2, y, sr, duration_ms)
    cands.append(("2x", sub2, float(q_sub2.get("score", -1.0))))
    cands.sort(key=lambda row: row[2], reverse=True)
    best_name, best_beats, best_score = cands[0]
    base_score = float(q_base.get("score", -1.0))
    use_best = best_name == "1x" or best_score > (base_score + 0.12)
    selected_name = best_name if use_best else "1x"
    selected = best_beats if use_best else base
    return selected, {
        "selectedGrid": selected_name,
        "scores": {
            "1x": float(q_base.get("score", -1.0)),
            "2x": float(q_sub2.get("score", -1.0)),
        },
        "counts": {
            "1x": len(base),
            "2x": len(sub2),
            "selected": len(selected),
        },
    }


def _resolve_identity_and_web(path: str, analysis_profile: Optional[Dict[str, Any]] = None) -> tuple[Dict[str, Any], bool, Dict[str, Any], str]:
    profile = analysis_profile or _normalize_analysis_profile("")
    identity: Dict[str, Any] = {}
    identity_cache_hit = False
    web_tempo_evidence: Dict[str, Any] = {
        "sources": [],
        "bpmValues": [],
        "barsPerMinuteValues": [],
        "timeSignatures": [],
        "chosenBeatBpm": None,
        "provider": "songbpm+getsongbpm",
    }
    error = ""
    try:
        identity, identity_cache_hit = _identify_track_with_audd(path, profile)
    except Exception as err:
        error = f"audd identify failed: {err}"
    if not identity:
        identity = _fallback_identity_from_path(path)
    if identity and profile.get("enableWebTempo"):
        try:
            web_tempo_evidence = _fetch_songbpm_evidence(identity)
        except Exception as err:
            error = f"{error} | web tempo evidence failed: {err}" if error else f"web tempo evidence failed: {err}"
    return identity, identity_cache_hit, web_tempo_evidence, error


def _resolve_lyrics(
    identity: Dict[str, Any],
    y: np.ndarray,
    sr: int,
    duration_ms: int,
    analysis_profile: Optional[Dict[str, Any]] = None,
) -> tuple[List[Dict[str, Any]], str, int, Dict[str, Any]]:
    lyrics_marks: List[Dict[str, Any]] = []
    lyrics_error = ""
    lyrics_shift_ms = 0
    lyrics_info: Dict[str, Any] = {}
    try:
        lyrics_marks, lyrics_error, lyrics_info = _fetch_lrclib_lyrics(identity, duration_ms, analysis_profile)
    except Exception as err:
        lyrics_error = f"lrclib runtime failed: {err}"
    if lyrics_marks and ENABLE_LYRICS_AUTO_SHIFT:
        try:
            lyrics_shift_ms = _estimate_lyrics_global_shift_ms(lyrics_marks, y, sr, duration_ms)
            if lyrics_shift_ms:
                lyrics_marks = _apply_global_shift_to_marks(lyrics_marks, lyrics_shift_ms, duration_ms)
        except Exception as err:
            lyrics_error = f"{lyrics_error} | lyrics-shift failed: {err}" if lyrics_error else f"lyrics-shift failed: {err}"
    return lyrics_marks, lyrics_error, int(lyrics_shift_ms), lyrics_info


def _detect_sections_from_audio_with_backbone(
    y: np.ndarray,
    sr: int,
    duration_ms: int,
    beat_times_ms: Optional[List[int]] = None,
    *,
    lyrics_available: bool = False,
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_frame_times = librosa.times_like(chroma, sr=sr)
    rms = librosa.feature.rms(y=y)[0]
    rms_frame_times = librosa.times_like(rms, sr=sr)
    beat_frames = np.array([], dtype=int)
    beat_times_sync = np.array([], dtype=float)
    if beat_times_ms and len(beat_times_ms) >= 8:
        beat_times_sec = np.asarray([max(0.0, float(v) / 1000.0) for v in beat_times_ms], dtype=float)
        beat_frames = librosa.time_to_frames(beat_times_sec, sr=sr)
        beat_frames = np.unique(beat_frames[(beat_frames >= 0) & (beat_frames < chroma.shape[1])]).astype(int)
    if beat_frames.size >= 8:
        sync = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
        beat_times_sync = librosa.frames_to_time(beat_frames, sr=sr)
    else:
        sync = chroma
        beat_times_sync = librosa.frames_to_time(np.arange(sync.shape[1]), sr=sr)

    boundary_times: List[float] = [0.0]
    if sync.shape[1] >= 4:
        deltas = np.linalg.norm(sync[:, 1:] - sync[:, :-1], axis=0)
        if deltas.size:
            kernel = np.array([0.25, 0.5, 0.25], dtype=float)
            novelty = np.convolve(deltas, kernel, mode="same")
            min_gap = 24
            selected: List[int] = []
            thresholds = np.percentile(novelty, [90, 85, 80, 75, 70, 65])
            min_edge_sec = 6.0
            for threshold in thresholds:
                candidates: List[int] = []
                for i in range(1, novelty.shape[0] - 1):
                    if novelty[i] < threshold:
                        continue
                    if novelty[i] < novelty[i - 1] or novelty[i] < novelty[i + 1]:
                        continue
                    t = float(beat_times_sync[i + 1])
                    if t < min_edge_sec or (duration_ms / 1000.0 - t) < min_edge_sec:
                        continue
                    candidates.append(i + 1)
                picks: List[int] = []
                for idx in sorted(candidates, key=lambda x: float(novelty[x - 1]), reverse=True):
                    if any(abs(idx - p) < min_gap for p in picks):
                        continue
                    picks.append(idx)
                picks.sort()
                if 4 <= len(picks) <= 10:
                    selected = picks
                    break
                if not selected:
                    selected = picks
            for idx in selected:
                if idx <= 0 or idx >= len(beat_times_sync):
                    continue
                t = float(beat_times_sync[idx])
                if t > boundary_times[-1]:
                    boundary_times.append(t)
    if boundary_times[-1] * 1000 < duration_ms:
        boundary_times.append(duration_ms / 1000.0)
    segs: List[Dict[str, Any]] = []
    for i in range(len(boundary_times) - 1):
        start_ms = int(round(boundary_times[i] * 1000))
        end_ms = int(round(boundary_times[i + 1] * 1000))
        if end_ms <= start_ms:
            continue
        segs.append({"startMs": start_ms, "endMs": end_ms, "label": "Section"})
    if not segs:
        return [], {"segments": [], "families": [], "sequence": [], "anchorFor": []}

    section_chroma: List[np.ndarray] = []
    section_energy: List[float] = []
    for seg in segs:
        start_sec = max(0.0, float(seg["startMs"]) / 1000.0)
        end_sec = max(start_sec, float(seg["endMs"]) / 1000.0)

        chroma_mask = (chroma_frame_times >= start_sec) & (chroma_frame_times < end_sec)
        if not np.any(chroma_mask):
            chroma_idx = int(np.clip(np.searchsorted(chroma_frame_times, start_sec, side="left"), 0, chroma.shape[1] - 1))
            chroma_profile = np.asarray(chroma[:, chroma_idx], dtype=float)
        else:
            chroma_profile = np.asarray(np.median(chroma[:, chroma_mask], axis=1), dtype=float)
        section_chroma.append(chroma_profile)

        rms_mask = (rms_frame_times >= start_sec) & (rms_frame_times < end_sec)
        if not np.any(rms_mask):
            rms_idx = int(np.clip(np.searchsorted(rms_frame_times, start_sec, side="left"), 0, len(rms) - 1))
            energy = float(rms[rms_idx])
        else:
            energy = float(np.mean(rms[rms_mask]))
        section_energy.append(energy)

    backbone = _build_section_recurrence_backbone(segs, section_chroma)
    labeled = _label_song_sections(
        segs,
        section_chroma,
        section_energy,
        duration_ms,
        lyrics_available=lyrics_available,
    )
    return (labeled if labeled else _build_numbered_sections(segs)), backbone


def _detect_sections_from_audio(
    y: np.ndarray,
    sr: int,
    duration_ms: int,
    beat_times_ms: Optional[List[int]] = None,
    *,
    lyrics_available: bool = False,
) -> List[Dict[str, Any]]:
    sections, _ = _detect_sections_from_audio_with_backbone(
        y,
        sr,
        duration_ms,
        beat_times_ms,
        lyrics_available=lyrics_available,
    )
    return sections


def _apply_global_shift_to_marks(
    marks: List[Dict[str, Any]], shift_ms: int, duration_ms: int
) -> List[Dict[str, Any]]:
    if not marks or int(shift_ms) == 0:
        return _sanitize_marks(marks)
    shifted: List[Dict[str, Any]] = []
    for row in marks:
        s = int(round(float(row.get("startMs", 0)))) + int(shift_ms)
        e_raw = row.get("endMs")
        e = None
        if e_raw is not None:
            try:
                e = int(round(float(e_raw))) + int(shift_ms)
            except Exception:
                e = None
        s = max(0, min(int(duration_ms) - 1, s))
        out: Dict[str, Any] = {"startMs": s}
        if e is not None:
            e = max(s + 1, min(int(duration_ms), e))
            if e > s:
                out["endMs"] = e
        label = str(row.get("label", "")).strip()
        if label:
            out["label"] = label
        shifted.append(out)
    shifted = _sanitize_marks(shifted)
    shifted.sort(key=lambda x: int(x.get("startMs", 0)))
    for i in range(len(shifted)):
        s = int(shifted[i]["startMs"])
        nxt_s = int(shifted[i + 1]["startMs"]) if i + 1 < len(shifted) else int(duration_ms)
        e = int(shifted[i].get("endMs", s + 1))
        e = min(e, nxt_s)
        if e <= s:
            e = min(int(duration_ms), s + 1)
        shifted[i]["endMs"] = e
    return _sanitize_marks(shifted)


def _estimate_lyrics_global_shift_ms(
    marks: List[Dict[str, Any]],
    y: np.ndarray,
    sr: int,
    duration_ms: int,
) -> int:
    rows = [r for r in (marks or []) if isinstance(r, dict) and str(r.get("label", "")).strip()]
    starts = sorted(set(int(r.get("startMs", 0)) for r in rows if 0 <= int(r.get("startMs", 0)) < int(duration_ms)))
    if len(starts) < 8:
        return 0
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    if onset_env.size <= 0:
        return 0
    frame_times_ms = librosa.times_like(onset_env, sr=sr) * 1000.0

    def score_shift(shift_ms: int) -> float:
        vals: List[float] = []
        for s in starts:
            t_ms = float(s + shift_ms)
            if t_ms < 0 or t_ms >= float(duration_ms):
                continue
            idx = int(np.searchsorted(frame_times_ms, t_ms, side="left"))
            lo = max(0, idx - 1)
            hi = min(len(onset_env), idx + 2)
            if hi <= lo:
                continue
            vals.append(float(np.max(onset_env[lo:hi])))
        return float(np.mean(vals)) if vals else -1.0

    baseline = score_shift(0)
    best_shift = 0
    best_score = baseline
    for shift in range(-20000, 20001, 100):
        s = score_shift(shift)
        if s > best_score:
            best_score = s
            best_shift = shift
    if abs(best_shift) < 200:
        return 0
    if baseline <= 0 and best_score > baseline:
        return int(best_shift)
    improvement = (best_score - baseline) / max(1e-6, abs(baseline))
    return int(best_shift) if improvement >= 0.05 else 0


def _build_numbered_sections(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def base_label(raw: Any) -> str:
        label = str(raw or "Section").strip() or "Section"
        m = re.match(r"^(Intro|Outro|Bridge|Instrumental|Verse|Chorus|Theme|Contrast|Refrain)(?:\s+\d+)?$", label, flags=re.IGNORECASE)
        if not m:
            return label
        normalized = m.group(1).strip().lower()
        return {
            "intro": "Intro",
            "outro": "Outro",
            "bridge": "Bridge",
            "instrumental": "Instrumental",
            "verse": "Verse",
            "chorus": "Chorus",
            "theme": "Theme",
            "contrast": "Contrast",
            "refrain": "Refrain",
        }.get(normalized, label)

    counts: Dict[str, int] = {}
    totals: Dict[str, int] = {}
    for seg in segments:
        base = base_label(seg.get("label", "Section"))
        totals[base] = totals.get(base, 0) + 1
    out: List[Dict[str, Any]] = []
    for seg in segments:
        base = base_label(seg.get("label", "Section"))
        counts[base] = counts.get(base, 0) + 1
        suffix = f" {counts[base]}" if totals.get(base, 1) > 1 else ""
        out.append(
            {
                "startMs": int(seg["startMs"]),
                "endMs": int(seg["endMs"]),
                "label": f"{base}{suffix}",
            }
        )
    return out


def _merge_adjacent_same_label_sections(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def base_label(raw: Any) -> str:
        label = str(raw or "Section").strip() or "Section"
        match = re.match(r"^(Intro|Outro|Bridge|Instrumental|Verse|Chorus|Theme|Contrast|Refrain)(?:\s+\d+)?$", label, flags=re.IGNORECASE)
        if not match:
            return label
        normalized = match.group(1).strip().lower()
        return {
            "intro": "Intro",
            "outro": "Outro",
            "bridge": "Bridge",
            "instrumental": "Instrumental",
            "verse": "Verse",
            "chorus": "Chorus",
            "theme": "Theme",
            "contrast": "Contrast",
            "refrain": "Refrain",
        }.get(normalized, label)

    merged: List[Dict[str, Any]] = []
    for seg in sorted(segments or [], key=lambda row: int(row.get("startMs", 0))):
        start_ms = int(seg.get("startMs", 0))
        end_ms = int(seg.get("endMs", start_ms + 1))
        label = str(seg.get("label", "Section")).strip() or "Section"
        if end_ms <= start_ms:
            continue
        if merged:
            prev = merged[-1]
            prev_label = str(prev.get("label", "")).strip()
            if base_label(prev_label) == base_label(label) and int(prev.get("endMs", 0)) >= start_ms:
                prev["endMs"] = max(int(prev.get("endMs", 0)), end_ms)
                continue
        merged.append({"startMs": start_ms, "endMs": end_ms, "label": label})
    return merged


def _looks_generic_section_label(label: str) -> bool:
    return bool(re.match(r"^section(?:\s+\d+)?$", str(label or "").strip(), flags=re.IGNORECASE))


def _refine_audio_sections_with_semantic_spans(
    audio_sections: List[Dict[str, Any]],
    semantic_sections: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not audio_sections or not semantic_sections:
        return audio_sections
    lyric_preferred_prefixes = ("verse", "chorus", "bridge", "intro", "outro")
    weak_audio_prefixes = ("theme", "refrain", "contrast", "instrumental")
    refined: List[Dict[str, Any]] = []
    for section in audio_sections:
        start_ms = int(section.get("startMs", 0))
        end_ms = int(section.get("endMs", start_ms + 1))
        current_label = str(section.get("label", "Section")).strip() or "Section"
        section_duration = max(1, end_ms - start_ms)
        overlaps: List[Dict[str, Any]] = []
        best_label = current_label
        best_overlap = -1
        for semantic in semantic_sections:
            semantic_label = str(semantic.get("label", "")).strip()
            if not semantic_label or _looks_generic_section_label(semantic_label):
                continue
            semantic_start = int(semantic.get("startMs", 0))
            semantic_end = int(semantic.get("endMs", 0))
            overlap = min(end_ms, semantic_end) - max(start_ms, semantic_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_label = semantic_label
            if overlap > 0:
                overlaps.append({
                    "startMs": max(start_ms, semantic_start),
                    "endMs": min(end_ms, semantic_end),
                    "label": semantic_label,
                    "overlap": overlap,
                })
        overlap_ratio = (best_overlap / section_duration) if best_overlap > 0 else 0.0
        current_lower = current_label.lower()
        best_lower = best_label.lower()
        significant_overlaps = [
            row for row in overlaps
            if int(row["overlap"]) >= max(1500, int(section_duration * 0.04))
        ]
        unique_overlap_labels = list(dict.fromkeys(str(row["label"]) for row in significant_overlaps))
        covered_ms = sum(int(row["overlap"]) for row in significant_overlaps)
        should_split = (
            len(unique_overlap_labels) >= 2
            and (covered_ms / section_duration) >= 0.65
        )
        if should_split:
            cursor = start_ms
            for row in sorted(significant_overlaps, key=lambda item: int(item["startMs"])):
                row_start = int(row["startMs"])
                row_end = int(row["endMs"])
                if row_start > cursor:
                    refined.append({
                        "startMs": cursor,
                        "endMs": row_start,
                        "label": current_label,
                    })
                refined.append({
                    "startMs": row_start,
                    "endMs": row_end,
                    "label": str(row["label"]),
                })
                cursor = max(cursor, row_end)
            if cursor < end_ms:
                refined.append({
                    "startMs": cursor,
                    "endMs": end_ms,
                    "label": current_label,
                })
            continue
        should_promote = (
            _looks_generic_section_label(current_label)
            or (
                overlap_ratio >= 0.5
                and current_lower.startswith(weak_audio_prefixes)
                and best_lower.startswith(lyric_preferred_prefixes)
            )
        )
        if best_overlap > 0 and should_promote:
            current_label = best_label
        refined.append({"startMs": start_ms, "endMs": end_ms, "label": current_label})
    return _build_numbered_sections(_merge_adjacent_same_label_sections(refined))


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na <= 1e-9 or nb <= 1e-9:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _build_section_recurrence_backbone(
    segments: List[Dict[str, Any]],
    section_chroma: List[np.ndarray],
) -> Dict[str, Any]:
    if not segments:
        return {
            "segments": [],
            "families": [],
            "sequence": [],
            "anchorFor": [],
        }

    n = len(segments)
    durations = [max(1, int(seg["endMs"]) - int(seg["startMs"])) for seg in segments]
    anchor_for: List[int] = [-1] * n
    groups: Dict[int, List[int]] = {}
    for i in range(n):
        best_j = -1
        best_sim = -1.0
        for j in range(i):
            sim = _cosine_sim(section_chroma[i], section_chroma[j])
            len_ratio = durations[i] / max(1.0, float(durations[j]))
            if sim > 0.84 and 0.55 <= len_ratio <= 1.8 and sim > best_sim:
                best_sim = sim
                best_j = j
        if best_j >= 0:
            anchor_for[i] = anchor_for[best_j] if anchor_for[best_j] >= 0 else best_j
        else:
            anchor_for[i] = i
        groups.setdefault(anchor_for[i], []).append(i)

    ordered_anchors = sorted(groups.keys(), key=lambda anchor: min(groups.get(anchor, [anchor])))
    family_label_by_anchor: Dict[int, str] = {}
    family_id_by_anchor: Dict[int, str] = {}
    for idx, anchor in enumerate(ordered_anchors):
        label = chr(ord("A") + idx) if idx < 26 else f"A{idx + 1}"
        family_label_by_anchor[anchor] = label
        family_id_by_anchor[anchor] = f"family-{label}"

    family_segments: List[Dict[str, Any]] = []
    for i, seg in enumerate(segments):
        anchor = anchor_for[i]
        family_segments.append({
            "startMs": int(seg["startMs"]),
            "endMs": int(seg["endMs"]),
            "familyId": family_id_by_anchor[anchor],
            "familyLabel": family_label_by_anchor[anchor],
            "anchorIndex": int(anchor),
            "segmentIndex": int(i),
        })

    families: List[Dict[str, Any]] = []
    for anchor in ordered_anchors:
        idxs = groups.get(anchor, [])
        families.append({
            "familyId": family_id_by_anchor[anchor],
            "label": family_label_by_anchor[anchor],
            "anchorIndex": int(anchor),
            "memberIndices": [int(i) for i in idxs],
            "occurrenceCount": len(idxs),
        })

    return {
        "segments": family_segments,
        "families": families,
        "sequence": [family_label_by_anchor[anchor_for[i]] for i in range(n)],
        "anchorFor": [int(v) for v in anchor_for],
    }


def _label_song_sections(
    segments: List[Dict[str, Any]],
    section_chroma: List[np.ndarray],
    section_energy: List[float],
    duration_ms: int,
    *,
    lyrics_available: bool = False,
) -> List[Dict[str, Any]]:
    if not segments:
        return []

    n = len(segments)
    durations = [max(1, int(seg["endMs"]) - int(seg["startMs"])) for seg in segments]
    backbone = _build_section_recurrence_backbone(segments, section_chroma)
    anchor_for = [int(v) for v in (backbone.get("anchorFor") or [])]
    family_sequence = [str(v) for v in (backbone.get("sequence") or []) if str(v)]
    unique_family_count = len(set(family_sequence))
    allow_pop_semantics = bool(lyrics_available or unique_family_count <= 4)
    groups: Dict[int, List[int]] = {}
    for idx, anchor in enumerate(anchor_for):
        groups.setdefault(int(anchor), []).append(int(idx))

    repeated = [idxs for idxs in groups.values() if len(idxs) >= 2]
    primary_anchor = -1
    primary_label = "Chorus"
    secondary_label = "Verse"
    secondary_anchor = -1
    if repeated:
        scored = []
        for idxs in repeated:
            energy = float(np.mean([section_energy[i] for i in idxs]))
            total_dur = float(np.sum([durations[i] for i in idxs]))
            coverage = len(idxs) / max(1, n)
            first_idx = min(idxs)
            score = energy * 0.50 + (total_dur / max(1.0, float(duration_ms))) * 0.20 + coverage * 0.30
            scored.append((score, idxs, energy, coverage, first_idx))
        scored.sort(key=lambda x: x[0], reverse=True)
        primary_idxs = scored[0][1]
        primary_anchor = anchor_for[primary_idxs[0]]
        primary_coverage = float(scored[0][3])
        primary_first_idx = int(scored[0][4])
        secondary_count = 0
        for _, idxs, _, _, _ in scored[1:]:
            cand = anchor_for[idxs[0]]
            if cand != primary_anchor:
                secondary_anchor = cand
                secondary_count = len(idxs)
                break

        # Audio-only classification should be conservative. Only use Chorus/Verse
        # when the backbone looks like a real contrasting repeated form. Otherwise
        # fall back to Theme/Refrain/Contrast.
        has_contrast_repeat = secondary_anchor >= 0 and secondary_count >= 2
        audio_only_pop_form = unique_family_count <= 3
        chorus_eligible = (
            primary_first_idx > 0
            and primary_coverage < 0.5
            and has_contrast_repeat
            and (lyrics_available or audio_only_pop_form)
        )
        if chorus_eligible:
            primary_label = "Chorus"
            secondary_label = "Verse"
        elif primary_first_idx == 0 and primary_coverage >= 0.7:
            primary_label = "Theme"
            secondary_label = "Contrast"
        elif primary_first_idx == 0 or primary_coverage >= 0.5:
            primary_label = "Refrain"
            secondary_label = "Contrast"
        else:
            primary_label = "Theme"
            secondary_label = "Contrast"

    primary_idxs = groups.get(primary_anchor, []) if primary_anchor >= 0 else []

    labels = ["Section"] * n
    if n >= 1:
        first_len = durations[0]
        if first_len <= max(15000, int(duration_ms * 0.15)):
            labels[0] = "Intro"
    if n >= 2:
        last_len = durations[-1]
        if last_len <= max(18000, int(duration_ms * 0.2)):
            labels[-1] = "Outro"

    for i in range(n):
        if labels[i] in ("Intro", "Outro"):
            continue
        anchor = anchor_for[i]
        if anchor == primary_anchor:
            labels[i] = primary_label
        elif anchor == secondary_anchor:
            labels[i] = secondary_label

    if primary_anchor >= 0 and primary_idxs:
        cmin, cmax = min(primary_idxs), max(primary_idxs)
        for i in range(cmin + 1, cmax):
            if labels[i] != "Section":
                continue
            if anchor_for[i] not in (primary_anchor, secondary_anchor):
                labels[i] = "Bridge" if allow_pop_semantics and primary_label in ("Chorus", "Refrain") else "Contrast"

    for i in range(n):
        if labels[i] == "Section":
            if primary_anchor >= 0 and i < min(primary_idxs):
                labels[i] = secondary_label if secondary_label == "Verse" else "Contrast"
            elif primary_anchor >= 0 and i > max(primary_idxs):
                labels[i] = "Instrumental" if primary_label == "Refrain" else "Verse"
            else:
                labels[i] = "Instrumental"

    out = []
    for i, seg in enumerate(segments):
        out.append(
            {
                "startMs": int(seg["startMs"]),
                "endMs": int(seg["endMs"]),
                "label": labels[i],
            }
        )
    return _build_numbered_sections(out)


def _analyze_with_beatnet(path: str, analysis_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = analysis_profile or _normalize_analysis_profile("")
    _ensure_librosa()
    _ensure_beatnet()
    if BeatNetEstimator is None:
        raise RuntimeError("BeatNet is not installed in this runtime.")
    if librosa is None:
        raise RuntimeError("librosa is required for BeatNet duration metadata.")

    y, sr = librosa.load(path, sr=22050, mono=True)
    duration_ms = int(round((len(y) / float(sr)) * 1000))

    estimator = BeatNetEstimator(1, mode="offline", inference_model="DBN", plot=[], thread=False)
    output = estimator.process(path)
    arr = np.asarray(output)
    if arr.ndim != 2 or arr.shape[0] == 0:
        raise RuntimeError("BeatNet returned empty or invalid output.")

    beat_times_ms: List[int] = []
    beat_flags: List[float] = []
    for i in range(arr.shape[0]):
        try:
            t = float(arr[i, 0])
        except Exception:
            continue
        if not np.isfinite(t):
            continue
        ms = int(round(t * 1000.0))
        if ms < 0 or ms >= duration_ms:
            continue
        beat_times_ms.append(ms)
        flag = 0.0
        if arr.shape[1] > 1:
            try:
                flag = float(arr[i, 1])
            except Exception:
                flag = 0.0
        beat_flags.append(flag)

    beat_times_ms = sorted(set(beat_times_ms))

    # BeatNet second column can represent downbeat flags/positions depending on mode.
    downbeat_starts: List[int] = []
    if len(beat_flags) == len(beat_times_ms):
        for i, val in enumerate(beat_flags):
            is_downbeat = False
            if val in (0.0, 1.0):
                is_downbeat = val >= 0.5
            else:
                is_downbeat = int(round(val)) == 1
            if is_downbeat:
                downbeat_starts.append(beat_times_ms[i])

    phase_bpb = _beats_per_bar_from_phase_values(beat_flags)
    interval_bpb = _estimate_beats_per_bar(beat_times_ms, downbeat_starts, DEFAULT_BEATS_PER_BAR)
    accent_candidates = [2, 3, 4]
    accent_best_bpb = 0
    accent_best_offset = 0
    accent_best_score = -1.0
    accent_scores: Dict[int, float] = {}
    accent_offsets: Dict[int, int] = {}
    for cand in accent_candidates:
        off, score = _best_accent_phase(beat_times_ms, y, sr, cand)
        accent_scores[cand] = score
        accent_offsets[cand] = off
        if score > accent_best_score:
            accent_best_bpb = cand
            accent_best_offset = off
            accent_best_score = score

    detected_beats_per_bar = phase_bpb or interval_bpb or max(1, int(DEFAULT_BEATS_PER_BAR))
    # If BeatNet collapses to duple phase labels, use accent periodicity to recover triple/quad meters.
    if detected_beats_per_bar == 2:
        score2 = float(accent_scores.get(2, -1.0))
        score3 = float(accent_scores.get(3, -1.0))
        score4 = float(accent_scores.get(4, -1.0))
        if score3 >= (score2 + 0.12) and score3 >= (score4 + 0.08):
            detected_beats_per_bar = 3
        elif score4 >= (score2 + 0.12):
            detected_beats_per_bar = 4

    if detected_beats_per_bar in (3, 4):
        score_target = float(accent_scores.get(detected_beats_per_bar, -1.0))
        score_phase = float(accent_scores.get(phase_bpb, -1.0)) if phase_bpb else -1.0
        if score_target > (score_phase + 0.08):
            target_offset = int(accent_offsets.get(detected_beats_per_bar, accent_best_offset))
            downbeat_starts = [
                beat_times_ms[i]
                for i in range(len(beat_times_ms))
                if (i % detected_beats_per_bar) == target_offset
            ]

    # Generic under-segmentation correction:
    # If BeatNet phase output is duple but meter inference is higher, test a subdivided beat grid.
    if phase_bpb == 2 and detected_beats_per_bar in (3, 4) and len(beat_times_ms) >= 12:
        subdivided: List[int] = []
        for i, start in enumerate(beat_times_ms):
            subdivided.append(int(start))
            if i + 1 < len(beat_times_ms):
                nxt = int(beat_times_ms[i + 1])
                if nxt > start:
                    mid = int(round((start + nxt) / 2.0))
                    if 0 <= mid < duration_ms:
                        subdivided.append(mid)
        subdivided = sorted(set(subdivided))
        if len(subdivided) >= int(len(beat_times_ms) * 1.8):
            base_score = float(accent_scores.get(detected_beats_per_bar, -1.0))
            sub_off, sub_score = _best_accent_phase(subdivided, y, sr, detected_beats_per_bar)
            if sub_score > (base_score + 0.08):
                beat_times_ms = subdivided
                downbeat_starts = [
                    beat_times_ms[i]
                    for i in range(len(beat_times_ms))
                    if (i % detected_beats_per_bar) == int(sub_off)
                ]

    # Beat quality layer: compare BeatNet vs librosa and select cleaner beat grid.
    beatnet_candidate = list(beat_times_ms)
    librosa_candidate = _beat_times_from_librosa(y, sr, duration_ms)
    quality_beatnet = _beat_quality_metrics(beatnet_candidate, y, sr, duration_ms)
    quality_librosa = _beat_quality_metrics(librosa_candidate, y, sr, duration_ms)
    selected_beat_source = "beatnet"
    if quality_librosa["score"] > (quality_beatnet["score"] + 0.10):
        selected_beat_source = "librosa"
        beat_times_ms = librosa_candidate
        detected_beats_per_bar, off, _ = _infer_beats_per_bar_from_accent(
            beat_times_ms, y, sr, detected_beats_per_bar
        )
        downbeat_starts = [
            beat_times_ms[i]
            for i in range(len(beat_times_ms))
            if (i % max(1, detected_beats_per_bar)) == int(off)
        ]

    beat_times_ms, beat_grid_info = _select_best_beat_grid(beat_times_ms, y, sr, duration_ms)
    if beat_grid_info.get("selectedGrid") == "2x":
        detected_beats_per_bar, off2, _ = _infer_beats_per_bar_from_accent(
            beat_times_ms, y, sr, detected_beats_per_bar
        )
        downbeat_starts = [
            beat_times_ms[i]
            for i in range(len(beat_times_ms))
            if (i % max(1, detected_beats_per_bar)) == int(off2)
        ]

    beats_out: List[Dict[str, Any]] = []
    for i, s in enumerate(beat_times_ms):
        if i + 1 < len(beat_times_ms):
            e = int(beat_times_ms[i + 1])
        else:
            if len(beat_times_ms) > 1:
                step = int(round(np.median(np.diff(np.asarray(beat_times_ms, dtype=float)))))
                e = int(s + max(1, step))
            else:
                e = int(min(duration_ms, s + 500))
        e = int(min(duration_ms, max(int(s) + 1, e)))
        beats_out.append({"startMs": int(s), "endMs": e})

    beats_out = _label_beats_from_downbeats(beats_out, downbeat_starts, detected_beats_per_bar)
    beats_out = _sanitize_marks(beats_out)
    bars_out = _derive_bars_from_labeled_beats(beats_out, duration_ms, detected_beats_per_bar)
    chords_out, chord_meta = _detect_chords(y, sr, duration_ms, profile)
    harmony_provider_results = _build_harmony_provider_results(
        chord_meta=chord_meta,
        chords=chords_out,
    )

    bpm_est = None
    if len(beat_times_ms) >= 2:
        diffs = np.diff(np.asarray(beat_times_ms, dtype=float))
        med = float(np.median(diffs)) if diffs.size else 0.0
        if med > 0:
            bpm_est = round(60000.0 / med, 2)
    rhythm_provider_agreement = _build_rhythm_provider_agreement(
        primary_provider="beatnet",
        primary_beats_per_bar=detected_beats_per_bar,
        primary_time_signature=f"{detected_beats_per_bar}/4",
        primary_bpm=bpm_est,
        secondary_summary=_summarize_secondary_rhythm(_detect_madmom_downbeat_summary(y, sr, duration_ms, profile)),
    )
    rhythm_provider_results = _build_rhythm_provider_results(
        primary_provider="beatnet",
        primary_beats_per_bar=detected_beats_per_bar,
        primary_time_signature=f"{detected_beats_per_bar}/4",
        primary_bpm=bpm_est,
        primary_beats=beats_out,
        primary_bars=bars_out,
        secondary_candidate=_detect_madmom_downbeat_summary(y, sr, duration_ms, profile),
        selected_provider="beatnet",
    )

    identity, identity_cache_hit, web_tempo_evidence, provider_error = _resolve_identity_and_web(path, profile)
    provider_sections: List[Dict[str, Any]] = []
    provider_name = ""

    sections: List[Dict[str, Any]] = provider_sections

    lyrics_marks, lyrics_error, lyrics_shift_ms, lyrics_info = _resolve_lyrics(identity, y, sr, duration_ms, profile)
    lyrics_source = _resolve_lyrics_source(lyrics_marks, lyrics_info)
    lyrics_provider_results = _build_lyrics_provider_results(
        lyrics_source=lyrics_source,
        lyrics_error=lyrics_error,
        lyrics_shift_ms=int(lyrics_shift_ms),
        lyrics_info=lyrics_info,
        lyrics_marks=lyrics_marks,
    )
    if not sections and lyrics_marks:
        try:
            sections = _infer_sections_from_lyrics(lyrics_marks, duration_ms)
            if sections:
                provider_name = "lyrics-inferred"
        except Exception as err:
            provider_error = f"{provider_error} | lyrics-inferred failed: {err}" if provider_error else f"lyrics-inferred failed: {err}"
    if sections and bars_out:
        sections = _align_sections_to_bar_starts(sections, bars_out, duration_ms)
    structure_backbone = {
        "segments": [],
        "families": [],
        "sequence": [],
        "anchorFor": [],
    }

    return {
        "bpm": bpm_est,
        "timeSignature": f"{detected_beats_per_bar}/4",
        "durationMs": duration_ms,
        "beats": beats_out,
        "bars": bars_out,
        "chords": chords_out,
        "sections": sections,
        "lyrics": lyrics_marks,
        "meta": {
            "engine": "beatnet",
            "sectionSource": provider_name or "none",
            "trackIdentity": identity,
            "trackIdentityCacheHit": identity_cache_hit,
            "webTempoEvidence": web_tempo_evidence,
            "sectionSourceError": provider_error or "",
            "lyricsSource": lyrics_source,
            "lyricsSourceError": lyrics_error,
            "lyricsGlobalShiftMs": int(lyrics_shift_ms),
            "lyricsParserVersion": "lrclib-v2-offset-aware-no-empty-lines",
            "lyricsLookup": lyrics_info,
            "lyricsProviderResults": lyrics_provider_results,
            "structureBackbone": structure_backbone,
            "sectionProviderConfig": _provider_config_state(),
            "analysisProfile": profile,
            "downbeatCount": len(downbeat_starts),
            "beatsPerBar": detected_beats_per_bar,
            "beatQuality": {
                "selectedSource": selected_beat_source,
                "beatnet": quality_beatnet,
                "librosa": quality_librosa,
            },
            "beatGridSelection": beat_grid_info,
            "rhythmProviderAgreement": rhythm_provider_agreement,
            "rhythmProviderResults": rhythm_provider_results,
            "chordAnalysis": chord_meta,
            "harmonyProviderResults": harmony_provider_results,
        },
    }


def _analyze_with_librosa(path: str, analysis_profile: Optional[Dict[str, Any]] = None, cached_modules: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = analysis_profile or _normalize_analysis_profile("")
    _ensure_librosa()
    if librosa is None:
        raise RuntimeError("librosa is not installed in this runtime.")
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration_ms = int(round((len(y) / float(sr)) * 1000))
    cached_rhythm = _cached_rhythm_payload(cached_modules, duration_ms) if profile.get("mode") == "deep" else None
    reused_cached_rhythm = bool(cached_rhythm)
    beat_grid_info = {"selectedGrid": "cached", "reusedFromCachedModules": True} if reused_cached_rhythm else {}
    beat_quality = {"selectedSource": "cached_fast_artifact", "score": 1.0} if reused_cached_rhythm else {}
    inferred_offset = 0
    inferred_scores: Dict[int, float] = {}
    madmom_candidate: Dict[str, Any] = {}
    chosen_meter_source = "cached_fast_artifact" if reused_cached_rhythm else "librosa_accent"
    if reused_cached_rhythm:
        beats_out = _sanitize_marks(cached_rhythm.get("beats") or [])
        bars_out = _sanitize_marks(cached_rhythm.get("bars") or [])
        beat_starts_ms = list(cached_rhythm.get("beatStartsMs") or [])
        inferred_bpb = int(cached_rhythm.get("beatsPerBar") or DEFAULT_BEATS_PER_BAR)
        bpm_est = cached_rhythm.get("bpm")
        rhythm_provider_agreement = dict(cached_rhythm.get("providerAgreement") or {})
        rhythm_provider_results = dict(cached_rhythm.get("providerResults") or {})
    else:
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        beat_starts_ms = []
        for t in beat_times:
            ms = int(round(float(t) * 1000))
            if 0 <= ms < duration_ms:
                beat_starts_ms.append(ms)
        beat_starts_ms = sorted(set(beat_starts_ms))
        beat_starts_ms, beat_grid_info = _select_best_beat_grid(beat_starts_ms, y, sr, duration_ms)
        beat_quality = _beat_quality_metrics(beat_starts_ms, y, sr, duration_ms)
        inferred_bpb, inferred_offset, inferred_scores = _infer_beats_per_bar_from_accent(
            beat_starts_ms, y, sr, DEFAULT_BEATS_PER_BAR
        )
        beats_out = []
        for i, start in enumerate(beat_starts_ms):
            if i + 1 < len(beat_starts_ms):
                end = int(beat_starts_ms[i + 1])
            else:
                step = int(round((60.0 / max(float(tempo), 1.0)) * 1000))
                end = start + max(1, step)
            if end <= start:
                end = start + 1
            beat_num = ((i - int(inferred_offset)) % max(1, inferred_bpb)) + 1
            beats_out.append({"startMs": start, "endMs": end, "label": str(beat_num)})
        beats_out = _sanitize_marks(beats_out)
        bars_out = _derive_bars_from_labeled_beats(beats_out, duration_ms, max(1, int(inferred_bpb)))
        bpm_est = None
        if len(beat_starts_ms) >= 2:
            diffs = np.diff(np.asarray(beat_starts_ms, dtype=float))
            med = float(np.median(diffs)) if diffs.size else 0.0
            if med > 0:
                bpm_est = float(round(60000.0 / med, 2))
        probe_profile = profile
        if (
            profile.get("mode") == "fast"
            and not profile.get("enableMadmomDownbeatCrosscheck")
            and _should_probe_fast_triple_meter(int(max(1, int(inferred_bpb))), inferred_scores)
        ):
            probe_profile = {**profile, "enableMadmomDownbeatCrosscheck": True}
        madmom_candidate = _detect_madmom_downbeat_summary(y, sr, duration_ms, probe_profile)
        rhythm_provider_agreement = _build_rhythm_provider_agreement(
            primary_provider="librosa",
            primary_beats_per_bar=int(max(1, int(inferred_bpb))),
            primary_time_signature=f"{max(1, int(inferred_bpb))}/4",
            primary_bpm=bpm_est if bpm_est and bpm_est > 0 else (float(round(float(tempo), 2)) if float(tempo) > 0 else None),
            secondary_summary=_summarize_secondary_rhythm(madmom_candidate),
        )
        if _should_prefer_secondary_meter(
            primary_beats_per_bar=int(max(1, int(inferred_bpb))),
            primary_beat_count=len(beat_starts_ms),
            primary_bpm=bpm_est if bpm_est and bpm_est > 0 else (float(round(float(tempo), 2)) if float(tempo) > 0 else None),
            secondary_candidate=madmom_candidate,
        ):
            secondary_bpb = int(madmom_candidate.get("beatsPerBar") or inferred_bpb)
            secondary_sig = str(madmom_candidate.get("timeSignature") or f"{secondary_bpb}/4")
            secondary_beats = _sanitize_marks(madmom_candidate.get("beats") or [])
            secondary_bars = _sanitize_marks(madmom_candidate.get("bars") or [])
            if secondary_beats and secondary_bars:
                inferred_bpb = secondary_bpb
                beats_out = secondary_beats
                bars_out = secondary_bars
                bpm_est = madmom_candidate.get("bpm") if madmom_candidate.get("bpm") is not None else bpm_est
                chosen_meter_source = "madmom_downbeat"
                rhythm_provider_agreement["primary"]["beatsPerBar"] = int(inferred_bpb)
                rhythm_provider_agreement["primary"]["timeSignature"] = secondary_sig
                rhythm_provider_agreement["primary"]["bpm"] = float(bpm_est) if bpm_est is not None else None
                rhythm_provider_agreement["agreedOnBeatsPerBar"] = True
                rhythm_provider_agreement["agreedOnTimeSignature"] = True
        rhythm_provider_results = _build_rhythm_provider_results(
            primary_provider="librosa",
            primary_beats_per_bar=int(max(1, int(inferred_bpb))),
            primary_time_signature=f"{max(1, int(inferred_bpb))}/4",
            primary_bpm=bpm_est if bpm_est and bpm_est > 0 else (float(round(float(tempo), 2)) if float(tempo) > 0 else None),
            primary_beats=beats_out,
            primary_bars=bars_out,
            secondary_candidate=madmom_candidate,
            selected_provider=chosen_meter_source,
        )
    chords_out, chord_meta = _detect_chords(y, sr, duration_ms, profile)
    harmony_provider_results = _build_harmony_provider_results(
        chord_meta=chord_meta,
        chords=chords_out,
    )

    identity, identity_cache_hit, web_tempo_evidence, identity_error = _resolve_identity_and_web(path, profile)
    lyrics_marks, lyrics_error, lyrics_shift_ms, lyrics_info = _resolve_lyrics(identity, y, sr, duration_ms, profile)
    lyrics_source = _resolve_lyrics_source(lyrics_marks, lyrics_info)
    lyrics_provider_results = _build_lyrics_provider_results(
        lyrics_source=lyrics_source,
        lyrics_error=lyrics_error,
        lyrics_shift_ms=int(lyrics_shift_ms),
        lyrics_info=lyrics_info,
        lyrics_marks=lyrics_marks,
    )
    cached_sections = _cached_structure_segments(cached_modules, duration_ms) if profile.get("mode") == "deep" else []
    reused_cached_structure = bool(cached_sections)
    if reused_cached_structure:
        sections = cached_sections
        structure_backbone = {
            "segments": [
                {
                    "startMs": int(row["startMs"]),
                    "endMs": int(row["endMs"]),
                    "familyId": str(row.get("familyId") or ""),
                    "familyLabel": str(row.get("familyLabel") or ""),
                    "anchorIndex": int(row.get("anchorIndex") or 0),
                    "segmentIndex": int(row.get("segmentIndex") or idx),
                }
                for idx, row in enumerate(cached_sections)
            ],
            "families": [],
            "sequence": [str(row.get("familyLabel") or "") for row in cached_sections if str(row.get("familyLabel") or "")],
            "anchorFor": [int(row.get("anchorIndex") or idx) for idx, row in enumerate(cached_sections)],
        }
    else:
        sections, structure_backbone = _detect_sections_from_audio_with_backbone(
            y,
            sr,
            duration_ms,
            beat_starts_ms,
            lyrics_available=bool(lyrics_marks),
        )
    lyric_sections: List[Dict[str, Any]] = []
    if lyrics_marks:
        try:
            lyric_sections = _infer_sections_from_lyrics(lyrics_marks, duration_ms)
        except Exception:
            lyric_sections = []
    if lyric_sections:
        sections = _refine_audio_sections_with_semantic_spans(sections, lyric_sections)
    has_semantic_sections = any(
        str(row.get("label", "")).strip() and not _looks_generic_section_label(str(row.get("label", "")).strip())
        for row in sections
    )
    return {
        "bpm": bpm_est if bpm_est and bpm_est > 0 else (float(round(float(tempo), 2)) if float(tempo) > 0 else None),
        "timeSignature": f"{max(1, int(inferred_bpb))}/4",
        "durationMs": duration_ms,
        "beats": beats_out,
        "bars": bars_out,
        "chords": chords_out,
        "sections": sections,
        "lyrics": lyrics_marks,
        "meta": {
            "engine": "librosa",
            "sectionSource": (
                "cached-structure+lyrics-semantic"
                if reused_cached_structure and lyric_sections and has_semantic_sections
                else (
                    "audio+lyrics-semantic"
                    if lyric_sections and has_semantic_sections
                    else (
                        "cached-structure"
                        if reused_cached_structure
                        else ("audio-structural-heuristic" if has_semantic_sections else "audio-segmentation-generic")
                    )
                )
            ),
            "trackIdentity": identity,
            "trackIdentityCacheHit": identity_cache_hit,
            "webTempoEvidence": web_tempo_evidence,
            "identityError": identity_error,
            "lyricsSource": lyrics_source,
            "lyricsSourceError": lyrics_error,
            "lyricsGlobalShiftMs": int(lyrics_shift_ms),
            "lyricsParserVersion": "lrclib-v2-offset-aware-no-empty-lines",
            "lyricsLookup": lyrics_info,
            "lyricsProviderResults": lyrics_provider_results,
            "analysisProfile": profile,
            "beatsPerBar": int(max(1, int(inferred_bpb))),
            "meterAccentOffset": int(inferred_offset),
            "meterAccentScores": inferred_scores,
            "meterSource": chosen_meter_source,
            "beatGridSelection": beat_grid_info,
            "beatQuality": {
                "selectedSource": "cached_fast_artifact" if reused_cached_rhythm else "librosa",
                **({"cached_fast_artifact": beat_quality} if reused_cached_rhythm else {"librosa": beat_quality}),
            },
            "reusedCachedModules": {
                "rhythm": reused_cached_rhythm,
                "structureBackbone": reused_cached_structure,
            },
            "structureBackbone": structure_backbone,
            "rhythmProviderAgreement": rhythm_provider_agreement,
            "rhythmProviderResults": rhythm_provider_results,
            "chordAnalysis": chord_meta,
            "harmonyProviderResults": harmony_provider_results,
        },
    }


def _analysis_quality_score(data: Dict[str, Any]) -> float:
    meta = data.get("meta") if isinstance(data, dict) else {}
    if not isinstance(meta, dict):
        return -999.0
    bq = meta.get("beatQuality")
    if not isinstance(bq, dict):
        return -999.0
    selected = str(bq.get("selectedSource", "")).strip().lower()
    if selected and isinstance(bq.get(selected), dict):
        try:
            return float(bq[selected].get("score", -999.0))
        except Exception:
            return -999.0
    scores: List[float] = []
    for key in ("beatnet", "librosa"):
        payload = bq.get(key)
        if isinstance(payload, dict):
            try:
                val = float(payload.get("score", -999.0))
            except Exception:
                continue
            if np.isfinite(val):
                scores.append(val)
    return max(scores) if scores else -999.0


def _cached_module_rows(module_data: Dict[str, Any], key: str) -> List[Dict[str, Any]]:
    if not isinstance(module_data, dict):
        return []
    return _sanitize_marks(module_data.get(key) or [])


def _cached_rhythm_payload(cached_modules: Optional[Dict[str, Any]], duration_ms: int) -> Optional[Dict[str, Any]]:
    if not isinstance(cached_modules, dict):
        return None
    rhythm = cached_modules.get("rhythm")
    if not isinstance(rhythm, dict):
        return None
    data = rhythm.get("data")
    if not isinstance(data, dict):
        return None
    beats = _cached_module_rows(data, "beats")
    bars = _cached_module_rows(data, "bars")
    if not beats or not bars:
        return None
    time_signature = str(data.get("timeSignature") or "").strip()
    bpm = data.get("bpm")
    provider_agreement = data.get("providerAgreement") if isinstance(data.get("providerAgreement"), dict) else {}
    provider_results = data.get("providerResults") if isinstance(data.get("providerResults"), dict) else {}
    beat_starts = [int(row.get("startMs", 0)) for row in beats if int(row.get("startMs", 0)) >= 0]
    if len(beat_starts) >= 2:
        beat_starts = sorted(set(beat_starts))
    beats_per_bar = 0
    if "/" in time_signature:
        try:
            beats_per_bar = int(str(time_signature).split("/", 1)[0])
        except Exception:
            beats_per_bar = 0
    if beats_per_bar <= 0:
        beats_per_bar = int(provider_agreement.get("primary", {}).get("beatsPerBar") or 0) if isinstance(provider_agreement, dict) else 0
    if beats_per_bar <= 0:
        beats_per_bar = 4
    return {
        "beats": beats,
        "bars": bars,
        "beatStartsMs": beat_starts,
        "bpm": float(bpm) if bpm is not None else None,
        "timeSignature": time_signature or f"{beats_per_bar}/4",
        "beatsPerBar": beats_per_bar,
        "providerAgreement": provider_agreement,
        "providerResults": provider_results,
        "durationMs": int(duration_ms),
    }


def _cached_structure_segments(cached_modules: Optional[Dict[str, Any]], duration_ms: int) -> List[Dict[str, Any]]:
    if not isinstance(cached_modules, dict):
        return []
    structure_module = cached_modules.get("structureBackbone")
    if not isinstance(structure_module, dict):
        return []
    data = structure_module.get("data")
    if not isinstance(data, dict):
        return []
    segments = _sanitize_marks(data.get("segments") or [])
    out: List[Dict[str, Any]] = []
    for row in segments:
        start = int(row.get("startMs", 0))
        end = int(row.get("endMs", start + 1))
        if end <= start:
            continue
        next_row: Dict[str, Any] = {"startMs": start, "endMs": min(int(duration_ms), end)}
        label = str(row.get("label", "")).strip()
        if label:
            next_row["label"] = label
        family_id = str(row.get("familyId", "")).strip()
        family_label = str(row.get("familyLabel", "")).strip()
        if family_id:
            next_row["familyId"] = family_id
        if family_label:
            next_row["familyLabel"] = family_label
        if row.get("anchorIndex") is not None:
            try:
                next_row["anchorIndex"] = int(row.get("anchorIndex"))
            except Exception:
                pass
        if row.get("segmentIndex") is not None:
            try:
                next_row["segmentIndex"] = int(row.get("segmentIndex"))
            except Exception:
                pass
        out.append(next_row)
    return _sanitize_marks(out)


def _analyze_auto(path: str, analysis_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    candidates: List[Dict[str, Any]] = []
    errors: Dict[str, str] = {}
    for name, fn in (("beatnet", _analyze_with_beatnet), ("librosa", _analyze_with_librosa)):
        try:
            out = fn(path, analysis_profile)
            meta = out.get("meta") if isinstance(out, dict) else {}
            if isinstance(meta, dict):
                meta["autoCandidateProvider"] = name
            out["_autoProviderName"] = name
            out["_autoQualityScore"] = _analysis_quality_score(out)
            candidates.append(out)
        except Exception as err:
            errors[name] = str(err)
    if not candidates:
        raise RuntimeError(f"auto provider failed: {errors}")
    candidates.sort(
        key=lambda item: (
            float(item.get("_autoQualityScore", -999.0)),
            len(item.get("beats") or []),
            len(item.get("bars") or []),
        ),
        reverse=True,
    )
    best = candidates[0]
    meta = best.get("meta")
    if isinstance(meta, dict):
        meta["engine"] = str(best.get("_autoProviderName") or meta.get("engine") or "auto")
        meta["autoSelection"] = {
            "selectedProvider": str(best.get("_autoProviderName") or ""),
            "selectedScore": float(best.get("_autoQualityScore", -999.0)),
            "candidates": [
                {
                    "provider": str(c.get("_autoProviderName") or ""),
                    "qualityScore": float(c.get("_autoQualityScore", -999.0)),
                    "beats": int(len(c.get("beats") or [])),
                    "bars": int(len(c.get("bars") or [])),
                }
                for c in candidates
            ],
            "errors": errors,
        }
    best.pop("_autoProviderName", None)
    best.pop("_autoQualityScore", None)
    return best


def _analyze(path: str, provider: str, analysis_profile: Optional[Dict[str, Any]] = None, cached_modules: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    p = (provider or "librosa").strip().lower()
    if p == "librosa":
        return _analyze_with_librosa(path, analysis_profile, cached_modules=cached_modules)
    raise HTTPException(status_code=422, detail=f"Unsupported provider: {provider}. Only librosa is enabled.")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "xlightsdesigner-analysis",
        "librosaAvailable": _module_available("librosa"),
        "beatnetAvailable": _module_available("BeatNet.BeatNet"),
        "madmomChordAvailable": _module_available("madmom.features.chords") and _module_available("madmom.audio.signal"),
        "lyricsAutoShiftEnabled": bool(ENABLE_LYRICS_AUTO_SHIFT),
        "sectionProviders": _provider_config_state(),
    }


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    provider: str = Form("librosa"),
    analysisProfileMode: str = Form(""),
    cachedModulesJson: str = Form(""),
    fileName: str = Form(""),
    x_api_key: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _ensure_auth(x_api_key)
    suffix = os.path.splitext(file.filename or fileName or "audio.wav")[1] or ".wav"
    fd, temp_path = tempfile.mkstemp(prefix="xld-audio-", suffix=suffix)
    os.close(fd)
    try:
        payload = await file.read()
        with open(temp_path, "wb") as fh:
            fh.write(payload)
        cached_modules = None
        if str(cachedModulesJson or "").strip():
            try:
                parsed = json.loads(cachedModulesJson)
                if isinstance(parsed, dict):
                    cached_modules = parsed
            except Exception:
                cached_modules = None
        data = _analyze(temp_path, provider, _normalize_analysis_profile(analysisProfileMode), cached_modules=cached_modules)
        data["beats"] = _sanitize_marks(data.get("beats") or [])
        data["bars"] = _sanitize_marks(data.get("bars") or [])
        data["chords"] = _sanitize_marks(data.get("chords") or [])
        data["sections"] = _sanitize_marks(data.get("sections") or [])
        data["lyrics"] = _sanitize_marks(data.get("lyrics") or [])
        return {"ok": True, "data": data}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass
