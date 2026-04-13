#!/usr/bin/env python3
import argparse
import json
import os


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observation", required=True)
    parser.add_argument("--critique", required=True)
    parser.add_argument("--window", required=True)
    parser.add_argument("--design-handoff-ref", default="design_handoff_v2:proof_treeflat")
    parser.add_argument("--revision-goal", default="Validate sparse tree-led section behavior and identify the next broadening move.")
    parser.add_argument("--out", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    with open(args.observation, "r", encoding="utf-8") as handle:
        observation = json.load(handle)
    with open(args.critique, "r", encoding="utf-8") as handle:
        critique = json.load(handle)
    with open(args.window, "r", encoding="utf-8") as handle:
        window = json.load(handle)

    record = {
        "artifactType": "sequence_learning_record_v1",
        "artifactVersion": 1,
        "recordId": "slr_render_training_treeflat_macro_001",
        "createdAt": None,
        "updatedAt": None,
        "scope": {
            "projectId": "render_training",
            "projectName": "Render Training Fixture",
            "sequenceId": os.path.basename(window["source"]["fseqPath"]),
            "sequenceName": os.path.basename(window["source"]["fseqPath"]),
            "checkpointId": "chk_treeflat_sparse_macro_001",
            "recordScope": "evaluation_run",
        },
        "context": {
            "designHandoffRef": args.design_handoff_ref,
            "revisionGoal": args.revision_goal,
            "sectionScope": ["proof_window_treeflat_sparse"],
            "targetScope": ["TreeFlat"],
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
            "sectionTargets": ["TreeFlat"],
            "targetIds": ["TreeFlat"],
            "effectFamilies": ["SingleStrand"],
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
                "windowStartMs": window["source"]["windowStartMs"],
                "windowEndMs": window["source"]["windowEndMs"],
                "frameOffsets": window["source"]["frameOffsets"],
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
            "sourceRunId": "render_training_treeflat_macro_001",
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
