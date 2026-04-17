#!/usr/bin/env python3
import argparse
import json
import os
import subprocess


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--geometry", required=True)
    parser.add_argument("--fseq", required=True)
    parser.add_argument("--window-start-ms", type=int, required=True)
    parser.add_argument("--window-end-ms", type=int, required=True)
    parser.add_argument("--frame-offsets", required=True, help="Comma-separated offsets within the decoded window, e.g. 8,10,12")
    parser.add_argument("--out", required=True)
    parser.add_argument("--include-audit-excluded", action="store_true")
    return parser.parse_args()


def build_decoder():
    result = subprocess.run(
        ["bash", "scripts/sequencer-render-training/tooling/build-fseq-window-decoder.sh"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip().splitlines()[-1]


def load_geometry(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def decode_model_window(decoder, fseq_path, model, window_start_ms, window_end_ms):
    nodes = model["nodes"]
    if not nodes:
        return None
    channel_counts = {node["channelCount"] for node in nodes}
    if len(channel_counts) != 1:
        raise RuntimeError(f"model {model['name']} has mixed channel counts")
    channels_per_node = next(iter(channel_counts))
    start_channel_zero = nodes[0]["channelStart"]
    channel_count = len(nodes) * channels_per_node
    cmd = [
        decoder,
        "--fseq",
        fseq_path,
        "--start-channel",
        str(start_channel_zero),
        "--channel-count",
        str(channel_count),
        "--window-start-ms",
        str(window_start_ms),
        "--window-end-ms",
        str(window_end_ms),
        "--node-count",
        str(len(nodes)),
        "--channels-per-node",
        str(channels_per_node),
        "--frame-mode",
        "full",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        detail = (result.stderr or "").strip() or (result.stdout or "").strip() or f"decoder exited {result.returncode}"
        raise RuntimeError(f"decode failed for {model['name']}: {detail}")
    return json.loads(result.stdout)


def compute_active_bounds(active_nodes):
    if not active_nodes:
        return None
    xs = [n["screen"]["x"] for n in active_nodes]
    ys = [n["screen"]["y"] for n in active_nodes]
    zs = [n["screen"]["z"] for n in active_nodes]
    return {
        "min": {"x": min(xs), "y": min(ys), "z": min(zs)},
        "max": {"x": max(xs), "y": max(ys), "z": max(zs)},
    }


def compute_centroid(active_nodes):
    if not active_nodes:
        return None
    total = sum(node["brightness"] for node in active_nodes)
    if total <= 0:
        return None
    return {
        "x": sum(node["screen"]["x"] * node["brightness"] for node in active_nodes) / total,
        "y": sum(node["screen"]["y"] * node["brightness"] for node in active_nodes) / total,
        "z": sum(node["screen"]["z"] * node["brightness"] for node in active_nodes) / total,
    }


def join_active_nodes(model, frame):
    active = []
    for idx, node in enumerate(model["nodes"]):
        if frame["nodeActive"][idx] != 1:
            continue
        rgb = frame["nodeRgb"][idx]
        active.append({
            "nodeId": node["nodeId"],
            "stringIndex": node["stringIndex"],
            "screen": node["coords"][0]["screen"] if node.get("coords") else None,
            "rgb": {"r": rgb[0], "g": rgb[1], "b": rgb[2]},
            "brightness": frame["nodeBrightness"][idx],
        })
    return active


def main():
    args = parse_args()
    frame_offsets = [int(part) for part in args.frame_offsets.split(",") if part.strip()]
    geometry = load_geometry(args.geometry)
    decoder = build_decoder()

    geometry_models = geometry["scene"]["models"]
    if not args.include_audit_excluded:
        geometry_models = [m for m in geometry_models if m.get("auditEligible", True)]

    per_model = {}
    for model in geometry_models:
        per_model[model["name"]] = decode_model_window(
            decoder,
            args.fseq,
            model,
            args.window_start_ms,
            args.window_end_ms,
        )

    model_lookup = {m["name"]: m for m in geometry_models}
    window_frames = []
    for frame_offset in frame_offsets:
        frame_models = []
        total_active_nodes = 0
        for model_name, decoded in per_model.items():
            if decoded is None:
                continue
            frames = decoded.get("frames") or []
            if frame_offset < 0 or frame_offset >= len(frames):
                raise RuntimeError(f"frame offset {frame_offset} out of range for model {model_name}")
            frame = frames[frame_offset]
            model = model_lookup[model_name]
            active_nodes = join_active_nodes(model, frame)
            if not active_nodes:
                continue
            total_active_nodes += len(active_nodes)
            frame_models.append({
                "modelName": model_name,
                "displayAs": model["displayAs"],
                "activeNodeCount": len(active_nodes),
                "activeNodeRatio": frame["activeNodeRatio"],
                "averageNodeBrightness": frame["averageNodeBrightness"],
                "centroidPosition": frame["centroidPosition"],
                "activeBounds": compute_active_bounds(active_nodes),
                "activeCentroid": compute_centroid(active_nodes),
                "activeNodes": active_nodes,
            })
        first_decoded = next(iter(per_model.values()))
        source_frame = (first_decoded.get("frames") or [])[frame_offset]
        window_frames.append({
            "frameOffset": frame_offset,
            "frameIndex": source_frame["frameIndex"],
            "frameTimeMs": source_frame["frameTimeMs"],
            "activeModelCount": len(frame_models),
            "activeNodeCount": total_active_nodes,
            "models": frame_models,
        })

    artifact = {
        "artifactType": "preview_scene_window_v1",
        "artifactVersion": 1,
        "source": {
            "geometryArtifactPath": os.path.abspath(args.geometry),
            "fseqPath": os.path.abspath(args.fseq),
            "windowStartMs": args.window_start_ms,
            "windowEndMs": args.window_end_ms,
            "frameOffsets": frame_offsets,
            "auditExcludedIncluded": bool(args.include_audit_excluded),
        },
        "geometryReference": {
            "artifactType": geometry["artifactType"],
            "artifactVersion": geometry["artifactVersion"],
            "artifactPath": os.path.abspath(args.geometry),
            "layoutName": geometry.get("source", {}).get("layoutName"),
            "showFolder": geometry.get("source", {}).get("showFolder"),
            "modelCount": len(geometry_models),
        },
        "frames": window_frames,
        "summaries": {
            "frameCount": len(window_frames),
            "maxActiveModelCount": max((f["activeModelCount"] for f in window_frames), default=0),
            "maxActiveNodeCount": max((f["activeNodeCount"] for f in window_frames), default=0),
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
