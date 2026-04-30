# Sequence Agent Runtime

This directory contains the `sequence_agent` runtime and supporting sequencing modules.

Contents:
- command synthesis and graph validation
- capability gating and apply orchestration
- model/group/submodel/effect sequencing semantics
- readback verification and runtime contracts
- repo-managed Stage 1 render-training bundle consumption for trained effect choice defaults

Boundary:
- reads layout metadata as planner context
- mutates sequence-layer state only
- canonical plan output is `plan_handoff_v1`

Training integration:
- `generated/*.js`: compact generated runtime bundles consumed by the runtime
- `trained-effect-knowledge.js`: stable loader and recommendation API in front of the generated bundles
- `sequence-design-handoff.js`: builder/normalizer for the richer internal `sequencing_design_handoff_v2` brief
- future training refreshes should regenerate compact bundles through tooling, not change runtime call sites or hand-edit generated files
