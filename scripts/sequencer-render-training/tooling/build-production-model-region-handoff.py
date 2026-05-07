#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def text(value: Any = "") -> str:
    return str(value or "").strip()


def number(value: Any, fallback: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def round6(value: float) -> float:
    return round(float(value or 0.0), 6)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def child_text(root: ET.Element, path: str) -> str:
    node = root.find(path)
    return text(node.text if node is not None else "")


def sequence_duration_ms(root: ET.Element, effects: list[dict]) -> int:
    seconds = number(child_text(root, "./head/sequenceDuration"), 0.0)
    if seconds > 0:
        return int(round(seconds * 1000))
    return int(max([effect["endMs"] for effect in effects], default=0))


def int_ms(value: Any) -> int:
    return int(round(number(value, 0.0)))


def parse_effects(xsq_path: Path) -> tuple[ET.Element, list[dict]]:
    root = ET.parse(xsq_path).getroot()
    rows: list[dict] = []
    element_root = root.find("./ElementEffects")
    if element_root is None:
        return root, rows
    for element in element_root.findall("./Element"):
        target = text(element.attrib.get("name"))
        target_type = text(element.attrib.get("type"))
        for layer_index, layer in enumerate(element.findall("./EffectLayer")):
            for effect in layer.findall("./Effect"):
                name = text(effect.attrib.get("name"))
                if not name:
                    continue
                start_ms = int_ms(effect.attrib.get("startTime"))
                end_ms = int_ms(effect.attrib.get("endTime"))
                if end_ms <= start_ms:
                    continue
                rows.append({
                    "target": target,
                    "targetType": target_type,
                    "layerIndex": layer_index,
                    "name": name,
                    "startMs": start_ms,
                    "endMs": end_ms,
                    "durationMs": end_ms - start_ms,
                })
    return root, rows


def model_points(model: dict) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for node in model.get("nodes") or []:
        for coord in node.get("coords") or []:
            screen = coord.get("screen") or coord.get("world") or {}
            x = number(screen.get("x"), math.nan)
            y = number(screen.get("y"), math.nan)
            if math.isfinite(x) and math.isfinite(y):
                points.append((x, y))
    if not points:
        position = ((model.get("transform") or {}).get("position") or {})
        x = number(position.get("x"), math.nan)
        y = number(position.get("y"), math.nan)
        if math.isfinite(x) and math.isfinite(y):
            points.append((x, y))
    return points


def bounds_from_geometry(geometry: dict) -> dict:
    bounds = ((geometry.get("summaries") or {}).get("auditSceneBounds") or
              (geometry.get("summaries") or {}).get("sceneBounds") or {})
    min_row = bounds.get("min") or {}
    max_row = bounds.get("max") or {}
    return {
        "minX": number(min_row.get("x"), 0.0),
        "maxX": number(max_row.get("x"), 1.0),
        "minY": number(min_row.get("y"), 0.0),
        "maxY": number(max_row.get("y"), 1.0),
    }


def normalized(value: float, min_value: float, max_value: float) -> float:
    return clamp((value - min_value) / max(max_value - min_value, 0.000001))


def region_label(x: float, y: float) -> str:
    horizontal = "left" if x < 0.33 else "right" if x > 0.66 else "center"
    vertical = "top" if y < 0.33 else "bottom" if y > 0.66 else "middle"
    return f"{vertical}_{horizontal}"


def build_model_regions(geometry: dict) -> dict[str, dict]:
    bounds = bounds_from_geometry(geometry)
    regions: dict[str, dict] = {}
    for model in ((geometry.get("scene") or {}).get("models") or []):
        name = text(model.get("name") or model.get("id"))
        if not name:
            continue
        points = model_points(model)
        if not points:
            continue
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        center_x_raw = sum(xs) / len(xs)
        center_y_raw = sum(ys) / len(ys)
        center_x = normalized(center_x_raw, bounds["minX"], bounds["maxX"])
        center_y = normalized(center_y_raw, bounds["minY"], bounds["maxY"])
        width = normalized(max(xs), bounds["minX"], bounds["maxX"]) - normalized(min(xs), bounds["minX"], bounds["maxX"])
        height = normalized(max(ys), bounds["minY"], bounds["maxY"]) - normalized(min(ys), bounds["minY"], bounds["maxY"])
        regions[name] = {
            "target": name,
            "displayAs": text(model.get("displayAs") or model.get("type")),
            "auditEligible": bool(model.get("auditEligible", True)),
            "center": {"x": round6(center_x), "y": round6(center_y)},
            "region": region_label(center_x, center_y),
            "extent": {"width": round6(abs(width)), "height": round6(abs(height))},
            "nodeCount": len(model.get("nodes") or []),
        }
    return regions


def overlap_ms(effect: dict, start_ms: int, end_ms: int) -> int:
    return max(0, min(effect["endMs"], end_ms) - max(effect["startMs"], start_ms))


def average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def weighted_center(rows: list[dict]) -> dict:
    weight_sum = sum(row["weightMs"] for row in rows)
    if weight_sum <= 0:
        return {"x": 0.0, "y": 0.0}
    return {
        "x": round6(sum(row["region"]["center"]["x"] * row["weightMs"] for row in rows) / weight_sum),
        "y": round6(sum(row["region"]["center"]["y"] * row["weightMs"] for row in rows) / weight_sum),
    }


def distance(left: dict, right: dict) -> float:
    return math.sqrt((number(left.get("x")) - number(right.get("x"))) ** 2 + (number(left.get("y")) - number(right.get("y"))) ** 2)


def score_band(value: float, low: float, high: float) -> float:
    if value >= low and value <= high:
        return 1.0
    if value < low:
        return clamp(value / max(low, 0.000001))
    return clamp(1.0 - ((value - high) / max(high - low, 0.000001)))


def target_rows_for_window(effects: list[dict], model_regions: dict[str, dict], start_ms: int, end_ms: int) -> tuple[list[dict], list[dict]]:
    by_target: dict[str, dict] = {}
    unresolved: dict[str, int] = defaultdict(int)
    for effect in effects:
        amount = overlap_ms(effect, start_ms, end_ms)
        if amount <= 0:
            continue
        target = effect["target"]
        region = model_regions.get(target)
        if not region:
            unresolved[target] += amount
            continue
        row = by_target.setdefault(target, {
            "target": target,
            "weightMs": 0,
            "effectCount": 0,
            "effects": Counter(),
            "region": region,
        })
        row["weightMs"] += amount
        row["effectCount"] += 1
        row["effects"][effect["name"]] += 1
    resolved_rows = sorted(by_target.values(), key=lambda row: (-row["weightMs"], row["target"]))
    for row in resolved_rows:
        row["effects"] = [{"name": name, "count": count} for name, count in row["effects"].most_common(5)]
    unresolved_rows = [
        {"target": target, "weightMs": weight}
        for target, weight in sorted(unresolved.items(), key=lambda item: (-item[1], item[0]))[:12]
    ]
    return resolved_rows, unresolved_rows


def build_sequence_handoff(sequence: dict, model_regions: dict[str, dict], window_count: int) -> dict:
    xsq_path = Path(sequence["xsq"]["path"])
    root, effects = parse_effects(xsq_path)
    duration_ms = sequence_duration_ms(root, effects)
    windows = []
    for index in range(window_count):
        start_ms = int(round((index * duration_ms) / window_count))
        end_ms = int(round(((index + 1) * duration_ms) / window_count))
        resolved, unresolved = target_rows_for_window(effects, model_regions, start_ms, end_ms)
        total_weight = sum(row["weightMs"] for row in resolved) + sum(row["weightMs"] for row in unresolved)
        resolved_weight = sum(row["weightMs"] for row in resolved)
        center = weighted_center(resolved)
        lead = resolved[0] if resolved else None
        active_regions = sorted(set(row["region"]["region"] for row in resolved))
        windows.append({
            "windowIndex": index,
            "startMs": start_ms,
            "endMs": end_ms,
            "resolvedActivityRatio": round6(resolved_weight / total_weight) if total_weight else 0.0,
            "activeResolvedTargetCount": len(resolved),
            "activeRegionCount": len(active_regions),
            "activeRegions": active_regions,
            "weightedCenter": center,
            "leadTarget": lead["target"] if lead else "",
            "leadRegion": lead["region"]["region"] if lead else "",
            "leadShareOfResolved": round6(lead["weightMs"] / resolved_weight) if lead and resolved_weight else 0.0,
            "topResolvedTargets": [
                {
                    "target": row["target"],
                    "weightMs": row["weightMs"],
                    "region": row["region"]["region"],
                    "center": row["region"]["center"],
                    "effects": row["effects"],
                }
                for row in resolved[:8]
            ],
            "topUnresolvedTargets": unresolved,
        })
    center_moves = [distance(windows[index]["weightedCenter"], windows[index - 1]["weightedCenter"]) for index in range(1, len(windows))]
    lead_changes = [
        1.0 if windows[index]["leadTarget"] and windows[index]["leadTarget"] != windows[index - 1]["leadTarget"] else 0.0
        for index in range(1, len(windows))
    ]
    region_changes = [
        1.0 if windows[index]["leadRegion"] and windows[index]["leadRegion"] != windows[index - 1]["leadRegion"] else 0.0
        for index in range(1, len(windows))
    ]
    resolved_ratios = [window["resolvedActivityRatio"] for window in windows]
    active_region_counts = [window["activeRegionCount"] for window in windows]
    avg_center_move = average(center_moves)
    lead_change_ratio = average(lead_changes)
    region_change_ratio = average(region_changes)
    resolved_ratio = average(resolved_ratios)
    handoff_score = average([
        resolved_ratio,
        score_band(avg_center_move, 0.025, 0.22),
        score_band(lead_change_ratio, 0.15, 0.85),
        score_band(region_change_ratio, 0.08, 0.65),
        score_band(average(active_region_counts), 1.5, 5.0),
    ])
    return {
        "sequenceId": text(sequence.get("sequenceId") or sequence.get("folderName")),
        "xsqPath": str(xsq_path),
        "durationMs": duration_ms,
        "windowCount": window_count,
        "scores": {
            "modelAwareFocalHandoff": round6(handoff_score),
            "resolvedActivityRatio": round6(resolved_ratio),
            "leadTargetChangeRatio": round6(lead_change_ratio),
            "leadRegionChangeRatio": round6(region_change_ratio),
            "averageCenterMovement": round6(avg_center_move),
            "averageActiveRegionCount": round6(average(active_region_counts)),
        },
        "confidence": "model_aware" if resolved_ratio >= 0.35 else "partial_model_aware",
        "windows": windows,
    }


def stats(values: list[float]) -> dict:
    rows = sorted([value for value in values if math.isfinite(value)])
    if not rows:
        return {"count": 0, "min": 0, "mean": 0, "max": 0, "range": 0}
    return {
        "count": len(rows),
        "min": round6(rows[0]),
        "mean": round6(average(rows)),
        "max": round6(rows[-1]),
        "range": round6(rows[-1] - rows[0]),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--geometry", required=True)
    parser.add_argument("--baseline", help="Optional production_video_calibration_baseline_v1 used to restrict scoring to accepted references")
    parser.add_argument("--out", required=True)
    parser.add_argument("--window-count", type=int, default=6)
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    geometry_path = Path(args.geometry)
    manifest = read_json(manifest_path)
    geometry = read_json(geometry_path)
    baseline = read_json(Path(args.baseline)) if args.baseline else None
    accepted_ids = {
        text(row.get("sequenceId"))
        for row in (baseline or {}).get("references", [])
        if text(row.get("sequenceId"))
    }
    model_regions = build_model_regions(geometry)
    sequence_rows = [
        row for row in manifest.get("sequences", [])
        if row.get("readOnly") is True and text((row.get("xsq") or {}).get("path"))
    ]
    if accepted_ids:
        scored_sequence_rows = [
            row for row in sequence_rows
            if text(row.get("sequenceId") or row.get("folderName")) in accepted_ids
        ]
    else:
        scored_sequence_rows = sequence_rows
    excluded_rows = [
        {
            "sequenceId": text(row.get("sequenceId") or row.get("folderName")),
            "reason": "not_in_accepted_production_video_baseline" if accepted_ids else "not_scored",
        }
        for row in sequence_rows
        if row not in scored_sequence_rows
    ]
    references = [build_sequence_handoff(row, model_regions, max(2, args.window_count)) for row in scored_sequence_rows]
    score_keys = [
        "modelAwareFocalHandoff",
        "resolvedActivityRatio",
        "leadTargetChangeRatio",
        "leadRegionChangeRatio",
        "averageCenterMovement",
        "averageActiveRegionCount",
    ]
    score_ranges = {
        key: stats([number(row["scores"].get(key), math.nan) for row in references])
        for key in score_keys
    }
    artifact = {
        "artifactType": "production_model_region_handoff_v1",
        "artifactVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manifestPath": str(manifest_path),
        "geometryPath": str(geometry_path),
        "baselinePath": str(args.baseline or ""),
        "metricScope": "full_sequence_render",
        "promotionUse": "scorer_calibration_only",
        "policy": {
            "calibrationOnly": True,
            "requiresHumanReviewBeforeTrainingUse": True,
            "unresolvedTargetsAreNotInferred": True,
        },
        "summary": {
            "sourceSequenceCount": len(sequence_rows),
            "sequenceCount": len(references),
            "excludedSequenceCount": len(excluded_rows),
            "modelRegionCount": len(model_regions),
            "windowCount": max(2, args.window_count),
            "partialConfidenceCount": sum(1 for row in references if row["confidence"] == "partial_model_aware"),
        },
        "scoreRanges": score_ranges,
        "excludedReferences": excluded_rows,
        "references": references,
    }
    write_json(Path(args.out), artifact)
    print(json.dumps({
        "ok": True,
        "out": args.out,
        "sequenceCount": len(references),
        "scoreRanges": score_ranges,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
