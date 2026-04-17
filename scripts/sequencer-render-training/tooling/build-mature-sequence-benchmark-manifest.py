#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

INITIAL_SUBSET = [
    "Intro_ElectricChristmas",
    "Intro_Magical",
    "CozyLittleChristmas",
    "CarolOfTheBells",
    "ChristmasMedley",
    "HolidayRoad",
    "LittleDrummerBoy_TobyMac",
    "PolarExpress",
    "SleighRide",
    "WeWishYouXmas_Muppets",
    "WinterWonderland",
    "YouMakeItFeelLikeXmas",
]


def infer_style_tags(folder_name: str) -> list[str]:
    name = folder_name.lower()
    tags: list[str] = []
    if name.startswith("intro") or "greeting" in name:
        tags.append("intro")
    if any(token in name for token in ["medley", "muppets", "trolls", "babyshark", "remix"]):
        tags.append("novelty")
    if any(token in name for token in ["sarajevo", "bells", "drummer", "polar", "wonderland"]):
        tags.append("dramatic")
    if any(token in name for token in ["holidayroad", "rock", "runrun", "zydeco", "feeling"]):
        tags.append("high_energy")
    if any(token in name for token in ["cozy", "holly", "mostwonderful", "linus", "youmakeitfeel"]):
        tags.append("warm")
    if any(token in name for token in ["snow", "winter", "sleigh", "rudolph", "santa", "xmas", "christmas"]):
        tags.append("seasonal")
    return tags or ["general"]


def build_manifest(show_root: Path) -> dict:
    sequences = []
    for folder in sorted([p for p in show_root.iterdir() if p.is_dir()]):
        if folder.name == "Static":
            continue
        xsqs = sorted(folder.glob("*.xsq"))
        fseqs = sorted(folder.glob("*.fseq"))
        if not xsqs:
            continue
        sequence = {
            "folderName": folder.name,
            "folderPath": str(folder),
            "readOnly": True,
            "xsq": {
                "path": str(xsqs[0]),
                "name": xsqs[0].name,
            },
            "fseq": {
                "present": bool(fseqs),
                "path": str(fseqs[0]) if len(fseqs) == 1 else None,
                "name": fseqs[0].name if len(fseqs) == 1 else None,
                "count": len(fseqs),
            },
            "requiresRender": not bool(fseqs),
            "styleTags": infer_style_tags(folder.name),
            "initialAuditSubset": folder.name in INITIAL_SUBSET,
        }
        sequences.append(sequence)

    return {
        "schema": "mature_sequence_benchmark_manifest_v1",
        "date": "2026-04-17",
        "showRoot": str(show_root),
        "readOnly": True,
        "excludedFolders": ["Static"],
        "policy": {
            "purpose": "render_understanding_audit_only",
            "trainSequencingPolicy": False,
            "copyStylisticPatterns": False,
            "allowRenderFromXSQWhenNeeded": True,
        },
        "summary": {
            "sequenceCount": len(sequences),
            "withFseq": sum(1 for row in sequences if row["fseq"]["present"]),
            "requiresRender": sum(1 for row in sequences if row["requiresRender"]),
            "initialAuditSubsetCount": sum(1 for row in sequences if row["initialAuditSubset"]),
        },
        "initialAuditSubset": INITIAL_SUBSET,
        "sequences": sequences,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-root", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    show_root = Path(args.show_root)
    manifest = build_manifest(show_root)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
