#!/usr/bin/env python3
import json
import os
import subprocess


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
PROOFS_DIR = os.path.join(ROOT_DIR, "scripts/sequencer-render-training/proofs")
GEOMETRY = os.path.join(PROOFS_DIR, "preview-scene-geometry-render-training-live.json")
SCENARIOS = os.path.join(os.path.dirname(__file__), "feedback-proof-scenarios.json")


def run(cmd):
    subprocess.run(cmd, cwd=ROOT_DIR, check=True)


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def main():
    scenarios = load_json(SCENARIOS)
    suite_summary = {
        "artifactType": "sequence_feedback_suite_v1",
        "artifactVersion": 1,
        "suiteId": "render_training_macro_suite_v1",
        "geometryArtifactPath": os.path.abspath(GEOMETRY),
        "scenarioCount": len(scenarios),
        "scenarios": [],
    }
    scenario_outputs = {}

    for scenario in scenarios:
        scenario_id = scenario["scenarioId"]
        window_path = os.path.join(PROOFS_DIR, f"preview-scene-window-{scenario_id}.json")
        observation_path = os.path.join(PROOFS_DIR, f"render-observation-{scenario_id}.json")
        critique_path = os.path.join(PROOFS_DIR, f"sequence-critique-{scenario_id}.json")
        record_path = os.path.join(PROOFS_DIR, f"sequence-learning-record-{scenario_id}.json")
        if scenario.get("mode") == "composite":
            compose_cmd = [
                "python3",
                "scripts/sequencer-render-training/tooling/compose-preview-scene-window.py",
            ]
            for source_id in scenario["sourceScenarioIds"]:
                compose_cmd.extend(["--window", scenario_outputs[source_id]["windowArtifactPath"]])
            compose_cmd.extend(["--out", window_path])
            run(compose_cmd)
        else:
            run([
                "python3",
                "scripts/sequencer-render-training/tooling/reconstruct-preview-scene-window.py",
                "--geometry", GEOMETRY,
                "--fseq", scenario["fseqPath"],
                "--window-start-ms", str(scenario["windowStartMs"]),
                "--window-end-ms", str(scenario["windowEndMs"]),
                "--frame-offsets", scenario["frameOffsets"],
                "--out", window_path,
            ])
        run([
            "python3",
            "scripts/sequencer-render-training/tooling/extract-render-observation.py",
            "--window", window_path,
            "--out", observation_path,
        ])
        run([
            "python3",
            "scripts/sequencer-render-training/tooling/extract-sequence-critique.py",
            "--observation", observation_path,
            "--out", critique_path,
        ])
        run([
            "python3",
            "scripts/sequencer-render-training/tooling/build-sequence-learning-record.py",
            "--window", window_path,
            "--observation", observation_path,
            "--critique", critique_path,
            "--record-id", f"slr_{scenario_id}_001",
            "--checkpoint-id", f"chk_{scenario_id}_001",
            "--source-run-id", f"render_training_{scenario_id}_001",
            "--design-handoff-ref", scenario["designHandoffRef"],
            "--revision-goal", scenario["revisionGoal"],
            "--section-scope", scenario["sectionScope"],
            "--target-scope", scenario["targetScope"],
            "--effect-families", scenario["effectFamilies"],
            "--out", record_path,
        ])

        observation = load_json(observation_path)
        critique = load_json(critique_path)
        record = load_json(record_path)

        suite_summary["scenarios"].append({
            "scenarioId": scenario_id,
            "modelName": scenario["modelName"],
            "windowArtifactPath": os.path.abspath(window_path),
            "observationArtifactPath": os.path.abspath(observation_path),
            "critiqueArtifactPath": os.path.abspath(critique_path),
            "learningRecordArtifactPath": os.path.abspath(record_path),
            "maxActiveModelCount": observation["macro"]["maxActiveModelCount"],
            "maxSceneSpreadRatio": observation["macro"]["maxSceneSpreadRatio"],
            "focusRead": critique["designerSummary"]["focusRead"],
            "familyBalanceRead": critique["sequencerSummary"]["familyBalanceRead"],
            "cycleOutcome": record["outcome"]["cycleOutcome"],
        })
        scenario_outputs[scenario_id] = {
            "windowArtifactPath": os.path.abspath(window_path),
            "observationArtifactPath": os.path.abspath(observation_path),
            "critiqueArtifactPath": os.path.abspath(critique_path),
            "learningRecordArtifactPath": os.path.abspath(record_path),
        }

    summary_path = os.path.join(PROOFS_DIR, "sequence-feedback-suite-summary.json")
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(suite_summary, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": summary_path,
        "scenarioCount": suite_summary["scenarioCount"],
    }, indent=2))


if __name__ == "__main__":
    main()
