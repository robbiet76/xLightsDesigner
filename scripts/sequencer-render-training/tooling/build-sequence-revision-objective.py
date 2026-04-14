#!/usr/bin/env python3
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--critique", required=True)
    parser.add_argument("--gate", required=True)
    parser.add_argument("--artistic-goal", required=True)
    parser.add_argument("--objective-id", required=True)
    parser.add_argument("--requested-scope-mode", default="")
    parser.add_argument("--review-start-level", default="")
    parser.add_argument("--section-scope-kind", default="")
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def infer_requested_scope(mode, review_start_level, section_scope_kind):
    normalized_mode = str(mode or "").strip()
    normalized_start = str(review_start_level or "").strip()
    normalized_kind = str(section_scope_kind or "").strip()

    if not normalized_mode:
        normalized_mode = "whole_sequence"
    if not normalized_start:
        if normalized_mode == "whole_sequence":
            normalized_start = "macro"
        elif normalized_mode in ("section_selection", "section_target_refinement"):
            normalized_start = "section"
        elif normalized_mode == "target_refinement":
            normalized_start = "group"
        else:
            normalized_start = "section"
    if not normalized_kind:
        normalized_kind = "timing_track_windows" if "section" in normalized_mode else "full_sequence"

    return {
        "mode": normalized_mode,
        "reviewStartLevel": normalized_start,
        "sectionScopeKind": normalized_kind,
    }


def main():
    args = parse_args()
    critique = json.load(open(args.critique, "r", encoding="utf-8"))
    gate = json.load(open(args.gate, "r", encoding="utf-8"))
    artistic_goal = json.load(open(args.artistic_goal, "r", encoding="utf-8"))
    requested_scope = artistic_goal.get("scope", {}).get("requestedScope") or infer_requested_scope(
        args.requested_scope_mode,
        args.review_start_level,
        args.section_scope_kind,
    )

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
            "requestedScope": requested_scope,
            "reviewStartLevel": requested_scope["reviewStartLevel"],
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
