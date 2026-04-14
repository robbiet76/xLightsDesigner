#!/usr/bin/env python3
import json
import os
import subprocess


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
PROOFS_DIR = os.path.join(ROOT_DIR, "scripts/sequencer-render-training/proofs")
GEOMETRY = os.path.join(PROOFS_DIR, "preview-scene-geometry-render-training-live.json")
SCENARIOS = os.path.join(os.path.dirname(__file__), "section-proof-scenarios.json")


def run(cmd):
    subprocess.run(cmd, cwd=ROOT_DIR, check=True)


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def require_scope_fields(scenario):
    missing = [
        key for key in ("requestedScopeMode", "reviewStartLevel", "sectionScopeKind")
        if not str(scenario.get(key, "")).strip()
    ]
    if missing:
        raise RuntimeError(
            f"Scenario {scenario.get('scenarioId', '<unknown>')} missing explicit scope fields: {', '.join(missing)}"
        )


def main():
    scenarios = load_json(SCENARIOS)
    suite = {
        "artifactType": "sequence_section_feedback_suite_v1",
        "artifactVersion": 1,
        "suiteId": "render_training_section_suite_v1",
        "geometryArtifactPath": os.path.abspath(GEOMETRY),
        "scenarioCount": len(scenarios),
        "scenarios": [],
    }

    for scenario in scenarios:
        require_scope_fields(scenario)
        scenario_id = scenario["scenarioId"]
        source_windows = []
        for source in scenario["compositeSources"]:
            path = os.path.join(PROOFS_DIR, f"preview-scene-window-{scenario_id}-{source['modelName']}.json")
            run([
                "python3",
                "scripts/sequencer-render-training/tooling/reconstruct-preview-scene-window.py",
                "--geometry", GEOMETRY,
                "--fseq", source["fseqPath"],
                "--window-start-ms", str(scenario["windowStartMs"]),
                "--window-end-ms", str(scenario["windowEndMs"]),
                "--frame-offsets", scenario["frameOffsets"],
                "--out", path,
            ])
            source_windows.append(path)

        window_path = os.path.join(PROOFS_DIR, f"preview-scene-window-{scenario_id}.json")
        compose_cmd = [
            "python3",
            "scripts/sequencer-render-training/tooling/compose-preview-scene-window.py",
        ]
        for path in source_windows:
            compose_cmd.extend(["--window", path])
        compose_cmd.extend(["--out", window_path])
        run(compose_cmd)

        observation_path = os.path.join(PROOFS_DIR, f"render-observation-{scenario_id}.json")
        critique_path = os.path.join(PROOFS_DIR, f"sequence-critique-{scenario_id}.json")
        record_path = os.path.join(PROOFS_DIR, f"sequence-learning-record-{scenario_id}.json")

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
            "--ladder-level", "section",
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
            "--requested-scope-mode", scenario["requestedScopeMode"],
            "--review-start-level", scenario["reviewStartLevel"],
            "--section-scope-kind", scenario["sectionScopeKind"],
            "--out", record_path,
        ])

        observation = load_json(observation_path)
        critique = load_json(critique_path)
        record = load_json(record_path)
        suite["scenarios"].append({
            "scenarioId": scenario_id,
            "windowArtifactPath": os.path.abspath(window_path),
            "observationArtifactPath": os.path.abspath(observation_path),
            "critiqueArtifactPath": os.path.abspath(critique_path),
            "learningRecordArtifactPath": os.path.abspath(record_path),
            "ladderLevel": critique["ladderLevel"],
            "intentRead": critique["designerSummary"]["intentRead"],
            "compositionRead": critique["designerSummary"]["compositionRead"],
            "familyBalanceRead": critique["sequencerSummary"]["familyBalanceRead"],
            "requestScope": record["context"].get("requestedScope"),
            "cycleOutcome": record["outcome"]["cycleOutcome"],
        })

    summary_path = os.path.join(PROOFS_DIR, "sequence-section-feedback-suite-summary.json")
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(suite, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "ok": True,
        "out": summary_path,
        "scenarioCount": suite["scenarioCount"],
    }, indent=2))


if __name__ == "__main__":
    main()
