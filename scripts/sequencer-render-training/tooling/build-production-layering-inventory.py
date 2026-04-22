#!/usr/bin/env python3
import argparse
import json
import os
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--xsq", action="append", default=[])
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def strv(value):
    return str(value or "").strip()


def num(value, fallback=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def windows_overlap(left, right):
    return left["startMs"] < right["endMs"] and right["startMs"] < left["endMs"]


def is_aggregate_target(target_id):
    normalized = strv(target_id)
    return normalized.startswith("All") or normalized.endswith("_All")


def classify_case(target_id, left, right, overlap_duration_ms):
    names = {strv(left.get("effectName")), strv(right.get("effectName"))}
    identical_effect = strv(left.get("effectName")) == strv(right.get("effectName"))
    identical_window = left.get("startMs") == right.get("startMs") and left.get("endMs") == right.get("endMs")
    if overlap_duration_ms < 250:
        return "low", "very_short_overlap"
    if "Off" in names:
        return "low", "off_layer_overlap"
    if "Video" in names:
        return "low", "video_layer_overlap"
    if identical_effect and identical_window:
        return "low", "duplicate_layer_shape"
    if is_aggregate_target(target_id):
        return "medium", "aggregate_target"
    if overlap_duration_ms >= 1000 and len(names) >= 2:
        return "high", "distinct_effect_overlap"
    return "medium", "general_overlap"


def read_sequence_layers(xsq_path):
    root = ET.parse(xsq_path).getroot()
    element_effects = root.find("ElementEffects")
    if element_effects is None:
        return []

    rows = []
    for element in element_effects.findall("Element"):
        if strv(element.get("type")) != "model":
            continue
        target_id = strv(element.get("name"))
        if not target_id:
            continue
        for layer_index, layer in enumerate(element.findall("EffectLayer")):
            for effect in layer.findall("Effect"):
                start_ms = num(effect.get("startTime"))
                end_ms = num(effect.get("endTime"))
                if end_ms <= start_ms:
                    continue
                rows.append({
                    "targetId": target_id,
                    "layerIndex": layer_index,
                    "effectName": strv(effect.get("name")),
                    "effectId": strv(effect.get("id")) or f"{layer_index}:{start_ms}:{end_ms}:{strv(effect.get('name'))}",
                    "startMs": start_ms,
                    "endMs": end_ms,
                })
    return rows


def build_overlap_cases(sequence_name, xsq_path, placements):
    by_target = defaultdict(list)
    for row in placements:
        by_target[row["targetId"]].append(row)

    cases = []
    for target_id, target_rows in by_target.items():
        target_rows.sort(key=lambda row: (row["startMs"], row["endMs"], row["layerIndex"], row["effectName"]))
        for i, left in enumerate(target_rows):
            for right in target_rows[i + 1:]:
                if left["layerIndex"] == right["layerIndex"]:
                    continue
                if not windows_overlap(left, right):
                    continue
                overlap_start = max(left["startMs"], right["startMs"])
                overlap_end = min(left["endMs"], right["endMs"])
                suitability, reason = classify_case(target_id, left, right, overlap_end - overlap_start)
                cases.append({
                    "caseId": f"{sequence_name}:{target_id}:{left['effectId']}|{right['effectId']}",
                    "taxonomy": "same_target_layer_stack",
                    "sequenceName": sequence_name,
                    "xsqPath": xsq_path,
                    "targetId": target_id,
                    "overlapStartMs": overlap_start,
                    "overlapEndMs": overlap_end,
                    "overlapDurationMs": overlap_end - overlap_start,
                    "calibrationSuitability": suitability,
                    "suitabilityReason": reason,
                    "effects": [
                        {
                            "layerIndex": left["layerIndex"],
                            "effectName": left["effectName"],
                            "effectId": left["effectId"],
                            "startMs": left["startMs"],
                            "endMs": left["endMs"],
                        },
                        {
                            "layerIndex": right["layerIndex"],
                            "effectName": right["effectName"],
                            "effectId": right["effectId"],
                            "startMs": right["startMs"],
                            "endMs": right["endMs"],
                        },
                    ],
                })
    return cases


def main():
    args = parse_args()
    if not args.xsq:
        raise RuntimeError("At least one --xsq path is required")

    sequences = []
    all_cases = []

    for xsq_path in args.xsq:
        abs_path = os.path.abspath(xsq_path)
        sequence_name = os.path.splitext(os.path.basename(abs_path))[0]
        placements = read_sequence_layers(abs_path)
        overlap_cases = build_overlap_cases(sequence_name, abs_path, placements)
        sequences.append({
            "sequenceName": sequence_name,
            "xsqPath": abs_path,
            "modelElementCount": len({row["targetId"] for row in placements}),
            "effectPlacementCount": len(placements),
            "sameTargetLayerOverlapCount": len(overlap_cases),
        })
        all_cases.extend(overlap_cases)

    all_cases.sort(key=lambda row: (-row["overlapDurationMs"], row["sequenceName"], row["targetId"], row["overlapStartMs"]))

    artifact = {
        "artifactType": "production_layering_inventory_v1",
        "artifactVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sequenceCount": len(sequences),
        "caseCount": len(all_cases),
        "suitabilityCounts": {
            "high": len([row for row in all_cases if row.get("calibrationSuitability") == "high"]),
            "medium": len([row for row in all_cases if row.get("calibrationSuitability") == "medium"]),
            "low": len([row for row in all_cases if row.get("calibrationSuitability") == "low"]),
        },
        "sequences": sequences,
        "cases": all_cases,
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "sequenceCount": len(sequences),
        "caseCount": len(all_cases),
    }, indent=2))


if __name__ == "__main__":
    main()
