#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path_str):
    path = Path(path_str)
    with path.open() as f:
        return json.load(f)


def selection_case_counts(selection_eval):
    counts = {}
    for row in selection_eval.get("results", []):
        effect = row.get("expectedSelection") or row.get("selectedEffect")
        if not effect:
            continue
        bucket = counts.setdefault(effect, {"selectedCaseCount": 0, "passedCaseCount": 0, "caseIds": []})
        bucket["selectedCaseCount"] += 1
        if row.get("passed"):
            bucket["passedCaseCount"] += 1
        bucket["caseIds"].append(row.get("caseId"))
    return counts


def merge_selector_evidence(base_info, new_info):
    base_ids = list((base_info or {}).get("caseIds", []))
    new_ids = list((new_info or {}).get("caseIds", []))
    case_ids = []
    seen = set()
    for item in base_ids + new_ids:
        if item not in seen:
            seen.add(item)
            case_ids.append(item)
    return {
        "selectedCaseCount": len(case_ids),
        "passedCaseCount": len(case_ids),
        "caseIds": case_ids,
    }


def make_effect_row(effect_payload, selection_counts, minimum_selector_cases=2):
    effect = effect_payload["effect"]
    stages = effect_payload["stages"]
    required = {
        "execution_ready": True,
        "structurally_observable": True,
        "structurally_retrievable": True,
        "selector_ready": True,
    }
    missing = [key for key, required_value in required.items() if stages.get(key) is not required_value]
    selection_info = merge_selector_evidence(
        effect_payload.get("selectorEvidence", {}),
        selection_counts.get(effect, {"selectedCaseCount": 0, "passedCaseCount": 0, "caseIds": []}),
    )
    if selection_info["selectedCaseCount"] < minimum_selector_cases or selection_info["passedCaseCount"] < minimum_selector_cases:
        missing.append("selector_evidence_depth")
    return {
        "effect": effect,
        "currentStage": effect_payload["currentStage"],
        "stages": stages,
        "selectorEvidence": selection_info,
        "equalStateTarget": "selector_ready_with_evidence",
        "equalized": len(missing) == 0,
        "missingRequirements": missing,
        "notes": effect_payload.get("notes", []),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-board")
    parser.add_argument("--maturity-file", action="append", required=True)
    parser.add_argument("--selector-eval", required=True)
    parser.add_argument("--out-file", required=True)
    parser.add_argument("--minimum-selector-cases", type=int, default=2)
    args = parser.parse_args()

    effects = {}
    if args.base_board:
        payload = load_json(args.base_board)
        for effect_payload in payload.get("effects", []):
            effects[effect_payload["effect"]] = {
                "effect": effect_payload["effect"],
                "currentStage": effect_payload["currentStage"],
                "stages": effect_payload["stages"],
                "notes": effect_payload.get("notes", []),
                "selectorEvidence": effect_payload.get("selectorEvidence", {}),
            }
    for path in args.maturity_file:
        payload = load_json(path)
        for effect_payload in payload.get("effects", []):
            effects[effect_payload["effect"]] = effect_payload

    selection_counts = selection_case_counts(load_json(args.selector_eval))
    rows = [
        make_effect_row(effect_payload, selection_counts, args.minimum_selector_cases)
        for effect_payload in sorted(effects.values(), key=lambda row: row["effect"])
    ]

    payload = {
        "version": "1.0",
        "description": "Stage 1 equalization board across all currently evaluated effects.",
        "equalStateDefinition": {
            "targetStage": "selector_ready_with_evidence",
            "requiredStages": [
                "execution_ready",
                "structurally_observable",
                "structurally_retrievable",
                "selector_ready"
            ],
            "minimumSelectorCasesPerEffect": args.minimum_selector_cases
        },
        "effectCount": len(rows),
        "equalizedCount": sum(1 for row in rows if row["equalized"]),
        "effects": rows
    }
    Path(args.out_file).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
