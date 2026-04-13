#!/usr/bin/env python3
import argparse
import json
import os


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--window", action="append", dest="windows", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def main():
    args = parse_args()
    windows = [load_json(path) for path in args.windows]
    if not windows:
        raise RuntimeError("at least one window is required")

    base = windows[0]
    frame_count = len(base["frames"])
    frame_offsets = [frame["frameOffset"] for frame in base["frames"]]
    frame_times = [frame["frameTimeMs"] for frame in base["frames"]]

    for other in windows[1:]:
        if len(other["frames"]) != frame_count:
            raise RuntimeError("all windows must have the same frame count")
        for idx, frame in enumerate(other["frames"]):
            if frame["frameOffset"] != frame_offsets[idx] or frame["frameTimeMs"] != frame_times[idx]:
                raise RuntimeError("all windows must align on frame offsets and frame times")

    merged_frames = []
    for idx in range(frame_count):
        models = []
        total_active_nodes = 0
        for window in windows:
            source_frame = window["frames"][idx]
            models.extend(source_frame["models"])
            total_active_nodes += source_frame["activeNodeCount"]
        merged_frames.append({
            "frameOffset": frame_offsets[idx],
            "frameIndex": base["frames"][idx]["frameIndex"],
            "frameTimeMs": frame_times[idx],
            "activeModelCount": len(models),
            "activeNodeCount": total_active_nodes,
            "models": models,
        })

    artifact = {
        "artifactType": "preview_scene_window_v1",
        "artifactVersion": 1,
        "source": {
            "mode": "composite_window_merge",
            "sourceWindowPaths": [os.path.abspath(path) for path in args.windows],
        },
        "geometryReference": base["geometryReference"],
        "frames": merged_frames,
        "summaries": {
            "frameCount": len(merged_frames),
            "maxActiveModelCount": max((f["activeModelCount"] for f in merged_frames), default=0),
            "maxActiveNodeCount": max((f["activeNodeCount"] for f in merged_frames), default=0),
        },
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "summaries": artifact["summaries"],
    }, indent=2))


if __name__ == "__main__":
    main()
