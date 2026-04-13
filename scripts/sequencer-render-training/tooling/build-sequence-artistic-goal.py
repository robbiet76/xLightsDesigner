#!/usr/bin/env python3
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--critique", required=True)
    parser.add_argument("--goal-id", required=True)
    parser.add_argument("--design-handoff-ref", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    critique = json.load(open(args.critique, "r", encoding="utf-8"))
    designer = critique["designerSummary"]

    artistic_correction = None
    if designer["designAdjustmentSuggestions"]:
        artistic_correction = designer["designAdjustmentSuggestions"][0]
    elif designer["weaknesses"]:
        artistic_correction = designer["weaknesses"][0]
    else:
        artistic_correction = "Preserve the current artistic direction while descending to the next critique level."

    artifact = {
        "artifactType": "sequence_artistic_goal_v1",
        "artifactVersion": 1,
        "goalId": args.goal_id,
        "createdAt": None,
        "source": {
            "sequenceCritiqueRef": args.critique,
            "designHandoffRef": args.design_handoff_ref,
        },
        "scope": {
            "goalLevel": critique["ladderLevel"],
        },
        "artisticIntent": {
            "emotionalTone": "proof_inferred",
            "visualTone": "proof_inferred",
            "leadTarget": None,
            "supportTargets": [],
            "focusHierarchy": designer["intentRead"],
            "sectionArc": artistic_correction,
            "motionCharacter": "derived_from_critique",
            "densityCharacter": designer["contrastRead"],
        },
        "evaluationLens": {
            "mustPreserve": designer["strengths"],
            "mustImprove": designer["weaknesses"],
            "comparisonQuestions": [
                artistic_correction,
            ],
        },
        "antiGoals": [],
        "traceability": {
            "designSummary": designer["intentRead"],
        },
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "goalId": args.goal_id,
    }, indent=2))


if __name__ == "__main__":
    main()
