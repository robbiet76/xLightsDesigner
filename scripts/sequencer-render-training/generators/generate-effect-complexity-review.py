#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


OBSERVED_THRESHOLDS = {
    "simple": 8.0,
    "moderate": 18.0,
}


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def classify(score: float, thresholds: dict) -> str:
    if score < thresholds["simple"]:
        return "simple"
    if score < thresholds["moderate"]:
        return "moderate"
    return "complex"


def build_static_index(payload: dict) -> dict:
    return {item["effect"]: item for item in payload.get("effects", [])}


def build_maturity_index(payload: dict) -> dict:
    return {item["effect"]: item for item in payload.get("effects", [])}


def observed_score(maturity_item: dict) -> dict:
    geometry_count = len(maturity_item.get("supportedGeometryProfiles", []))
    high_impact_count = len(maturity_item.get("highImpactObserved", []))
    interaction_count = len(maturity_item.get("interactionSuspected", []))
    context_flat_count = len(maturity_item.get("contextFlatObserved", []))

    retrieval = maturity_item.get("evaluation", {}).get("retrieval", {})
    selection = maturity_item.get("evaluation", {}).get("selection", {})
    controlled = maturity_item.get("evaluation", {}).get("controlledVocabulary", {})

    score = (
        geometry_count * 2.0
        + high_impact_count * 0.6
        + interaction_count * 1.25
        + retrieval.get("passedCount", 0) * 0.9
        + selection.get("passedCount", 0) * 1.1
        + controlled.get("passedCount", 0) * 0.8
        - context_flat_count * 0.2
    )

    return {
        "observedComplexityScore": round(score, 3),
        "observedComplexityClass": classify(score, OBSERVED_THRESHOLDS),
        "factors": {
            "geometryCount": geometry_count,
            "highImpactCount": high_impact_count,
            "interactionSuspectedCount": interaction_count,
            "contextFlatCount": context_flat_count,
            "retrievalPassedCount": retrieval.get("passedCount", 0),
            "selectionPassedCount": selection.get("passedCount", 0),
            "controlledVocabularyPassedCount": controlled.get("passedCount", 0),
        },
    }


def review_effect(effect_name: str, static_index: dict, maturity_index: dict) -> dict:
    static_item = static_index.get(effect_name)
    maturity_item = maturity_index.get(effect_name)
    if not static_item or not maturity_item:
        return None

    observed = observed_score(maturity_item)
    combined_score = round(
        static_item["staticComplexityScore"] * 0.55 + observed["observedComplexityScore"] * 0.45,
        3,
    )
    combined_class = classify(combined_score, {"simple": 13.0, "moderate": 26.0})

    return {
        "effect": effect_name,
        "configuredComplexityClass": static_item["configuredComplexityClass"],
        "staticComplexityScore": static_item["staticComplexityScore"],
        "staticComplexityClass": static_item["inferredComplexityClass"],
        "observedComplexityScore": observed["observedComplexityScore"],
        "observedComplexityClass": observed["observedComplexityClass"],
        "combinedComplexityScore": combined_score,
        "combinedComplexityClass": combined_class,
        "currentMaturityStage": maturity_item.get("currentStage"),
        "supportedGeometryProfiles": maturity_item.get("supportedGeometryProfiles", []),
        "observedFactors": observed["factors"],
        "agreement": {
            "configuredVsStatic": static_item["configuredComplexityClass"] == static_item["inferredComplexityClass"],
            "configuredVsObserved": static_item["configuredComplexityClass"] == observed["observedComplexityClass"],
            "configuredVsCombined": static_item["configuredComplexityClass"] == combined_class,
        },
    }


def build_report(static_payload: dict, maturity_payload: dict) -> dict:
    static_index = build_static_index(static_payload)
    maturity_index = build_maturity_index(maturity_payload)
    effects = []
    mismatches = []

    for effect_name in sorted(static_index.keys()):
        item = review_effect(effect_name, static_index, maturity_index)
        if not item:
            continue
        effects.append(item)
        if not item["agreement"]["configuredVsCombined"]:
            mismatches.append(
                {
                    "effect": effect_name,
                    "configuredComplexityClass": item["configuredComplexityClass"],
                    "combinedComplexityClass": item["combinedComplexityClass"],
                    "staticComplexityClass": item["staticComplexityClass"],
                    "observedComplexityClass": item["observedComplexityClass"],
                    "combinedComplexityScore": item["combinedComplexityScore"],
                }
            )

    return {
        "version": "1.0",
        "description": "Combined complexity review from registry-only static complexity and observed training evidence.",
        "effectCount": len(effects),
        "observedThresholds": OBSERVED_THRESHOLDS,
        "effects": effects,
        "combinedClassMismatches": mismatches,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--static-complexity", required=True)
    parser.add_argument("--maturity", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    static_payload = load_json(Path(args.static_complexity))
    maturity_payload = load_json(Path(args.maturity))
    payload = build_report(static_payload, maturity_payload)
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
