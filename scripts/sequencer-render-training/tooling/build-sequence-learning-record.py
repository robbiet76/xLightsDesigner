#!/usr/bin/env python3
import argparse
import json
import os


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observation", required=True)
    parser.add_argument("--critique", required=True)
    parser.add_argument("--window", required=True)
    parser.add_argument("--record-id", required=True)
    parser.add_argument("--checkpoint-id", required=True)
    parser.add_argument("--source-run-id", required=True)
    parser.add_argument("--project-id", default="render_training")
    parser.add_argument("--project-name", default="Render Training Fixture")
    parser.add_argument("--section-scope", default="proof_window")
    parser.add_argument("--target-scope", default="")
    parser.add_argument("--effect-families", default="")
    parser.add_argument("--requested-scope-mode", default="")
    parser.add_argument("--review-start-level", default="")
    parser.add_argument("--section-scope-kind", default="")
    parser.add_argument("--design-handoff-ref", default="design_handoff_v2:proof_treeflat")
    parser.add_argument("--revision-goal", default="Validate sparse tree-led section behavior and identify the next broadening move.")
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def infer_requested_scope(mode, review_start_level, section_scope_kind, section_scope, target_scope):
    normalized_mode = str(mode or "").strip()
    normalized_start = str(review_start_level or "").strip()
    normalized_kind = str(section_scope_kind or "").strip()

    if not normalized_mode:
        if section_scope and target_scope:
            normalized_mode = "section_target_refinement"
        elif section_scope:
            normalized_mode = "section_selection"
        elif target_scope:
            normalized_mode = "target_refinement"
        else:
            normalized_mode = "whole_sequence"

    if not normalized_start:
        if normalized_mode == "whole_sequence":
            normalized_start = "macro"
        elif normalized_mode in ("section_selection", "section_target_refinement"):
            normalized_start = "section"
        elif normalized_mode == "target_refinement":
            normalized_start = "model" if len(target_scope) == 1 else "group"
        else:
            normalized_start = "section"

    if not normalized_kind:
        normalized_kind = "timing_track_windows" if section_scope else "full_sequence"

    return {
        "mode": normalized_mode,
        "reviewStartLevel": normalized_start,
        "sectionScopeKind": normalized_kind,
    }


def main():
    args = parse_args()
    with open(args.observation, "r", encoding="utf-8") as handle:
        observation = json.load(handle)
    with open(args.critique, "r", encoding="utf-8") as handle:
        critique = json.load(handle)
    with open(args.window, "r", encoding="utf-8") as handle:
        window = json.load(handle)

    section_scope = [value for value in args.section_scope.split(",") if value]
    target_scope = [value for value in args.target_scope.split(",") if value]
    effect_families = [value for value in args.effect_families.split(",") if value]
    requested_scope = infer_requested_scope(
        args.requested_scope_mode,
        args.review_start_level,
        args.section_scope_kind,
        section_scope,
        target_scope,
    )
    window_source = window.get("source", {})
    sequence_name = None
    if window_source.get("fseqPath"):
        sequence_name = os.path.basename(window_source["fseqPath"])
    elif window_source.get("sourceWindowPaths"):
        sequence_name = "composite:" + "+".join(os.path.basename(path) for path in window_source["sourceWindowPaths"])
    else:
        sequence_name = args.record_id
    frame_offsets = window_source.get("frameOffsets") or [frame.get("frameOffset") for frame in window.get("frames", [])]
    window_start_ms = window_source.get("windowStartMs")
    if window_start_ms is None and window.get("frames"):
        window_start_ms = min(frame.get("frameTimeMs") for frame in window["frames"])
    window_end_ms = window_source.get("windowEndMs")
    if window_end_ms is None and window.get("frames"):
        window_end_ms = max(frame.get("frameTimeMs") for frame in window["frames"])

    record = {
        "artifactType": "sequence_learning_record_v1",
        "artifactVersion": 1,
        "recordId": args.record_id,
        "createdAt": None,
        "updatedAt": None,
        "scope": {
            "projectId": args.project_id,
            "projectName": args.project_name,
            "sequenceId": sequence_name,
            "sequenceName": sequence_name,
            "checkpointId": args.checkpoint_id,
            "recordScope": "evaluation_run",
        },
        "context": {
            "designHandoffRef": args.design_handoff_ref,
            "revisionGoal": args.revision_goal,
            "requestedScope": requested_scope,
            "sectionScope": section_scope,
            "targetScope": target_scope,
        },
        "preferences": {
            "directorProfileRef": None,
            "projectPreferenceRef": None,
            "preferenceSignalsUsed": [],
            "preferenceScope": "none",
        },
        "revisionBatch": {
            "revisionBatchPlanRef": None,
            "appliedRevisionBatchRef": None,
            "summary": "Sparse tree-led validation checkpoint.",
            "changeCategory": "proof_validation",
            "sectionTargets": target_scope,
            "targetIds": target_scope,
            "effectFamilies": effect_families,
            "appliedCommandStats": None,
            "baseRevision": None,
            "resultingRevision": None,
        },
        "prediction": {
            "mode": "reconstruction",
            "previewSceneGeometryRef": window["geometryReference"]["artifactPath"],
            "previewSceneTensorRef": None,
            "renderObservationRef": args.observation,
            "predictedStrengths": critique["sequencerSummary"]["strengths"],
            "predictedRisks": critique["sequencerSummary"]["weaknesses"],
            "predictionSummary": "Sparse tree-only checkpoint reconstructed from authoritative render data.",
        },
        "truth": {
            "renderTruthCheckpointRef": args.window,
            "xlightsRevision": None,
            "renderWindow": {
                "windowStartMs": window_start_ms,
                "windowEndMs": window_end_ms,
                "frameOffsets": frame_offsets,
            },
            "truthSummary": "Authoritative xLights frames joined onto cached whole-layout geometry.",
            "previewParityRef": None,
        },
        "critique": {
            "critiqueRef": args.critique,
            "strengths": critique["sequencerSummary"]["strengths"],
            "weaknesses": critique["sequencerSummary"]["weaknesses"],
            "intentAlignment": critique["designerSummary"]["intentRead"],
            "musicAlignment": critique["sequencerSummary"]["motionRead"],
            "displayUseAssessment": critique["sequencerSummary"]["familyBalanceRead"],
            "focusAssessment": critique["designerSummary"]["focusRead"],
            "densityAssessment": critique["sequencerSummary"]["densityRead"],
            "coherenceAssessment": critique["designerSummary"]["compositionRead"],
            "recommendedNextMoves": [move["instruction"] for move in critique["nextMoves"]],
        },
        "outcome": {
            "cycleOutcome": "usable_with_revision",
            "shouldContinueFromHere": True,
            "nextRevisionPriority": critique["nextMoves"][0]["instruction"] if critique["nextMoves"] else None,
            "humanAccepted": None,
            "checkpointWorthKeeping": True,
        },
        "provenance": {
            "appVersion": None,
            "assistantModel": None,
            "designerAgentVersion": "proof_v1",
            "sequenceAgentVersion": "proof_v1",
            "xlightsApiVersion": 2,
            "xlightsIntegrationBranch": "api-cleanup",
            "createdBy": "render_training_proof",
            "sourceRunId": args.source_run_id,
        },
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": args.out,
        "recordId": record["recordId"],
        "cycleOutcome": record["outcome"]["cycleOutcome"],
    }, indent=2))


if __name__ == "__main__":
    main()
