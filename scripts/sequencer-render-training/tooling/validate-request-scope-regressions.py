#!/usr/bin/env python3
import json
import os
import sys


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
PROOFS_DIR = os.path.join(ROOT_DIR, "scripts/sequencer-render-training/proofs")
MACRO_SCENARIOS = os.path.join(os.path.dirname(__file__), "feedback-proof-scenarios.json")
SECTION_SCENARIOS = os.path.join(os.path.dirname(__file__), "section-proof-scenarios.json")
MACRO_SUMMARY = os.path.join(PROOFS_DIR, "sequence-feedback-suite-summary.json")
SECTION_SUMMARY = os.path.join(PROOFS_DIR, "sequence-section-feedback-suite-summary.json")


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def expected_scope(scenario):
    return {
        "mode": scenario["requestedScopeMode"],
        "reviewStartLevel": scenario["reviewStartLevel"],
        "sectionScopeKind": scenario["sectionScopeKind"],
    }


def validate_summary(summary_path, scenarios_path, expected_ladder_level, errors):
    summary = load_json(summary_path)
    scenarios = {row["scenarioId"]: row for row in load_json(scenarios_path)}

    summary_ids = {row["scenarioId"] for row in summary["scenarios"]}
    scenario_ids = set(scenarios)
    if summary_ids != scenario_ids:
        missing = sorted(scenario_ids - summary_ids)
        extra = sorted(summary_ids - scenario_ids)
        if missing:
            errors.append(f"{os.path.basename(summary_path)} missing scenarios: {', '.join(missing)}")
        if extra:
            errors.append(f"{os.path.basename(summary_path)} has unexpected scenarios: {', '.join(extra)}")

    for row in summary["scenarios"]:
        scenario = scenarios[row["scenarioId"]]
        expected = expected_scope(scenario)
        actual = row.get("requestScope") or {}
        if actual != expected:
            errors.append(
                f"{row['scenarioId']} summary scope mismatch: expected {expected}, got {actual}"
            )

        critique = load_json(row["critiqueArtifactPath"])
        if critique.get("ladderLevel") != expected_ladder_level:
            errors.append(
                f"{row['scenarioId']} critique ladder mismatch: expected {expected_ladder_level}, got {critique.get('ladderLevel')}"
            )

        record = load_json(row["learningRecordArtifactPath"])
        record_scope = record.get("context", {}).get("requestedScope") or {}
        if record_scope != expected:
            errors.append(
                f"{row['scenarioId']} learning record scope mismatch: expected {expected}, got {record_scope}"
            )


def main():
    errors = []
    validate_summary(MACRO_SUMMARY, MACRO_SCENARIOS, "macro", errors)
    validate_summary(SECTION_SUMMARY, SECTION_SCENARIOS, "section", errors)

    if errors:
        print(json.dumps({"ok": False, "errors": errors}, indent=2))
        sys.exit(1)

    print(json.dumps({
        "ok": True,
        "validated": {
            "macroSummary": os.path.abspath(MACRO_SUMMARY),
            "sectionSummary": os.path.abspath(SECTION_SUMMARY),
        },
        "scopeClasses": sorted({
            row["requestedScopeMode"]
            for row in load_json(MACRO_SCENARIOS) + load_json(SECTION_SCENARIOS)
        }),
    }, indent=2))


if __name__ == "__main__":
    main()
