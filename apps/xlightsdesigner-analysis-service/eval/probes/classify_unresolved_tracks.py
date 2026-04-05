#!/usr/bin/env python3
import argparse
import importlib.util
import json
import os
from pathlib import Path
from typing import Any, Dict, List


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


def _is_identified(identity: Dict[str, Any]) -> bool:
    return bool(str(identity.get("title") or "").strip())


def _looks_instrumental(identity: Dict[str, Any]) -> bool:
    title = str(identity.get("title") or "").lower()
    return "instrumental" in title


def _classify_row(meta: Dict[str, Any]) -> str:
    identity = meta.get("trackIdentity") or {}
    verification = meta.get("identityVerification") or {}
    verification_status = str(verification.get("status") or "").strip()
    lyrics_source = str(meta.get("lyricsSource") or "").strip()
    plain = meta.get("plainLyricsPhraseFallback") or {}
    suggestion = meta.get("providerMetadataSuggestion") or {}
    section_source = str(meta.get("sectionSource") or "").strip()

    if verification_status == "unknown":
        return "unidentified_audio_only"
    if lyrics_source and lyrics_source != "none":
        return "identified_with_synced_lyrics"
    if bool(plain.get("available")):
        return "identified_plain_phrase_fallback"
    if verification_status == "metadata_needed" or bool(suggestion.get("available")):
        return "identified_metadata_needed"
    if _is_identified(identity) and _looks_instrumental(identity):
        return "identified_instrumental_audio_only"
    if verification_status == "claimed_identity_only" or _is_identified(identity):
        if section_source == "audio-structural-heuristic":
            return "identified_vocal_lyrics_unavailable"
        return "identified_audio_only"
    return "unidentified_audio_only"


def main() -> int:
    ap = argparse.ArgumentParser(description="Classify unresolved tracks into instrumental, metadata-needed, fallback, and provider-miss buckets.")
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
    tracks = _track_paths(args)
    if not tracks:
        raise SystemExit("No tracks provided.")

    rows: List[Dict[str, Any]] = []
    counts: Dict[str, int] = {}
    for path in tracks:
        result = module._analyze_with_librosa(str(path), analysis_profile=module._normalize_analysis_profile("deep"))
        meta = result.get("meta") or {}
        identity = meta.get("trackIdentity") or {}
        classification = _classify_row(meta)
        counts[classification] = counts.get(classification, 0) + 1
        rows.append({
            "file": path.name,
            "classification": classification,
            "identity": {
                "title": identity.get("title"),
                "artist": identity.get("artist"),
                "provider": identity.get("provider"),
            },
            "identityVerification": meta.get("identityVerification") or {},
            "lyricsSource": meta.get("lyricsSource"),
            "sectionSource": meta.get("sectionSource"),
            "plainLyricsPhraseFallback": {
                "available": bool((meta.get("plainLyricsPhraseFallback") or {}).get("available")),
                "matchedArtist": (meta.get("plainLyricsPhraseFallback") or {}).get("geniusMatchedArtist"),
                "phraseCount": (meta.get("plainLyricsPhraseFallback") or {}).get("phraseCount"),
                "blockedReason": (meta.get("plainLyricsPhraseFallback") or {}).get("lyricsRecoveryBlockedReason"),
            },
            "providerMetadataSuggestion": meta.get("providerMetadataSuggestion") or {},
        })

    print(json.dumps({
        "trackCount": len(rows),
        "counts": counts,
        "rows": rows,
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
