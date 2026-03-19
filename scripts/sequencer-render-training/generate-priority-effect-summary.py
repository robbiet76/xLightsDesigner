#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict
from pathlib import Path


SYSTEM_LABEL_PREFIXES = (
    "registry_generated",
    "range_sample",
    "derived_from_registry",
)


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def normalize_label_set(labels):
    cleaned = []
    for label in labels:
        if label in SYSTEM_LABEL_PREFIXES:
            continue
        cleaned.append(label)
    return sorted(set(cleaned))


def region_to_summary(region: dict) -> dict:
    signature = region.get("signature", {})
    labels = normalize_label_set(signature.get("labels", []))
    intent_tags = sorted(label.split(":", 1)[1] for label in labels if label.startswith("intent:"))
    pattern_families = sorted(label.split(":", 1)[1] for label in labels if label.startswith("pattern_family:"))
    structural_labels = [
        label for label in labels
        if not label.startswith("intent:") and not label.startswith("pattern_family:")
    ]
    return {
        "startValue": region.get("startValue"),
        "endValue": region.get("endValue"),
        "sampleCount": len(region.get("sampleIds", [])),
        "sampleIds": region.get("sampleIds", []),
        "lookFamily": signature.get("lookFamily"),
        "qualityBand": signature.get("qualityBand"),
        "restraintBand": signature.get("restraintBand"),
        "clarityBand": signature.get("clarityBand"),
        "patternFamilies": pattern_families,
        "intentTags": intent_tags,
        "structuralLabels": structural_labels,
        "usefulnessRange": region.get("usefulnessRange", {}),
    }


def load_manifest_context(run_dir: Path):
    manifest_path = run_dir / "manifest.normalized.json"
    manifest = load_json(manifest_path)
    fixture = manifest.get("fixture", {})
    samples = manifest.get("samples", [])
    first_sample = samples[0] if samples else {}
    effect = first_sample.get("effectName") or manifest.get("effectName") or "unknown"
    geometry_profile = fixture.get("modelName") or "unknown"
    resolved_model_type = fixture.get("modelType") or "unknown"
    run_name = run_dir.name
    return {
        "effect": effect,
        "modelName": geometry_profile,
        "resolvedModelType": resolved_model_type,
        "runName": run_name,
        "manifestPath": str(manifest_path),
    }


def load_record_context(run_dir: Path):
    run_summary_path = run_dir / "run-summary.json"
    run_summary = load_json(run_summary_path)
    results = run_summary.get("results", [])
    if not results:
        return {}
    first_record_path = results[0].get("recordPath")
    if not first_record_path:
        return {}
    record = load_json(Path(first_record_path))
    fixture = record.get("fixture", {})
    return {
        "geometryProfile": fixture.get("geometryProfile"),
        "modelName": fixture.get("modelName"),
        "resolvedModelType": fixture.get("modelType"),
    }


def scan_run(run_root: Path):
    entries = []
    for path in sorted(run_root.glob("*/region-summary.json")):
        report = load_json(path)
        context = load_manifest_context(path.parent)
        record_context = load_record_context(path.parent)
        entries.append({
            "effect": context["effect"],
            "geometryProfile": record_context.get("geometryProfile") or context["modelName"],
            "modelName": record_context.get("modelName") or context["modelName"],
            "resolvedModelType": record_context.get("resolvedModelType") or context["resolvedModelType"],
            "runName": context["runName"],
            "path": str(path),
            "manifestPath": context["manifestPath"],
            "parameterName": report.get("parameterName") or report.get("param"),
            "target": report.get("target", "effectSettings"),
            "observedImpact": report.get("observedImpact", {}),
            "regionCount": report.get("regionCount", 0),
            "regions": [region_to_summary(region) for region in report.get("regions", [])],
        })
    return entries


def build_summary(run_roots):
    ordered_entries = []
    source_runs = []
    for source_index, run_root in enumerate(run_roots):
        run_root = Path(run_root)
        source_runs.append(str(run_root))
        for entry in scan_run(run_root):
            entry["_sourceIndex"] = source_index
            ordered_entries.append(entry)

    # Later runs should replace earlier runs for the same semantic slice.
    deduped = {}
    for entry in ordered_entries:
        for region in entry["regions"]:
            key = (
                entry["effect"],
                entry["geometryProfile"],
                entry["parameterName"],
                json.dumps(region.get("startValue"), sort_keys=True),
                json.dumps(region.get("endValue"), sort_keys=True),
            )
            deduped[key] = entry

    all_entries = []
    seen_entry_ids = set()
    for entry in deduped.values():
        entry_id = (
            entry["effect"],
            entry["geometryProfile"],
            entry["parameterName"],
            entry["runName"],
            entry["path"],
        )
        if entry_id in seen_entry_ids:
            continue
        seen_entry_ids.add(entry_id)
        all_entries.append(entry)

    effects = defaultdict(lambda: {"geometries": defaultdict(lambda: {"parameters": []})})
    impact_counts = defaultdict(int)

    for entry in all_entries:
        effect_bucket = effects[entry["effect"]]
        geometry_bucket = effect_bucket["geometries"][entry["geometryProfile"]]
        geometry_bucket["parameters"].append(entry)
        status = entry.get("observedImpact", {}).get("status")
        if status:
            impact_counts[status] += 1

    summary_effects = {}
    for effect, effect_bucket in sorted(effects.items()):
        geometries_payload = {}
        for geometry, geometry_bucket in sorted(effect_bucket["geometries"].items()):
            params = sorted(geometry_bucket["parameters"], key=lambda item: item["parameterName"])
            resolved_model_types = sorted({
                param.get("resolvedModelType")
                for param in params
                if param.get("resolvedModelType")
            })
            observed_intents = sorted({
                intent
                for param in params
                for region in param["regions"]
                for intent in region["intentTags"]
            })
            observed_patterns = sorted({
                pattern
                for param in params
                for region in param["regions"]
                for pattern in region["patternFamilies"]
            })
            statuses = sorted({
                param.get("observedImpact", {}).get("status")
                for param in params
                if param.get("observedImpact", {}).get("status")
            })
            high_impact_params = [
                param["parameterName"]
                for param in params
                if param.get("observedImpact", {}).get("status") == "high_impact_observed"
            ]
            geometries_payload[geometry] = {
                "parameterCount": len(params),
                "resolvedModelTypes": resolved_model_types,
                "observedImpactStatuses": statuses,
                "highImpactParameters": high_impact_params,
                "observedIntentTags": observed_intents,
                "observedPatternFamilies": observed_patterns,
                "parameters": params,
            }
        summary_effects[effect] = {
            "geometryCount": len(geometries_payload),
            "geometries": geometries_payload,
        }

    return {
        "version": "1.0",
        "description": "Consolidated machine-readable summary of priority-effect region findings.",
        "sourceRuns": source_runs,
        "effectCount": len(summary_effects),
        "parameterImpactStatusCounts": dict(sorted(impact_counts.items())),
        "effects": summary_effects,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", action="append", required=True, help="Run root containing per-pack region-summary.json files")
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    payload = build_summary(args.run_root)
    out_path = Path(args.out_file)
    out_path.write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
