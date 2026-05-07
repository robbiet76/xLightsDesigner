#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from datetime import date

DEFAULT_READ_GOALS = [
    "whole_display_energy_arc",
    "section_contrast",
    "target_usage_and_handoff",
    "effect_vocabulary_and_variation",
    "color_story",
    "density_and_brightness_ranges",
    "submodel_usage_when_present"
]


def read_metadata(path: Path | None) -> dict:
    if path is None:
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def metadata_for_sequence(metadata: dict, sequence_id: str) -> dict:
    sequences = metadata.get("sequences", {})
    if isinstance(sequences, dict):
        return sequences.get(sequence_id, {})
    if isinstance(sequences, list):
        for row in sequences:
            if row.get("sequenceId") == sequence_id or row.get("folderName") == sequence_id:
                return row
    return {}


def build_manifest(show_root: Path, metadata: dict | None = None, exclude_folders: list[str] | None = None) -> dict:
    metadata = metadata or {}
    excluded_folders = set(metadata.get("excludedFolders", []))
    excluded_folders.update(exclude_folders or [])
    initial_subset = metadata.get("initialAuditSubset", [])
    sequences = []
    for folder in sorted([p for p in show_root.iterdir() if p.is_dir()]):
        if (
            folder.name == "Static"
            or folder.name in excluded_folders
            or folder.name.startswith(".")
            or folder.name.startswith("_")
        ):
            continue
        xsqs = sorted(folder.glob("*.xsq"))
        fseqs = sorted(folder.glob("*.fseq"))
        if not xsqs:
            continue
        sequence_metadata = metadata_for_sequence(metadata, folder.name)
        sequence_read_goals = sequence_metadata.get("readGoals") or metadata.get("defaultReadGoals") or DEFAULT_READ_GOALS
        initial_audit_subset = bool(sequence_metadata.get("initialAuditSubset", folder.name in initial_subset))
        sequence = {
            "sequenceId": folder.name,
            "folderName": folder.name,
            "folderPath": str(folder),
            "readOnly": True,
            "benchmarkUse": "production_sequence_read_calibration",
            "expectedEvidenceScope": "full_sequence_render",
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
            "styleTags": sequence_metadata.get("styleTags", []),
            "initialAuditSubset": initial_audit_subset,
            "humanReview": sequence_metadata.get("humanReview", {
                "status": "pending",
                "notes": "",
                "knownStrengths": [],
                "knownWeaknesses": []
            }),
            "readGoals": sequence_read_goals,
        }
        sequences.append(sequence)

    return {
        "artifactType": "production_sequence_read_benchmark_manifest_v1",
        "artifactVersion": 1,
        "schema": "production_sequence_read_benchmark_manifest_v1",
        "createdAt": date.today().isoformat(),
        "showRoot": str(show_root),
        "readOnly": True,
        "excludedFolders": sorted(["Static", *excluded_folders]),
        "policy": {
            "purpose": "production_sequence_read_calibration_only",
            "trainSequencingPolicy": False,
            "copyStylisticPatterns": False,
            "mutateSourceSequences": False,
            "promotionRequiresHumanReview": True,
            "allowRenderFromXSQWhenNeeded": True,
            "primaryOutcome": "calibrate_whole_display_sequence_reading",
        },
        "evidencePriority": [
            "full_sequence_render",
            "section_render",
            "target_composition",
            "layer_stack",
            "effect_capability"
        ],
        "summary": {
            "sequenceCount": len(sequences),
            "withFseq": sum(1 for row in sequences if row["fseq"]["present"]),
            "requiresRender": sum(1 for row in sequences if row["requiresRender"]),
            "initialAuditSubsetCount": sum(1 for row in sequences if row["initialAuditSubset"]),
        },
        "metadataSource": str(metadata.get("metadataSource", "")),
        "initialAuditSubset": initial_subset,
        "sequences": sequences,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-root", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--benchmark-metadata")
    parser.add_argument("--exclude-folder", action="append", default=[])
    args = parser.parse_args()

    show_root = Path(args.show_root)
    metadata_path = Path(args.benchmark_metadata) if args.benchmark_metadata else None
    metadata = read_metadata(metadata_path)
    if metadata_path is not None:
        metadata["metadataSource"] = str(metadata_path)
    manifest = build_manifest(show_root, metadata, args.exclude_folder)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
