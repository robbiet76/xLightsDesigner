# xLights Sequencer Execution Training

This module teaches the sequence agent how to turn design intent into safe xLights plan/apply operations. Runtime validation remains authoritative; packaged training provides contracts, compact fixtures, prompts, and eval checks.

## Project Artifact Inputs

The app-owned project folder is the source layer for display-specific training context:

- `display/model-index.json`: current structural target index from xLights layout refresh. It contains model, group, custom model, node layout, and first-class submodel records in one target collection.
- `display/target-behavior.json`: project-local behavior learning from accepted render/apply outcomes. It records how effects behave on target or submodel fingerprints.

Training assets may summarize these files, but they should not replace them. User-specific behavior learning remains project-local, migrates with the project, and is advisory during planning.

## Contracts

- `contracts/display_model_index_v1.json` defines the portable shape for model-index summaries.
- `contracts/target_behavior_evidence_v1.json` defines the portable shape for target-behavior summaries.
- `contracts/sequence_agent_input_v1.json` names both artifacts as optional planner context.
- `contracts/plan_handoff_v1.json` and `contracts/apply_result_v1.json` keep apply/review validation authoritative.

## Fixture Flow

The compact fixtures intentionally mirror the runtime lifecycle:

1. `custom_model_index_fixture_summary.json` proves custom models, built-in models, and their submodels are represented in the shared `display/model-index.json` target collection.
2. `target_behavior_evidence_fixture_summary.json` proves project-local behavior records preserve parent/submodel context, outcome refs, and aggregate stats for custom and built-in parent models.
3. `combined_target_context_fixture_summary.json` proves candidate realization refs can use model-index fingerprints to match target-behavior evidence after a target rename.

These fixtures are anonymized summaries. They should not contain raw xLights payloads, full geometry dumps, generated report folders, or user-specific semantic model names as core training logic.

## Runtime Coverage

The module evals and linked tests cover:

- model-index loading and submodel enrichment before proposal generation
- candidate selection using behavior evidence by fingerprint before target name
- compact plan metadata traceability for target behavior evidence
- accepted render/apply outcomes updating `display/target-behavior.json` under the same fingerprint/effect/probe aggregate

## Promotion Rules

- Promote compact structural and behavior facts only after they are reusable.
- Keep user display metadata and behavior evidence project-local unless explicitly exported as anonymized summaries.
- Do not infer user-specific meaning from custom model or submodel names in core logic.
- Do not add custom-model-only training paths when the shared target/submodel framework can represent the case.
