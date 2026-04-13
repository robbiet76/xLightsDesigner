#!/usr/bin/env python3
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--critique", required=True)
    parser.add_argument("--gate", required=True)
    parser.add_argument("--artistic-goal", required=True)
    parser.add_argument("--objective-id", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    critique = json.load(open(args.critique, "r", encoding="utf-8"))
    gate = json.load(open(args.gate, "r", encoding="utf-8"))
    artistic_goal = json.load(open(args.artistic_goal, "r", encoding="utf-8"))

    designer = critique["designerSummary"]
    sequencer = critique["sequencerSummary"]
    next_moves = critique.get("nextMoves", [])

    designer_moves = [move["instruction"] for move in next_moves if move["owner"] == "designer"]
    sequencer_moves = [move["instruction"] for move in next_moves if move["owner"] == "sequencer"]

    artifact = {
        "artifactType": "sequence_revision_objective_v1",
        "artifactVersion": 1,
        "objectiveId": args.objective_id,
        "createdAt": None,
        "source": {
            "sequenceArtisticGoalRef": args.artistic_goal,
            "sequenceCritiqueRef": args.critique,
            "sequenceRevisionGateRef": args.gate,
        },
        "scope": {
            "nextOwner": gate["nextOwner"],
        },
        "ladderLevel": gate["nextRevisionLevel"],
        "designerDirection": {
            "artisticCorrection": designer_moves[0] if designer_moves else artistic_goal["evaluationLens"]["comparisonQuestions"][0],
            "mustPreserve": designer["strengths"],
            "mustAvoid": designer["weaknesses"],
            "evaluationPrompt": artistic_goal["evaluationLens"]["comparisonQuestions"][0],
        },
        "sequencerDirection": {
            "executionObjective": sequencer_moves[0] if sequencer_moves else (sequencer["revisionSuggestions"][0] if sequencer["revisionSuggestions"] else "Preserve current strengths while following the designer correction."),
            "allowedMoves": sequencer["strengths"],
            "blockedMoves": gate["blockingReasons"],
            "revisionBatchShape": f"{gate['nextRevisionLevel']}_pass" if gate["nextRevisionLevel"] != "none" else "hold",
        },
        "successChecks": [
            f"Highest active revision level remains {gate['nextRevisionLevel']}.",
            *artistic_goal["evaluationLens"]["comparisonQuestions"],
        ],
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "objectiveId": args.objective_id,
        "nextOwner": gate["nextOwner"],
        "ladderLevel": gate["nextRevisionLevel"],
    }, indent=2))


if __name__ == "__main__":
    main()
