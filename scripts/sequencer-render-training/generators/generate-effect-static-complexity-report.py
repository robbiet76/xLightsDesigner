#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


TYPE_WEIGHTS = {
    "numeric": 1.0,
    "enum": 1.1,
    "boolean": 0.7,
}

IMPORTANCE_WEIGHTS = {
    "high": 1.0,
    "medium": 0.65,
    "low": 0.35,
}

PRACTICAL_WEIGHTS = {
    "high": 1.0,
    "medium": 0.7,
    "low": 0.4,
    None: 0.75,
}

COMPLEXITY_THRESHOLDS = {
    "simple": 18.0,
    "moderate": 35.0,
}


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def parameter_score(name: str, payload: dict) -> dict:
    anchors = payload.get("anchors", [])
    anchor_count = len(anchors)
    type_name = payload.get("type", "numeric")
    type_weight = TYPE_WEIGHTS.get(type_name, 1.0)
    importance = payload.get("importance", "medium")
    importance_weight = IMPORTANCE_WEIGHTS.get(importance, 0.65)
    practical_priority = payload.get("practicalPriority")
    practical_weight = PRACTICAL_WEIGHTS.get(practical_priority, 0.75)
    interaction_count = len(payload.get("interactionHypotheses", []))
    applies_when = payload.get("appliesWhen")
    branching_factor = len(applies_when) if isinstance(applies_when, dict) else 0

    weighted_anchor_score = anchor_count * type_weight * importance_weight * practical_weight
    interaction_score = interaction_count * 0.9
    branching_score = branching_factor * 1.5
    total = round(weighted_anchor_score + interaction_score + branching_score, 3)

    return {
        "parameterName": name,
        "type": type_name,
        "anchorCount": anchor_count,
        "importance": importance,
        "practicalPriority": practical_priority,
        "interactionCount": interaction_count,
        "branchingFactor": branching_factor,
        "weightedAnchorScore": round(weighted_anchor_score, 3),
        "interactionScore": round(interaction_score, 3),
        "branchingScore": round(branching_score, 3),
        "totalScore": total,
    }


def classify_complexity(score: float) -> str:
    if score < COMPLEXITY_THRESHOLDS["simple"]:
        return "simple"
    if score < COMPLEXITY_THRESHOLDS["moderate"]:
        return "moderate"
    return "complex"


def effect_score(name: str, payload: dict) -> dict:
    parameter_scores = [
        parameter_score(parameter_name, parameter_payload)
        for parameter_name, parameter_payload in payload.get("parameters", {}).items()
    ]
    static_score = round(sum(item["totalScore"] for item in parameter_scores), 3)
    inferred_class = classify_complexity(static_score)
    configured_class = payload.get("complexityClass", "moderate")

    return {
        "effect": name,
        "configuredComplexityClass": configured_class,
        "inferredComplexityClass": inferred_class,
        "earlySamplingPolicy": payload.get("earlySamplingPolicy", "standard_screening"),
        "benchmarkGeometryFamilies": payload.get("benchmarkGeometryFamilies", []),
        "benchmarkRole": payload.get("benchmarkRole"),
        "staticComplexityScore": static_score,
        "parameterCount": len(parameter_scores),
        "parameterScores": sorted(parameter_scores, key=lambda item: (-item["totalScore"], item["parameterName"])),
        "classificationMatch": configured_class == inferred_class,
    }


def build_report(registry: dict) -> dict:
    effects = []
    mismatches = []
    for effect_name, payload in sorted(registry.get("effects", {}).items()):
        item = effect_score(effect_name, payload)
        effects.append(item)
        if not item["classificationMatch"]:
            mismatches.append(
                {
                    "effect": effect_name,
                    "configuredComplexityClass": item["configuredComplexityClass"],
                    "inferredComplexityClass": item["inferredComplexityClass"],
                    "staticComplexityScore": item["staticComplexityScore"],
                }
            )

    return {
        "version": "1.0",
        "description": "Static effect complexity report derived from registry metadata only.",
        "thresholds": COMPLEXITY_THRESHOLDS,
        "effectCount": len(effects),
        "effects": effects,
        "classificationMismatches": mismatches,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    registry = load_json(Path(args.registry))
    payload = build_report(registry)
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
