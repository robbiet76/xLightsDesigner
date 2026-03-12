# Sequence Agent Runtime

This directory contains the `sequence_agent` runtime and supporting sequencing modules.

Contents:
- command synthesis and graph validation
- capability gating and apply orchestration
- model/group/submodel/effect sequencing semantics
- readback verification and runtime contracts

Boundary:
- reads layout metadata as planner context
- mutates sequence-layer state only
- canonical plan output is `plan_handoff_v1`
