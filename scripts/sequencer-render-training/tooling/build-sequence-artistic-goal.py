#!/usr/bin/env python3
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--critique", required=True)
    parser.add_argument("--goal-id", required=True)
    parser.add_argument("--design-handoff-ref", required=True)
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
    designer = critique["designerSummary"]
    requested_scope = infer_requested_scope(
        args.requested_scope_mode,
        args.review_start_level,
        args.section_scope_kind,
    )

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
            "requestedScope": requested_scope,
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
