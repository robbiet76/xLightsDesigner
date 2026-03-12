# Audio Analyst Runtime

This directory contains the `audio_analyst` runtime and supporting modules.

Contents:
- contracts and result gating
- provider normalization and capability adapters
- service/context/orchestration runtime
- UI-state projection helpers for analysis artifact and handoff reflection

Boundary:
- media-only analysis
- no xLights sequence or layout mutation
- canonical output is `analysis_artifact_v1`
- downstream handoff is `analysis_handoff_v1`
