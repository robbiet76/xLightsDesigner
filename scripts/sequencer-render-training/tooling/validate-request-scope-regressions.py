#!/usr/bin/env python3
import json
import os
import sys


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
PROOFS_DIR = os.path.join(ROOT_DIR, "scripts/sequencer-render-training/proofs")
MACRO_SCENARIOS = os.path.join(os.path.dirname(__file__), "feedback-proof-scenarios.json")
SECTION_SCENARIOS = os.path.join(os.path.dirname(__file__), "section-proof-scenarios.json")
REGRESSION_FIXTURES = os.path.join(PROOFS_DIR, "feedback-regression-fixtures.json")


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
    requested_scope = record.get("requestedScope") or {}
    section_scope = record.get("sectionScope") or []
    target_scope = record.get("targetScope") or []
    section_targets = record.get("sectionTargets") or []
    target_ids = record.get("targetIds") or []

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


def validate_fixture_suite(suite_name, suite, scenarios_path, expected_ladder_level, errors):
    scenarios = {row["scenarioId"]: row for row in load_json(scenarios_path)}

    summary_ids = {row["scenarioId"] for row in suite["scenarios"]}
    scenario_ids = set(scenarios)
    if summary_ids != scenario_ids:
        missing = sorted(scenario_ids - summary_ids)
        extra = sorted(summary_ids - scenario_ids)
        if missing:
            errors.append(f"{suite_name} fixture missing scenarios: {', '.join(missing)}")
        if extra:
            errors.append(f"{suite_name} fixture has unexpected scenarios: {', '.join(extra)}")

    for row in suite["scenarios"]:
        scenario = scenarios[row["scenarioId"]]
        expected = expected_scope(scenario)
        actual = row.get("requestScope") or {}
        summary = row.get("summary") or {}
        if actual != expected:
            errors.append(
                f"{row['scenarioId']} summary scope mismatch: expected {expected}, got {actual}"
            )

        expected_focus = scenario.get("expectedFocusRead")
        if expected_focus and summary.get("focusRead") != expected_focus:
            errors.append(
                f"{row['scenarioId']} focusRead mismatch: expected {expected_focus}, got {summary.get('focusRead')}"
            )

        expected_intent = scenario.get("expectedIntentRead")
        if expected_intent and summary.get("intentRead") != expected_intent:
            errors.append(
                f"{row['scenarioId']} intentRead mismatch: expected {expected_intent}, got {summary.get('intentRead')}"
            )

        expected_composition = scenario.get("expectedCompositionRead")
        if expected_composition and summary.get("compositionRead") != expected_composition:
            errors.append(
                f"{row['scenarioId']} compositionRead mismatch: expected {expected_composition}, got {summary.get('compositionRead')}"
            )

        expected_family_balance = scenario.get("expectedFamilyBalanceRead")
        if expected_family_balance and summary.get("familyBalanceRead") != expected_family_balance:
            errors.append(
                f"{row['scenarioId']} familyBalanceRead mismatch: expected {expected_family_balance}, got {summary.get('familyBalanceRead')}"
            )

        expected_cycle_outcome = scenario.get("expectedCycleOutcome")
        if expected_cycle_outcome and summary.get("cycleOutcome") != expected_cycle_outcome:
            errors.append(
                f"{row['scenarioId']} cycleOutcome mismatch: expected {expected_cycle_outcome}, got {summary.get('cycleOutcome')}"
            )

        expected_highest_failing_level = scenario.get("expectedHighestFailingLevel")
        if expected_highest_failing_level and summary.get("highestFailingLevel") != expected_highest_failing_level:
            errors.append(
                f"{row['scenarioId']} highestFailingLevel mismatch: expected {expected_highest_failing_level}, got {summary.get('highestFailingLevel')}"
            )

        expected_gate_decision = scenario.get("expectedGateDecision")
        if expected_gate_decision and summary.get("gateDecision") != expected_gate_decision:
            errors.append(
                f"{row['scenarioId']} gateDecision mismatch: expected {expected_gate_decision}, got {summary.get('gateDecision')}"
            )

        expected_next_owner = scenario.get("expectedNextOwner")
        if expected_next_owner and summary.get("nextOwner") != expected_next_owner:
            errors.append(
                f"{row['scenarioId']} nextOwner mismatch: expected {expected_next_owner}, got {summary.get('nextOwner')}"
            )

        expected_next_revision_level = scenario.get("expectedNextRevisionLevel")
        if expected_next_revision_level and summary.get("nextRevisionLevel") != expected_next_revision_level:
            errors.append(
                f"{row['scenarioId']} nextRevisionLevel mismatch: expected {expected_next_revision_level}, got {summary.get('nextRevisionLevel')}"
            )

        expected_designer_direction = scenario.get("expectedDesignerDirection")
        if expected_designer_direction and summary.get("designerDirection") != expected_designer_direction:
            errors.append(
                f"{row['scenarioId']} designerDirection mismatch: expected {expected_designer_direction}, got {summary.get('designerDirection')}"
            )

        expected_sequencer_direction = scenario.get("expectedSequencerDirection")
        if expected_sequencer_direction and summary.get("sequencerDirection") != expected_sequencer_direction:
            errors.append(
                f"{row['scenarioId']} sequencerDirection mismatch: expected {expected_sequencer_direction}, got {summary.get('sequencerDirection')}"
            )

        critique = row.get("critique") or {}
        if critique.get("ladderLevel") != expected_ladder_level:
            errors.append(
                f"{row['scenarioId']} critique ladder mismatch: expected {expected_ladder_level}, got {critique.get('ladderLevel')}"
            )

        gate = row.get("gate") or {}
        if expected_highest_failing_level and gate.get("highestFailingLevel") != expected_highest_failing_level:
            errors.append(
                f"{row['scenarioId']} gate artifact highestFailingLevel mismatch: expected {expected_highest_failing_level}, got {gate.get('highestFailingLevel')}"
            )
        if expected_gate_decision and gate.get("decision") != expected_gate_decision:
            errors.append(
                f"{row['scenarioId']} gate artifact decision mismatch: expected {expected_gate_decision}, got {gate.get('decision')}"
            )
        if expected_next_owner and gate.get("nextOwner") != expected_next_owner:
            errors.append(
                f"{row['scenarioId']} gate artifact nextOwner mismatch: expected {expected_next_owner}, got {gate.get('nextOwner')}"
            )
        if expected_next_revision_level and gate.get("nextRevisionLevel") != expected_next_revision_level:
            errors.append(
                f"{row['scenarioId']} gate artifact nextRevisionLevel mismatch: expected {expected_next_revision_level}, got {gate.get('nextRevisionLevel')}"
            )

        revision_objective = row.get("revisionObjective") or {}
        if expected_designer_direction and revision_objective.get("designerDirection") != expected_designer_direction:
            errors.append(
                f"{row['scenarioId']} revision objective designerDirection mismatch: expected {expected_designer_direction}, got {revision_objective.get('designerDirection')}"
            )
        if expected_sequencer_direction and revision_objective.get("sequencerDirection") != expected_sequencer_direction:
            errors.append(
                f"{row['scenarioId']} revision objective sequencerDirection mismatch: expected {expected_sequencer_direction}, got {revision_objective.get('sequencerDirection')}"
            )

        macro = row.get("observation") or {}
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

        record = row.get("learningRecord") or {}
        record_scope = record.get("requestedScope") or {}
        if record_scope != expected:
            errors.append(
                f"{row['scenarioId']} learning record scope mismatch: expected {expected}, got {record_scope}"
            )
        validate_scope_semantics(scenario, record, errors)


def main():
    errors = []
    fixture = load_json(REGRESSION_FIXTURES)
    suites = fixture.get("suites") or {}
    validate_fixture_suite("macro", suites.get("macro") or {"scenarios": []}, MACRO_SCENARIOS, "macro", errors)
    validate_fixture_suite("section", suites.get("section") or {"scenarios": []}, SECTION_SCENARIOS, "section", errors)

    if errors:
        print(json.dumps({"ok": False, "errors": errors}, indent=2))
        sys.exit(1)

    print(json.dumps({
        "ok": True,
        "validated": {
            "regressionFixtures": os.path.abspath(REGRESSION_FIXTURES),
        },
        "scopeClasses": sorted({
            row["requestedScopeMode"]
            for row in load_json(MACRO_SCENARIOS) + load_json(SECTION_SCENARIOS)
        }),
    }, indent=2))


if __name__ == "__main__":
    main()
