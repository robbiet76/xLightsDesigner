#!/usr/bin/env python3
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--critique", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    with open(args.critique, "r", encoding="utf-8") as handle:
        critique = json.load(handle)

    ladder_level = critique["ladderLevel"]
    designer = critique["designerSummary"]
    sequencer = critique["sequencerSummary"]
    next_moves = critique.get("nextMoves", [])

    highest_failing_level = "none"
    decision = "hold"
    next_owner = "none"
    next_revision_level = "none"
    blocking_reasons = []

    if designer.get("weaknesses") or sequencer.get("weaknesses"):
        highest_failing_level = ladder_level
        decision = "revise_here"
        next_revision_level = ladder_level
        designer_has_moves = any(move["owner"] == "designer" for move in next_moves)
        sequencer_has_moves = any(move["owner"] == "sequencer" for move in next_moves)
        if (
            ladder_level == "macro"
            and designer.get("compositionRead") == "split"
            and designer.get("focusRead") == "broad_enough"
            and sequencer.get("spreadRead") == "acceptable"
        ):
            next_owner = "designer"
        elif designer_has_moves and sequencer_has_moves:
            next_owner = "shared"
        elif designer_has_moves:
            next_owner = "designer"
        elif sequencer_has_moves:
            next_owner = "sequencer"
        else:
            next_owner = "shared" if designer.get("weaknesses") and sequencer.get("weaknesses") else "designer" if designer.get("weaknesses") else "sequencer"

        if ladder_level == "macro":
            blocking_reasons.append("Macro instability blocks section, group, model, and effect refinement.")
        elif ladder_level == "section":
            blocking_reasons.append("Section instability blocks group, model, and effect refinement.")
        elif ladder_level == "group":
            blocking_reasons.append("Group instability blocks model and effect refinement.")
        elif ladder_level == "model":
            blocking_reasons.append("Model instability blocks effect refinement.")
    else:
        descend_map = {
            "macro": "section",
            "section": "group",
            "group": "model",
            "model": "effect",
            "effect": "none",
        }
        next_revision_level = descend_map.get(ladder_level, "none")
        decision = "descend" if next_revision_level != "none" else "hold"

    artifact = {
        "artifactType": "sequence_revision_gate_v1",
        "artifactVersion": 1,
        "source": {
            "sequenceCritiqueRef": args.critique,
        },
        "highestFailingLevel": highest_failing_level,
        "decision": decision,
        "nextOwner": next_owner,
        "nextRevisionLevel": next_revision_level,
        "blockingReasons": blocking_reasons,
        "recommendedMoves": [move["instruction"] for move in next_moves],
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "decision": decision,
        "highestFailingLevel": highest_failing_level,
        "nextRevisionLevel": next_revision_level,
        "nextOwner": next_owner,
    }, indent=2))


if __name__ == "__main__":
    main()
