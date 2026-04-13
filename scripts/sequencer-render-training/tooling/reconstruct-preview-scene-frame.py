#!/usr/bin/env python3
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-dir", required=True)
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--fseq", required=True)
    parser.add_argument("--window-start-ms", type=int, required=True)
    parser.add_argument("--window-end-ms", type=int, required=True)
    parser.add_argument("--frame-offset", type=int, default=0)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def load_model(show_dir, model_name):
    path = os.path.join(show_dir, "xlights_rgbeffects.xml")
    root = ET.parse(path).getroot()
    models = root.find("models")
    if models is None:
        raise RuntimeError("xlights_rgbeffects.xml missing <models>")
    for model in models.findall("model"):
        if model.attrib.get("name") == model_name:
            return model.attrib
    raise RuntimeError(f"model not found: {model_name}")


def infer_channels_per_node(string_type):
    string_type = (string_type or "").strip().lower()
    if "rgb" in string_type:
        return 3
    if "single color" in string_type:
        return 1
    return 3


def build_single_line_geometry(attrs):
    node_count = int(attrs.get("parm2", "0") or "0")
    if node_count <= 0:
        raise RuntimeError("single-line model missing parm2 node count")

    start_x = float(attrs.get("WorldPosX", "0") or "0")
    start_y = float(attrs.get("WorldPosY", "0") or "0")
    start_z = float(attrs.get("WorldPosZ", "0") or "0")
    delta_x = float(attrs.get("X2", "0") or "0")
    delta_y = float(attrs.get("Y2", "0") or "0")
    delta_z = float(attrs.get("Z2", "0") or "0")
    start_channel_one = int(attrs.get("StartChannel", "0") or "0")
    if start_channel_one <= 0:
        raise RuntimeError("model missing StartChannel")

    channels_per_node = infer_channels_per_node(attrs.get("StringType"))
    nodes = []
    for idx in range(node_count):
        t = 0.0 if node_count == 1 else idx / float(node_count - 1)
        nodes.append({
            "nodeId": idx,
            "stringIndex": 0,
            "channelStart": start_channel_one + (idx * channels_per_node),
            "channelCount": channels_per_node,
            "screen": {
                "x": start_x + (delta_x * t),
                "y": start_y + (delta_y * t),
                "z": start_z + (delta_z * t),
            },
        })
    return {
        "name": attrs.get("name"),
        "displayAs": attrs.get("DisplayAs"),
        "geometryMode": "xml_single_line_proof",
        "nodeCount": node_count,
        "channelsPerNode": channels_per_node,
        "nodes": nodes,
    }


def build_matrix_geometry(attrs):
    rows = int(attrs.get("parm1", "0") or "0")
    cols = int(attrs.get("parm2", "0") or "0")
    if rows <= 0 or cols <= 0:
        raise RuntimeError("matrix model missing parm1/parm2 dimensions")

    origin_x = float(attrs.get("WorldPosX", "0") or "0")
    origin_y = float(attrs.get("WorldPosY", "0") or "0")
    origin_z = float(attrs.get("WorldPosZ", "0") or "0")
    step_x = float(attrs.get("ScaleX", "1") or "1")
    step_y = float(attrs.get("ScaleY", "1") or "1")
    start_channel_one = int(attrs.get("StartChannel", "0") or "0")
    if start_channel_one <= 0:
        raise RuntimeError("model missing StartChannel")

    channels_per_node = infer_channels_per_node(attrs.get("StringType"))
    start_side = (attrs.get("StartSide") or "T").strip().upper()
    direction = (attrs.get("Dir") or "L").strip().upper()

    # Proof-only geometry:
    # - world position is treated as the top-left anchor for StartSide=T
    # - rows grow downward
    # - columns grow rightward
    # - Dir=L reverses per-row node indexing, which matches a common horizontal matrix winding
    nodes = []
    node_index = 0
    row_iter = range(rows) if start_side == "T" else range(rows - 1, -1, -1)
    for logical_row in row_iter:
        col_iter = range(cols - 1, -1, -1) if direction == "L" else range(cols)
        for logical_col in col_iter:
            x = origin_x + (logical_col * step_x)
            y = origin_y + (logical_row * step_y)
            nodes.append({
                "nodeId": node_index,
                "stringIndex": logical_row,
                "channelStart": start_channel_one + (node_index * channels_per_node),
                "channelCount": channels_per_node,
                "screen": {
                    "x": x,
                    "y": y,
                    "z": origin_z,
                },
                "grid": {
                    "row": logical_row,
                    "col": logical_col,
                },
            })
            node_index += 1

    return {
        "name": attrs.get("name"),
        "displayAs": attrs.get("DisplayAs"),
        "geometryMode": "xml_matrix_proof",
        "nodeCount": rows * cols,
        "channelsPerNode": channels_per_node,
        "rows": rows,
        "cols": cols,
        "nodes": nodes,
    }


def build_decoder():
    result = subprocess.run(
        ["bash", "scripts/sequencer-render-training/tooling/build-fseq-window-decoder.sh"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip().splitlines()[-1]


def decode_window(decoder, fseq_path, geometry, window_start_ms, window_end_ms):
    start_channel_zero = geometry["nodes"][0]["channelStart"] - 1
    channel_count = geometry["nodeCount"] * geometry["channelsPerNode"]
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
        str(geometry["nodeCount"]),
        "--channels-per-node",
        str(geometry["channelsPerNode"]),
        "--frame-mode",
        "full",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        detail = stderr or stdout or f"decoder exited {result.returncode}"
        raise RuntimeError(f"fseq decode failed: {detail}")
    return json.loads(result.stdout)


def join_frame(geometry, frame):
    joined_nodes = []
    for idx, geo_node in enumerate(geometry["nodes"]):
        rgb = frame["nodeRgb"][idx]
        brightness = frame["nodeBrightness"][idx]
        active = frame["nodeActive"][idx] == 1
        joined_nodes.append({
            "nodeId": geo_node["nodeId"],
            "channelStart": geo_node["channelStart"],
            "channelCount": geo_node["channelCount"],
            "screen": geo_node["screen"],
            **({"grid": geo_node["grid"]} if "grid" in geo_node else {}),
            "rgb": {"r": rgb[0], "g": rgb[1], "b": rgb[2]},
            "brightness": brightness,
            "active": active,
        })
    return joined_nodes


def compute_frame_summary(nodes):
    active_nodes = [node for node in nodes if node["active"]]
    if not active_nodes:
        return {
            "activeNodeCount": 0,
            "activeNodeRatio": 0.0,
            "bounds": None,
            "centroid": None,
            "averageBrightness": 0.0,
        }

    total_brightness = sum(node["brightness"] for node in nodes)
    weighted_x = sum(node["screen"]["x"] * node["brightness"] for node in nodes)
    weighted_y = sum(node["screen"]["y"] * node["brightness"] for node in nodes)
    weighted_z = sum(node["screen"]["z"] * node["brightness"] for node in nodes)
    min_x = min(node["screen"]["x"] for node in active_nodes)
    min_y = min(node["screen"]["y"] for node in active_nodes)
    min_z = min(node["screen"]["z"] for node in active_nodes)
    max_x = max(node["screen"]["x"] for node in active_nodes)
    max_y = max(node["screen"]["y"] for node in active_nodes)
    max_z = max(node["screen"]["z"] for node in active_nodes)

    return {
        "activeNodeCount": len(active_nodes),
        "activeNodeRatio": len(active_nodes) / float(len(nodes)),
        "bounds": {
            "min": {"x": min_x, "y": min_y, "z": min_z},
            "max": {"x": max_x, "y": max_y, "z": max_z},
        },
        "centroid": {
            "x": 0.0 if total_brightness == 0 else weighted_x / total_brightness,
            "y": 0.0 if total_brightness == 0 else weighted_y / total_brightness,
            "z": 0.0 if total_brightness == 0 else weighted_z / total_brightness,
        },
        "averageBrightness": total_brightness / float(len(nodes)),
    }


def main():
    args = parse_args()
    attrs = load_model(args.show_dir, args.model_name)
    display_as = (attrs.get("DisplayAs") or "").strip().lower()
    if display_as == "single line":
        geometry = build_single_line_geometry(attrs)
    elif display_as == "horiz matrix":
        geometry = build_matrix_geometry(attrs)
    else:
        raise RuntimeError(f"proof does not yet support DisplayAs={attrs.get('DisplayAs')}")
    decoded = decode_window(
        build_decoder(),
        args.fseq,
        geometry,
        args.window_start_ms,
        args.window_end_ms,
    )

    frames = decoded.get("frames") or []
    if not frames:
        raise RuntimeError("decoder did not emit frames")
    if args.frame_offset < 0 or args.frame_offset >= len(frames):
        raise RuntimeError(f"frame offset {args.frame_offset} out of range 0..{len(frames)-1}")

    frame = frames[args.frame_offset]
    joined_nodes = join_frame(geometry, frame)
    artifact = {
        "artifactType": "preview_scene_frame_v1",
        "artifactVersion": 1,
        "source": {
            "showDir": os.path.abspath(args.show_dir),
            "modelName": args.model_name,
            "fseqPath": os.path.abspath(args.fseq),
            "windowStartMs": args.window_start_ms,
            "windowEndMs": args.window_end_ms,
            "frameOffset": args.frame_offset,
            "frameIndex": frame["frameIndex"],
            "frameTimeMs": frame["frameTimeMs"],
            "geometryMode": geometry["geometryMode"],
            "decoderMode": decoded.get("frameMode"),
        },
        "model": {
            "name": geometry["name"],
            "displayAs": geometry["displayAs"],
            "nodeCount": geometry["nodeCount"],
            "channelsPerNode": geometry["channelsPerNode"],
            **({"rows": geometry["rows"], "cols": geometry["cols"]} if "rows" in geometry else {}),
        },
        "frameSummary": compute_frame_summary(joined_nodes),
        "nodes": joined_nodes,
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "frameIndex": frame["frameIndex"],
        "frameTimeMs": frame["frameTimeMs"],
        "activeNodeCount": artifact["frameSummary"]["activeNodeCount"],
        "activeNodeRatio": artifact["frameSummary"]["activeNodeRatio"],
    }, indent=2))


if __name__ == "__main__":
    main()
