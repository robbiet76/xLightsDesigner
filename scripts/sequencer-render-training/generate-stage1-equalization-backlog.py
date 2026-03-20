#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


DEFAULT_ACTIONS = {
    "On": [
        "generate_effect_summary",
        "generate_effect_intent_map",
        "build_structural_retrieval_eval",
        "build_selector_cases",
        "update_equalization_board",
    ],
    "Shimmer": [
        "generate_effect_summary",
        "generate_effect_intent_map",
        "build_structural_retrieval_eval",
        "build_cross_effect_selector_cases",
        "update_equalization_board",
    ],
    "Color Wash": [
        "generate_effect_summary",
        "generate_effect_intent_map",
        "build_structural_retrieval_eval",
        "add_selector_competition_cases",
        "update_equalization_board",
    ],
    "SingleStrand": [
        "generate_effect_summary",
        "generate_effect_intent_map",
        "build_structural_retrieval_eval",
        "add_selector_competition_cases",
        "update_equalization_board",
    ],
}


NOTES = {
    "On": "Baseline control effect. Equalization should focus on stable selector evidence rather than broad semantic variety.",
    "Shimmer": "Control texture effect. Keep selector expectations narrow and avoid promoting it as a dominant design driver.",
    "Color Wash": "Needs structured retrieval and selector evidence on broad fill semantics, fade direction, and restraint vs coverage.",
    "SingleStrand": "Needs the most semantic depth of the remaining four because it spans directional, chase, and segmented motion behavior.",
}


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="Generate a Stage 1 equalization backlog from the Stage 1 coverage audit.")
    parser.add_argument("--audit", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    audit = load_json(Path(args.audit))
    items = []
    for effect in audit.get("effects", []):
        if effect.get("status") != "coverage_complete_not_equalized":
            continue
        effect_name = effect["effect"]
        items.append({
            "effect": effect_name,
            "priority": effect.get("priority", "high"),
            "currentStage": effect.get("currentStage"),
            "coverageStatus": effect.get("status"),
            "complexityClass": effect.get("complexityClass"),
            "recommendedActions": DEFAULT_ACTIONS.get(effect_name, [
                "generate_effect_summary",
                "generate_effect_intent_map",
                "build_structural_retrieval_eval",
                "build_selector_cases",
                "update_equalization_board",
            ]),
            "notes": NOTES.get(effect_name, ""),
        })

    items.sort(key=lambda row: (0 if row["priority"] == "high" else 1, row["effect"]))

    payload = {
        "version": "1.0",
        "description": "Remaining Stage 1 equalization backlog after full effect x model coverage is complete.",
        "sourceAudit": str(Path(args.audit).resolve()),
        "remainingEffectCount": len(items),
        "effects": items,
    }
    Path(args.out).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
