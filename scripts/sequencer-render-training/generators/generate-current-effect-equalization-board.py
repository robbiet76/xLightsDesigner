#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path_str):
    path = Path(path_str)
    with path.open() as f:
        return json.load(f)


def maturity_index(maturity_payload):
    index = {}
    for row in maturity_payload.get("effects", []):
        index[row["effect"]] = row
    return index


def selection_case_counts(selection_eval):
    counts = {}
    for row in selection_eval.get("results", []):
        effect = row.get("selectedEffect")
        if not effect:
            continue
        bucket = counts.setdefault(effect, {"selectedCaseCount": 0, "passedCaseCount": 0, "caseIds": []})
        bucket["selectedCaseCount"] += 1
        if row.get("passed"):
            bucket["passedCaseCount"] += 1
        bucket["caseIds"].append(row.get("caseId"))
    return counts


def make_effect_row(effect, stage, stages, selection_counts, notes=None, minimum_selector_cases=2):
    equal_state_requirements = {
        "execution_ready": True,
        "structurally_observable": True,
        "structurally_retrievable": True,
        "selector_ready": True,
    }
    missing = [
        key for key, required in equal_state_requirements.items()
        if stages.get(key) is not required
    ]

    selection_info = selection_counts.get(effect, {"selectedCaseCount": 0, "passedCaseCount": 0, "caseIds": []})
    if selection_info["selectedCaseCount"] < minimum_selector_cases:
        missing.append("selector_evidence_depth")

    return {
        "effect": effect,
        "currentStage": stage,
        "stages": stages,
        "selectorEvidence": selection_info,
        "equalStateTarget": "selector_ready_with_evidence",
        "equalized": len(missing) == 0,
        "missingRequirements": missing,
        "notes": notes or [],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--priority-maturity", required=True)
    parser.add_argument("--selector-eval", required=True)
    parser.add_argument("--twinkle-summary", required=True)
    parser.add_argument("--twinkle-retrieval-eval", required=True)
    parser.add_argument("--twinkle-interaction-eval", required=True)
    parser.add_argument("--shockwave-summary", required=True)
    parser.add_argument("--shockwave-retrieval-eval", required=True)
    parser.add_argument("--out-file", required=True)
    args = parser.parse_args()

    maturity = load_json(args.priority_maturity)
    twinkle_summary = load_json(args.twinkle_summary)
    twinkle_retrieval_eval = load_json(args.twinkle_retrieval_eval)
    twinkle_interaction_eval = load_json(args.twinkle_interaction_eval)
    shockwave_summary = load_json(args.shockwave_summary)
    shockwave_retrieval_eval = load_json(args.shockwave_retrieval_eval)
    selector_eval = load_json(args.selector_eval)

    maturity_by_effect = maturity_index(maturity)
    selection_counts = selection_case_counts(selector_eval)

    rows = []
    for effect in ["Bars", "Marquee", "Pinwheel", "Spirals"]:
        source = maturity_by_effect[effect]
        source_selection = source.get("evaluation", {}).get("selection", {})
        rows.append(
            make_effect_row(
                effect=effect,
                stage=source["currentStage"],
                stages=source["stages"],
                selection_counts={
                    effect: {
                        "selectedCaseCount": source_selection.get("passedCount", 0),
                        "passedCaseCount": source_selection.get("passedCount", 0),
                        "caseIds": source_selection.get("caseIds", []),
                    }
                },
                notes=["Imported from mature Stage 1 priority-effect maturity board."],
            )
        )

    rows.append(
        make_effect_row(
            effect="Twinkle",
            stage="selector_ready",
            stages={
                "execution_ready": True,
                "structurally_observable": True,
                "structurally_retrievable": twinkle_retrieval_eval["passedCount"] == twinkle_retrieval_eval["caseCount"]
                and twinkle_interaction_eval["passedCount"] == twinkle_interaction_eval["caseCount"],
                "selector_ready": True,
                "designer_language_candidate": False,
                "layered_effect_ready": False,
            },
            selection_counts=selection_counts,
            notes=[
                f"Twinkle summary geometries: {twinkle_summary['effects']['Twinkle']['geometryCount']}",
                "Selector readiness is limited to the current merged selector set.",
            ],
        )
    )

    rows.append(
        make_effect_row(
            effect="Shockwave",
            stage="selector_ready" if selection_counts.get("Shockwave", {}).get("selectedCaseCount", 0) >= 2 else "structurally_retrievable",
            stages={
                "execution_ready": True,
                "structurally_observable": True,
                "structurally_retrievable": shockwave_retrieval_eval["passedCount"] == shockwave_retrieval_eval["caseCount"],
                "selector_ready": selection_counts.get("Shockwave", {}).get("selectedCaseCount", 0) >= 2,
                "designer_language_candidate": False,
                "layered_effect_ready": False,
            },
            selection_counts=selection_counts,
            notes=[
                f"Shockwave summary geometries: {shockwave_summary['effects']['Shockwave']['geometryCount']}",
                "Still lacks sufficient selector evidence and promotion.",
            ],
        )
    )

    payload = {
        "version": "1.0",
        "description": "Equalization board for the current Stage 1 effect set.",
        "equalStateDefinition": {
            "targetStage": "selector_ready_with_evidence",
            "requiredStages": [
                "execution_ready",
                "structurally_observable",
                "structurally_retrievable",
                "selector_ready",
            ],
            "minimumSelectorCasesPerEffect": 2,
        },
        "effectCount": len(rows),
        "equalizedCount": sum(1 for row in rows if row["equalized"]),
        "effects": rows,
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
