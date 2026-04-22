#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--window-plan", required=True)
    parser.add_argument("--window-name", required=True)
    parser.add_argument("--out")
    return parser.parse_args()


def clamp(value, low, high):
    return max(low, min(high, value))


def unique_ordered(values):
    out = []
    seen = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def build_offsets(duration_ms: int, step_time_ms: int):
    frame_count = max(1, int(duration_ms // step_time_ms))
    last_index = max(0, frame_count - 1)
    if frame_count <= 5:
        return list(range(frame_count))
    ratios = [0.08, 0.28, 0.5, 0.72, 0.92]
    offsets = [
        clamp(int(round(last_index * ratio)), 0, last_index)
        for ratio in ratios
    ]
    offsets = unique_ordered(offsets)
    if len(offsets) < 3 and frame_count >= 3:
        offsets = unique_ordered([0, last_index // 2, last_index])
    return offsets


def main():
    args = parse_args()
    plan_path = Path(args.window_plan)
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    window = next(
        (row for row in (plan.get("windows") or []) if str(row.get("name") or "").strip() == args.window_name),
        None,
    )
    if window is None:
        raise SystemExit(f"window not found: {args.window_name}")
    step_time_ms = int(plan.get("stepTimeMs") or 0)
    duration_ms = int(window.get("durationMs") or 0)
    if step_time_ms <= 0 or duration_ms <= 0:
        raise SystemExit("window plan missing positive stepTimeMs/durationMs")

    offsets = build_offsets(duration_ms, step_time_ms)
    artifact = {
        "artifactType": "preview_window_frame_offsets_v1",
        "artifactVersion": 1,
        "windowPlanRef": str(plan_path),
        "windowName": args.window_name,
        "stepTimeMs": step_time_ms,
        "durationMs": duration_ms,
        "frameCountEstimate": max(1, int(duration_ms // step_time_ms)),
        "frameOffsets": offsets,
        "frameOffsetsCsv": ",".join(str(value) for value in offsets),
        "samplingMode": "broad_window",
    }

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(artifact, indent=2))


if __name__ == "__main__":
    main()
