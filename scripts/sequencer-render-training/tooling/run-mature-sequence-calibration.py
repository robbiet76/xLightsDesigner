#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
TOOLING_DIR = ROOT_DIR / "scripts" / "sequencer-render-training" / "tooling"


def run(cmd):
    subprocess.run(cmd, cwd=ROOT_DIR, check=True)


def run_capture_json(cmd):
    result = subprocess.run(cmd, cwd=ROOT_DIR, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-dir")
    parser.add_argument("--manifest")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--sequence", action="append", default=[], help="Repeat for each sequence folder name")
    parser.add_argument("--window", action="append")
    parser.add_argument("--geometry-out")
    parser.add_argument("--initial-audit-only", action="store_true")
    parser.add_argument("--max-sequences", type=int, default=0)
    return parser.parse_args()


def first_fseq(sequence_dir: Path):
    matches = sorted(sequence_dir.glob("*.fseq"))
    if not matches:
        raise RuntimeError(f"no .fseq found in {sequence_dir}")
    return matches[0]


def manifest_sequences(manifest_path: Path, initial_audit_only: bool, max_sequences: int):
    manifest = read_json(manifest_path)
    rows = manifest.get("sequences", [])
    if initial_audit_only:
        rows = [row for row in rows if row.get("initialAuditSubset")]
    if max_sequences > 0:
        rows = rows[:max_sequences]
    result = []
    for row in rows:
        if not row.get("fseq", {}).get("present") or not row.get("fseq", {}).get("path"):
            continue
        result.append({
            "name": row.get("sequenceId") or row.get("folderName"),
            "folderPath": row.get("folderPath"),
            "fseqPath": row.get("fseq", {}).get("path"),
        })
    return manifest, result


def cli_sequences(show_dir: Path, sequence_names: list[str]):
    return [
        {
            "name": sequence_name,
            "folderPath": str(show_dir / sequence_name),
            "fseqPath": str(first_fseq(show_dir / sequence_name)),
        }
        for sequence_name in sequence_names
    ]


def main():
    args = parse_args()
    if not args.show_dir and not args.manifest:
        raise RuntimeError("--show-dir or --manifest is required")
    if args.show_dir and args.manifest:
        raise RuntimeError("use --show-dir or --manifest, not both")
    if args.show_dir and not args.sequence:
        raise RuntimeError("--sequence is required with --show-dir")

    manifest = None
    show_dir = Path(args.show_dir) if args.show_dir else None
    if args.manifest:
        manifest, sequence_rows = manifest_sequences(Path(args.manifest), args.initial_audit_only, args.max_sequences)
        show_dir = Path(manifest["showRoot"])
    else:
        sequence_rows = cli_sequences(show_dir, args.sequence)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    requested_windows = args.window or ["opening", "support", "peak"]
    windows = [str(row).strip() for row in requested_windows if str(row).strip()]
    geometry_path = Path(args.geometry_out) if args.geometry_out else (out_dir / "offline-preview-scene-geometry-show.json")

    run([
        "python3",
        str(TOOLING_DIR / "export-preview-scene-geometry-offline.py"),
        "--show-dir",
        str(show_dir),
        "--out",
        str(geometry_path),
    ])

    summary_rows = []
    for sequence_row in sequence_rows:
        sequence_name = sequence_row["name"]
        fseq_path = Path(sequence_row["fseqPath"])
        sequence_out_dir = out_dir / sequence_name.lower()
        sequence_out_dir.mkdir(parents=True, exist_ok=True)
        window_plan_path = sequence_out_dir / "window-plan.json"

        run([
            "python3",
            str(TOOLING_DIR / "build-mature-sequence-window-plan.py"),
            "--sequence-name",
            sequence_name,
            "--fseq",
            str(fseq_path),
            "--out",
            str(window_plan_path),
        ])

        for window_name in windows:
            offsets_path = sequence_out_dir / f"{window_name}.frame-offsets.json"
            run([
                "python3",
                str(TOOLING_DIR / "build-preview-window-frame-offsets.py"),
                "--window-plan",
                str(window_plan_path),
                "--window-name",
                window_name,
                "--out",
                str(offsets_path),
            ])

            plan = read_json(window_plan_path)
            window_row = next(row for row in plan["windows"] if str(row.get("name")) == window_name)
            offsets = read_json(offsets_path)
            base = sequence_out_dir / window_name
            preview_window_path = Path(f"{base}.preview-scene-window.json")
            render_observation_path = Path(f"{base}.render-observation.json")
            composition_observation_path = Path(f"{base}.composition-observation.json")
            progression_observation_path = Path(f"{base}.progression-observation.json")
            critique_path = Path(f"{base}.sequence-critique.json")

            run([
                "python3",
                str(TOOLING_DIR / "reconstruct-preview-scene-window.py"),
                "--geometry",
                str(geometry_path),
                "--fseq",
                str(fseq_path),
                "--window-start-ms",
                str(window_row["startMs"]),
                "--window-end-ms",
                str(window_row["endMs"]),
                "--frame-offsets",
                str(offsets["frameOffsetsCsv"]),
                "--out",
                str(preview_window_path),
            ])
            run([
                "python3",
                str(TOOLING_DIR / "extract-render-observation.py"),
                "--window",
                str(preview_window_path),
                "--out",
                str(render_observation_path),
            ])
            run([
                "python3",
                str(TOOLING_DIR / "extract-composition-observation.py"),
                "--observation",
                str(render_observation_path),
                "--out",
                str(composition_observation_path),
            ])
            run([
                "python3",
                str(TOOLING_DIR / "extract-progression-observation.py"),
                "--observation",
                str(render_observation_path),
                "--out",
                str(progression_observation_path),
            ])
            run([
                "python3",
                str(TOOLING_DIR / "extract-sequence-critique.py"),
                "--observation",
                str(render_observation_path),
                "--composition-observation",
                str(composition_observation_path),
                "--progression-observation",
                str(progression_observation_path),
                "--ladder-level",
                "macro",
                "--out",
                str(critique_path),
            ])

            render_observation = read_json(render_observation_path)
            composition = read_json(composition_observation_path)
            progression = read_json(progression_observation_path)
            critique = read_json(critique_path)
            summary_rows.append({
                "sequence": sequence_name,
                "window": window_name,
                "frameOffsetsCsv": offsets["frameOffsetsCsv"],
                "leadModel": render_observation["macro"].get("leadModel"),
                "leadShare": render_observation["macro"].get("leadModelShare"),
                "spread": render_observation["macro"].get("meanSceneSpreadRatio"),
                "attentionSeparation": composition["hierarchy"].get("attentionSeparation"),
                "attentionCompetition": composition["hierarchy"].get("attentionCompetition"),
                "occlusionRisk": composition["hierarchy"].get("occlusionRisk"),
                "developmentStrength": progression["development"].get("developmentStrength"),
                "stagnationRisk": progression["development"].get("stagnationRisk"),
                "repetitionStalenessRisk": progression["repetition"].get("stalenessRisk"),
                "energyArcCoherence": progression["energyArc"].get("arcCoherence"),
                "nextMoves": critique.get("nextMoves", []),
                "artifactPaths": {
                    "previewSceneWindow": str(preview_window_path),
                    "renderObservation": str(render_observation_path),
                    "compositionObservation": str(composition_observation_path),
                    "progressionObservation": str(progression_observation_path),
                    "sequenceCritique": str(critique_path),
                },
            })

    summary = {
        "artifactType": "mature_sequence_calibration_run_v1",
        "artifactVersion": 1,
        "showDir": str(show_dir),
        "manifestPath": str(args.manifest or ""),
        "geometryArtifactPath": str(geometry_path),
        "sequenceCount": len(sequence_rows),
        "windows": windows,
        "rows": summary_rows,
    }
    summary_path = out_dir / "mature-sequence-calibration-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "out": str(summary_path),
        "sequenceCount": summary["sequenceCount"],
        "rowCount": len(summary_rows),
    }, indent=2))


if __name__ == "__main__":
    main()
