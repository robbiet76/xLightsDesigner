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


def split_scope_values(raw_value):
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return [str(value).strip() for value in raw_value if str(value).strip()]
    return [value.strip() for value in str(raw_value).split(",") if value.strip()]


def in_range(value, bounds):
    if bounds is None:
        return True
    if value is None:
        return False
    if not isinstance(bounds, list) or len(bounds) != 2:
        raise ValueError(f"Invalid range bounds: {bounds}")
    lower, upper = bounds
    return lower <= value <= upper


def validate_scope_semantics(scenario, record, errors):
    scenario_id = scenario["scenarioId"]
    expected = expected_scope(scenario)
    requested_scope = record.get("context", {}).get("requestedScope") or {}
    section_scope = record.get("context", {}).get("sectionScope") or []
    target_scope = record.get("context", {}).get("targetScope") or []
    section_targets = record.get("revisionBatch", {}).get("sectionTargets") or []
    target_ids = record.get("revisionBatch", {}).get("targetIds") or []

    expected_sections = split_scope_values(scenario.get("sectionScope"))
    expected_targets = split_scope_values(scenario.get("targetScope"))
    mode = expected["mode"]

    if requested_scope.get("mode") != mode:
        errors.append(
            f"{scenario_id} requested scope mode mismatch during semantic validation: expected {mode}, got {requested_scope.get('mode')}"
        )
        return

    if mode == "whole_sequence":
        if expected["reviewStartLevel"] != "macro":
            errors.append(f"{scenario_id} whole_sequence must start at macro.")
        if section_scope or target_scope or section_targets or target_ids:
            errors.append(f"{scenario_id} whole_sequence should not carry section or target scope.")
    elif mode == "target_refinement":
        if expected["reviewStartLevel"] not in ("group", "model"):
            errors.append(f"{scenario_id} target_refinement must start at group or model.")
        if section_scope:
            errors.append(f"{scenario_id} target_refinement should not carry section scope.")
        if target_scope != expected_targets or target_ids != expected_targets or section_targets != expected_targets:
            errors.append(
                f"{scenario_id} target_refinement should preserve only explicit targets: expected {expected_targets}, got targetScope={target_scope}, targetIds={target_ids}, sectionTargets={section_targets}"
            )
    elif mode == "section_selection":
        if expected["reviewStartLevel"] != "section":
            errors.append(f"{scenario_id} section_selection must start at section.")
        if section_scope != expected_sections:
            errors.append(f"{scenario_id} section_selection section scope mismatch: expected {expected_sections}, got {section_scope}")
        if target_scope or target_ids or section_targets:
            errors.append(f"{scenario_id} section_selection should not carry explicit target scope.")
    elif mode == "section_target_refinement":
        if expected["reviewStartLevel"] != "section":
            errors.append(f"{scenario_id} section_target_refinement must start at section.")
        if section_scope != expected_sections:
            errors.append(f"{scenario_id} section_target_refinement section scope mismatch: expected {expected_sections}, got {section_scope}")
        if target_scope != expected_targets or target_ids != expected_targets or section_targets != expected_targets:
            errors.append(
                f"{scenario_id} section_target_refinement target scope mismatch: expected {expected_targets}, got targetScope={target_scope}, targetIds={target_ids}, sectionTargets={section_targets}"
            )


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

        expected_focus = scenario.get("expectedFocusRead")
        if expected_focus and row.get("focusRead") != expected_focus:
            errors.append(
                f"{row['scenarioId']} focusRead mismatch: expected {expected_focus}, got {row.get('focusRead')}"
            )

        expected_intent = scenario.get("expectedIntentRead")
        if expected_intent and row.get("intentRead") != expected_intent:
            errors.append(
                f"{row['scenarioId']} intentRead mismatch: expected {expected_intent}, got {row.get('intentRead')}"
            )

        expected_composition = scenario.get("expectedCompositionRead")
        if expected_composition and row.get("compositionRead") != expected_composition:
            errors.append(
                f"{row['scenarioId']} compositionRead mismatch: expected {expected_composition}, got {row.get('compositionRead')}"
            )

        expected_family_balance = scenario.get("expectedFamilyBalanceRead")
        if expected_family_balance and row.get("familyBalanceRead") != expected_family_balance:
            errors.append(
                f"{row['scenarioId']} familyBalanceRead mismatch: expected {expected_family_balance}, got {row.get('familyBalanceRead')}"
            )

        expected_cycle_outcome = scenario.get("expectedCycleOutcome")
        if expected_cycle_outcome and row.get("cycleOutcome") != expected_cycle_outcome:
            errors.append(
                f"{row['scenarioId']} cycleOutcome mismatch: expected {expected_cycle_outcome}, got {row.get('cycleOutcome')}"
            )

        critique = load_json(row["critiqueArtifactPath"])
        if critique.get("ladderLevel") != expected_ladder_level:
            errors.append(
                f"{row['scenarioId']} critique ladder mismatch: expected {expected_ladder_level}, got {critique.get('ladderLevel')}"
            )

        observation = load_json(row["observationArtifactPath"])
        macro = observation.get("macro", {})
        expected_active_models = scenario.get("expectedActiveModelNames")
        if expected_active_models and sorted(macro.get("activeModelNames", [])) != sorted(expected_active_models):
            errors.append(
                f"{row['scenarioId']} activeModelNames mismatch: expected {expected_active_models}, got {macro.get('activeModelNames', [])}"
            )

        expected_lead_model = scenario.get("expectedLeadModel")
        if expected_lead_model and macro.get("leadModel") != expected_lead_model:
            errors.append(
                f"{row['scenarioId']} leadModel mismatch: expected {expected_lead_model}, got {macro.get('leadModel')}"
            )

        expected_max_active_model_count = scenario.get("expectedMaxActiveModelCount")
        if expected_max_active_model_count is not None and macro.get("maxActiveModelCount") != expected_max_active_model_count:
            errors.append(
                f"{row['scenarioId']} maxActiveModelCount mismatch: expected {expected_max_active_model_count}, got {macro.get('maxActiveModelCount')}"
            )

        expected_spread_range = scenario.get("expectedSpreadRange")
        if expected_spread_range and not in_range(macro.get("maxSceneSpreadRatio"), expected_spread_range):
            errors.append(
                f"{row['scenarioId']} maxSceneSpreadRatio out of range: expected {expected_spread_range}, got {macro.get('maxSceneSpreadRatio')}"
            )

        expected_motion_range = scenario.get("expectedMotionRange")
        if expected_motion_range and not in_range(macro.get("centroidMotionMean"), expected_motion_range):
            errors.append(
                f"{row['scenarioId']} centroidMotionMean out of range: expected {expected_motion_range}, got {macro.get('centroidMotionMean')}"
            )

        record = load_json(row["learningRecordArtifactPath"])
        record_scope = record.get("context", {}).get("requestedScope") or {}
        if record_scope != expected:
            errors.append(
                f"{row['scenarioId']} learning record scope mismatch: expected {expected}, got {record_scope}"
            )
        validate_scope_semantics(scenario, record, errors)


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
