#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from collections import Counter
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


def int_ms(value: Any) -> int:
    return int(round(number(value, 0.0)))


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
    max_end = max([int(effect["endMs"]) for effect in effects], default=0)
    return max_end


def display_elements(root: ET.Element) -> list[dict]:
    rows = []
    for element in root.findall("./DisplayElements/Element"):
        rows.append({
            "name": text(element.attrib.get("name")),
            "type": text(element.attrib.get("type")),
            "visible": text(element.attrib.get("visible", "1")) != "0",
            "active": text(element.attrib.get("active", "1")) != "0",
            "views": [text(row) for row in text(element.attrib.get("views")).split(",") if text(row)]
        })
    return rows


def element_effects(root: ET.Element) -> tuple[list[dict], list[dict], list[dict]]:
    effects: list[dict] = []
    timing_marks: list[dict] = []
    target_rows: list[dict] = []
    element_root = root.find("./ElementEffects")
    if element_root is None:
        return effects, timing_marks, target_rows

    for element in element_root.findall("./Element"):
        target_name = text(element.attrib.get("name"))
        target_type = text(element.attrib.get("type"))
        layer_count = 0
        target_effect_count = 0
        for layer_index, layer in enumerate(element.findall("./EffectLayer")):
            layer_count += 1
            for effect in layer.findall("./Effect"):
                name = text(effect.attrib.get("name"))
                label = text(effect.attrib.get("label"))
                start_ms = int_ms(effect.attrib.get("startTime"))
                end_ms = int_ms(effect.attrib.get("endTime"))
                row = {
                    "target": target_name,
                    "targetType": target_type,
                    "layerIndex": layer_index,
                    "name": name,
                    "label": label,
                    "startMs": start_ms,
                    "endMs": end_ms,
                    "durationMs": max(0, end_ms - start_ms),
                    "ref": text(effect.attrib.get("ref")),
                    "palette": text(effect.attrib.get("palette"))
                }
                if name:
                    effects.append(row)
                    target_effect_count += 1
                elif label:
                    timing_marks.append(row)
        target_rows.append({
            "target": target_name,
            "targetType": target_type,
            "layerCount": layer_count,
            "effectCount": target_effect_count
        })
    return effects, timing_marks, target_rows


def top_counter_rows(counter: Counter, limit: int = 20) -> list[dict]:
    return [{"name": name, "count": count} for name, count in counter.most_common(limit)]


def target_usage_rows(effects: list[dict], target_rows: list[dict]) -> list[dict]:
    by_target: dict[str, list[dict]] = {}
    for effect in effects:
        by_target.setdefault(effect["target"], []).append(effect)
    layer_count_by_target = {row["target"]: row["layerCount"] for row in target_rows}
    rows = []
    for target, target_effects in by_target.items():
        starts = [effect["startMs"] for effect in target_effects]
        ends = [effect["endMs"] for effect in target_effects]
        effect_names = Counter(effect["name"] for effect in target_effects if effect["name"])
        rows.append({
            "target": target,
            "effectCount": len(target_effects),
            "layerCount": layer_count_by_target.get(target, 0),
            "activeDurationMs": sum(effect["durationMs"] for effect in target_effects),
            "firstStartMs": min(starts) if starts else 0,
            "lastEndMs": max(ends) if ends else 0,
            "distinctEffectCount": len(effect_names),
            "topEffects": top_counter_rows(effect_names, 8)
        })
    return sorted(rows, key=lambda row: (-row["effectCount"], row["target"]))


def timing_window_rows(timing_marks: list[dict], limit: int = 40) -> list[dict]:
    rows = sorted(timing_marks, key=lambda row: (row["startMs"], row["endMs"], row["label"]))
    return [
        {
            "label": row["label"],
            "startMs": row["startMs"],
            "endMs": row["endMs"],
            "durationMs": row["durationMs"],
            "sourceTarget": row["target"]
        }
        for row in rows[:limit]
    ]


def audit_sequence(sequence: dict) -> dict:
    xsq_path = Path(sequence["xsq"]["path"])
    root = ET.parse(xsq_path).getroot()
    display = display_elements(root)
    effects, timing_marks, target_rows = element_effects(root)
    duration_ms = sequence_duration_ms(root, effects)
    effect_counter = Counter(effect["name"] for effect in effects if effect["name"])
    model_elements = [row for row in display if row["type"] == "model"]
    timing_elements = [row for row in display if row["type"] == "timing"]
    active_targets = [row for row in target_usage_rows(effects, target_rows) if row["effectCount"] > 0]
    first_effect_ms = min([effect["startMs"] for effect in effects], default=0)
    last_effect_ms = max([effect["endMs"] for effect in effects], default=0)
    timeline_span_ms = max(0, last_effect_ms - first_effect_ms)
    coverage_ratio = round(timeline_span_ms / duration_ms, 6) if duration_ms > 0 else 0
    return {
        "sequenceId": text(sequence.get("sequenceId") or sequence.get("folderName")),
        "metricScope": "full_sequence_render",
        "promotionUse": "calibration_reference_only",
        "readOnly": True,
        "source": {
            "folderPath": text(sequence.get("folderPath")),
            "xsqPath": str(xsq_path),
            "fseqPath": text(sequence.get("fseq", {}).get("path")),
            "requiresRenderForVideo": bool(sequence.get("requiresRender"))
        },
        "metadata": {
            "sequenceTiming": child_text(root, "./head/sequenceTiming"),
            "sequenceType": child_text(root, "./head/sequenceType"),
            "mediaFile": child_text(root, "./head/mediaFile"),
            "durationMs": duration_ms,
            "styleTags": sequence.get("styleTags", []),
            "initialAuditSubset": bool(sequence.get("initialAuditSubset"))
        },
        "structure": {
            "displayElementCount": len(display),
            "modelElementCount": len(model_elements),
            "timingElementCount": len(timing_elements),
            "targetWithEffectCount": len(active_targets),
            "effectCount": len(effects),
            "distinctEffectCount": len(effect_counter),
            "timingMarkCount": len(timing_marks),
            "topEffects": top_counter_rows(effect_counter, 20),
            "targetUsage": active_targets[:40],
            "timingWindows": timing_window_rows(timing_marks)
        },
        "timeline": {
            "firstEffectMs": first_effect_ms,
            "lastEffectMs": last_effect_ms,
            "effectTimelineSpanMs": timeline_span_ms,
            "effectTimelineCoverageRatio": coverage_ratio
        },
        "readGoals": sequence.get("readGoals", []),
        "humanReview": sequence.get("humanReview", {"status": "pending"})
    }


def aggregate(rows: list[dict]) -> dict:
    effects = Counter()
    for row in rows:
        for effect in row["structure"]["topEffects"]:
            effects[effect["name"]] += effect["count"]
    return {
        "sequenceCount": len(rows),
        "totalEffectCount": sum(row["structure"]["effectCount"] for row in rows),
        "totalTimingMarkCount": sum(row["structure"]["timingMarkCount"] for row in rows),
        "distinctEffectCount": len(effects),
        "topEffects": top_counter_rows(effects, 25),
        "sequencesRequiringRenderForVideo": sum(1 for row in rows if row["source"]["requiresRenderForVideo"])
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--initial-audit-only", action="store_true")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest = read_json(manifest_path)
    sequences = manifest.get("sequences", [])
    if args.initial_audit_only:
        sequences = [row for row in sequences if row.get("initialAuditSubset")]
    rows = [audit_sequence(row) for row in sequences]
    artifact = {
        "artifactType": "production_sequence_read_audit_v1",
        "artifactVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manifestRef": str(manifest_path),
        "readOnly": True,
        "metricScope": "full_sequence_render",
        "promotionUse": "calibration_reference_only",
        "policy": manifest.get("policy", {}),
        "summary": aggregate(rows),
        "sequences": rows
    }
    write_json(Path(args.out), artifact)
    print(json.dumps({
        "ok": True,
        "out": args.out,
        "sequenceCount": len(rows),
        "totalEffectCount": artifact["summary"]["totalEffectCount"]
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
