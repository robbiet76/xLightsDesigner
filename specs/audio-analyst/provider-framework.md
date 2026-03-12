# Audio Analyst Provider Framework

Status: Approved v1 policy  
Date: 2026-03-12

## Purpose
Define the replaceability and extension policy for `audio_analyst` providers and capability adapters.

This is a runtime/framework contract, not a single-provider implementation note.

## Boundary
- `audio_analyst` is media-only.
- Providers may analyze media and return raw evidence.
- Providers do not mutate xLights state.
- Downstream consumers read normalized artifact output only:
  - `analysis_artifact_v1`
  - derived `analysis_handoff_v1`

## Invariants
- Provider swaps must not require schema changes to `analysis_artifact_v1`.
- Provider swaps must not require schema changes to `analysis_handoff_v1`.
- Provider-specific raw payloads stay behind the normalization boundary.
- Degraded or partial capability output is valid when explicitly classified.

## Current Runtime Structure
- provider selection normalization:
  - `apps/xlightsdesigner-ui/agent/audio-analyst/audio-provider-adapters.js`
- capability normalization:
  - `apps/xlightsdesigner-ui/agent/audio-analyst/audio-analysis-capability-adapters.js`
- service execution:
  - `apps/xlightsdesigner-ui/agent/audio-analyst/audio-analysis-service-runtime.js`
- context validation/reconciliation:
  - `apps/xlightsdesigner-ui/agent/audio-analyst/audio-analysis-context-runtime.js`
- canonical artifact and handoff derivation:
  - `apps/xlightsdesigner-ui/agent/audio-analyst/audio-analyst-runtime.js`

## Replaceability Policy
Providers are replaceable when they conform to these rules:

1. Media-only input
- provider execution consumes media path plus service/config context only
- no sequence/layout/timing-track inputs

2. Capability-scoped output
- raw provider output must be normalizable into one or more capability blocks:
  - identity
  - timing
  - harmonic
  - lyrics
  - structure

3. Normalized downstream shape
- the provider may emit richer raw detail internally
- but downstream artifact fields must remain stable:
  - canonical media identity
  - normalized capability payloads
  - provenance
  - diagnostics

4. Honest partial results
- missing capability output must become:
  - empty normalized fields where appropriate
  - explicit capability availability/confidence/source state
  - warnings/diagnostics
- provider absence must not be hidden by fabricated data

5. Provenance preservation
- artifact must retain:
  - requested provider
  - provider used / engine
  - evidence summaries
  - warnings relevant to arbitration or degradation

## Extension Path For Future Providers
Future external or in-house analyzers should plug in through the same layers:

1. Provider registration
- add provider id normalization in `audio-provider-adapters.js`
- define request-shape mapping if the service bridge needs it

2. Capability normalization
- map provider output into the existing capability adapters
- do not bypass the normalized capability contract

3. Artifact projection
- artifact generation remains centralized in `audio-analyst-runtime.js`
- new providers do not write artifact files directly

4. Eval alignment
- new providers must be measurable through the packaged eval surface
- degraded-mode and provenance behavior must remain visible

## Future In-House Analyzer Path
If an in-house analyzer is built later:
- it should expose capability outputs through the same normalized runtime boundary
- it may run:
  - inside the analysis service
  - or as a separate local tool invoked by the service/runtime layer
- it should still project through:
  - capability adapters
  - canonical artifact builder
  - result/handoff contracts

This keeps internal analyzers interchangeable with external analyzers from the perspective of downstream agents.

## Non-Goals For v1
- direct provider-specific artifact schemas
- provider-specific downstream handoff contracts
- xLights timing-track creation inside `audio_analyst`
- runtime mutation of downstream sequence/layout state
