#!/usr/bin/env python3
import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any


def _load_main(module_path: Path):
    spec = importlib.util.spec_from_file_location("analysis_main", str(module_path))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load analysis service module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _track_paths(args: argparse.Namespace) -> list[Path]:
    rows: list[Path] = []
    if args.track:
        rows.extend(Path(v).expanduser() for v in args.track)
    if args.track_list:
        for line in Path(args.track_list).expanduser().read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if text:
                rows.append(Path(text).expanduser())
    if args.audio_dir:
        rows.extend(sorted(Path(args.audio_dir).expanduser().glob("*.mp3")))
    # preserve order, remove duplicates
    out: list[Path] = []
    seen = set()
    for row in rows:
        key = str(row.resolve()) if row.exists() else str(row)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan tracks for direct synced lyrics vs plain-lyrics fallback candidacy.")
    ap.add_argument("--audio-dir", help="Directory of audio files to scan")
    ap.add_argument("--track", action="append", help="Specific track path to scan; may be repeated")
    ap.add_argument("--track-list", help="Text file containing one track path per line")
    ap.add_argument(
        "--module-path",
        default=str(Path(__file__).resolve().parents[1] / "main.py"),
        help="Path to analysis-service main.py",
    )
    args = ap.parse_args()

    module = _load_main(Path(args.module_path).expanduser())
    profile_fast = module._normalize_analysis_profile("fast")
    profile_deep = module._normalize_analysis_profile("deep")
    tracks = _track_paths(args)
    if not tracks:
        raise SystemExit("No tracks provided.")

    summary = {
        "trackCount": 0,
        "directSyncedLyrics": 0,
        "plainLyricsFallbackCandidates": 0,
        "noProviderMatch": 0,
        "rows": [],
    }

    for path in tracks:
        source_metadata = module._source_metadata_from_path(str(path))
        identity, _, _, _ = module._resolve_identity_and_web(str(path), profile_fast)
        direct_marks, direct_error, _ = module._fetch_lrclib_lyrics_direct(identity, 180000, profile_deep)
        plain_lines, plain_error, plain_info = module._fetch_genius_plain_lyrics(identity)
        if direct_marks:
            classification = "direct_synced_lyrics"
            summary["directSyncedLyrics"] += 1
        elif plain_lines:
            classification = "plain_lyrics_fallback_candidate"
            summary["plainLyricsFallbackCandidates"] += 1
        else:
            classification = "no_provider_match"
            summary["noProviderMatch"] += 1
        summary["trackCount"] += 1
        summary["rows"].append(
            {
                "file": path.name,
                "path": str(path),
                "classification": classification,
                "identity": {
                    "title": identity.get("title"),
                    "artist": identity.get("artist"),
                    "provider": identity.get("provider"),
                },
                "sourceMetadata": {
                    "embeddedTitle": source_metadata.get("embeddedTitle"),
                    "embeddedArtist": source_metadata.get("embeddedArtist"),
                },
                "directSyncedLyrics": {
                    "lineCount": len(direct_marks),
                    "error": direct_error,
                },
                "plainLyrics": {
                    "lineCount": len(plain_lines),
                    "error": plain_error,
                    "matchedTitle": plain_info.get("geniusMatchedTitle"),
                    "matchedArtist": plain_info.get("geniusMatchedArtist"),
                },
            }
        )

    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
