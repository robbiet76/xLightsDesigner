# Audio Analyst End-to-End Audit

Status: Active audit  
Date: 2026-03-12  
Owner: xLightsDesigner Team

## 1) Purpose
Audit the current `audio_analyst` implementation end to end and identify what is already usable versus what must change to reach a true specialist-agent architecture.

Target direction:
- `audio_analyst` is a standalone analysis specialist,
- external analysis tools/providers are modular and replaceable,
- one canonical analysis artifact is stored per media file,
- the artifact is usable by:
  - `designer_dialog` as metadata/context,
  - `sequence_agent` as direct timing/structure input.

## 2) Current State Summary
The repo already has a partial audio-analysis stack with real working pieces:

1. Analysis service exists and returns useful music-analysis data.
2. Desktop runtime already knows how to call that service.
3. UI/runtime already builds an `analysis_handoff_v1`.
4. Training-package scaffolding for `audio_analyst` already exists.

The stack is not yet a complete end-to-end specialist-agent system because:
- persistence is still UI-side summary/pipeline state rather than a canonical per-media artifact,
- orchestration still lives largely in `app.js`,
- provider abstraction is implicit inside one service implementation rather than a formal modular contract,
- the handoff schema is too shallow for the full returned analysis payload,
- legacy timing-track-oriented assumptions still appear in older specs and naming.

## 3) What Is Already In Place

### 3.1 Agent identity and training-package presence
Files:
- [audio_analyst.agent.json](/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1/agents/audio_analyst.agent.json)
- [module.manifest.json](/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1/modules/audio_track_analysis/module.manifest.json)

What exists:
- `audio_analyst` is registered as a distinct agent.
- Training module `audio_track_analysis` exists.
- Module assets exist for:
  - prompts
  - datasets
  - eval
  - fewshot

Assessment:
- good starting scaffold
- not yet equivalent in maturity to `sequence_agent`

### 3.2 Analysis service
Files:
- [main.py](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-analysis-service/main.py)
- [README.md](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-analysis-service/README.md)

What exists:
- FastAPI service with `GET /health` and `POST /analyze`
- beat detection:
  - BeatNet
  - Librosa fallback/selection behavior
- identity lookup:
  - AudD fingerprinting
  - local identity cache
- lyrics:
  - LRCLIB synced lyric fetch
  - optional lyric global-shift adjustment
- chords:
  - madmom CRF preferred path
  - independent fallback
- sections:
  - provider-first path
  - lyric-informed fallback
  - optional DSP fallback
- tempo/meter evidence:
  - songbpm / getsongbpm evidence ingestion
- eval harnesses:
  - structure eval
  - corpus ingest
  - optimization scripts

Current response already contains rich fields:
- `bpm`
- `timeSignature`
- `durationMs`
- `beats`
- `bars`
- `sections`
- `lyrics`
- `chords`
- `meta`

Assessment:
- substantial real analysis capability already exists
- service is the strongest implemented part of the current stack

### 3.3 Desktop bridge to external analysis service
File:
- [main.mjs](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-desktop/main.mjs)

What exists:
- desktop bridge calls `/analyze`
- request retries and timeout handling
- local file validation
- self-heal probe/start behavior for service reachability
- `/health` probe support

Assessment:
- desktop integration is already practical
- this is a usable modular boundary for external services

### 3.4 UI/runtime orchestration
Files:
- [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)
- [audio-analyzer.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/audio-analyzer.js)

What exists:
- `runAudioAnalysisPipeline()` calls the desktop bridge and normalizes returned results
- `buildAnalysisHandoffFromPipelineResult()` builds `analysis_handoff_v1`
- `onAnalyzeAudio()` runs the pipeline and stores handoff/runtime summary
- `analyzeAudioContext()` creates a summary/brief-oriented normalized view

Assessment:
- usable, but too much logic is concentrated in `app.js`
- the runtime output is not yet a canonical persisted analysis artifact

### 3.5 Current persisted state
Files:
- [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)
- [xlightsdesigner-project-storage-layout.md](/Users/robterry/Projects/xLightsDesigner/specs/xlightsdesigner-project-storage-layout.md)

What exists:
- project storage spec already reserves:
  - `analysis/media/<media-id>/analysis.json`
- app state persists:
  - `audioAnalysis.summary`
  - `audioAnalysis.lastAnalyzedAt`
  - `audioAnalysis.pipeline`
- old sequence-side sidecar document still includes `audioAnalysis`

Assessment:
- storage direction is correct
- implementation has not yet moved to the canonical per-media artifact model

### 3.6 Handoff contract
File:
- [handoff-contracts.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/handoff-contracts.js)

Current `analysis_handoff_v1` requires:
- `trackIdentity`
- `timing`
- `structure`
- `lyrics`
- `chords`
- `briefSeed`
- `evidence`

Assessment:
- enough for the current downstream flow
- not enough to serve as the canonical full artifact schema
- currently better viewed as a distilled downstream handoff, not the persisted source-of-truth artifact

## 4) Main Gaps

### 4.1 No canonical per-media artifact implemented yet
Required target:
- one canonical analysis file per media file

Current reality:
- analysis result is reconstructed into:
  - `audioAnalysis.summary`
  - `audioAnalysis.pipeline`
  - `analysis_handoff_v1`
- not persisted as one normalized artifact file under `analysis/media/<media-id>/`

Impact:
- no durable, reusable source of truth
- no clean separation between analysis output and UI state
- harder to improve or compare providers over time

### 4.2 `audio_analyst` orchestration is still app-centric
Current reality:
- `runAudioAnalysisPipeline()` and handoff-building are in `app.js`
- `audio-analyzer.js` is only a lightweight summarizer

Impact:
- agent responsibilities are not isolated
- hard to test independently
- difficult to grow modular provider selection, artifact validation, and retry policy cleanly

### 4.3 Provider abstraction is real in spirit but not formalized as a module contract
Current reality:
- external tools are already used:
  - BeatNet
  - Librosa
  - madmom
  - AudD
  - LRCLIB
- but the service implementation owns the orchestration implicitly

Impact:
- replaceability exists operationally, but not yet as a clean framework contract
- future internal analyzers/plugins do not have a first-class insertion point yet

### 4.4 Current handoff is distilled, not comprehensive
Current reality:
- `analysis_handoff_v1` flattens the result into summary-oriented fields
- the full returned service evidence is not preserved as canonical artifact data

Impact:
- `designer_dialog` and `sequence_agent` cannot rely on one normalized artifact as shared truth
- provenance and provider diagnostics are reduced too early

### 4.5 Persistence still reflects older sequence-side assumptions
Current reality:
- historical audio-timing specs are sequence/timing-track oriented
- current app still stores audio-analysis summary in sequence-oriented UI/session state

Impact:
- architecture drift from the new direction:
  - no xLights awareness in `audio_analyst`
  - one artifact per media file
  - reusable analysis independent of current sequence state

### 4.6 Test coverage is weak compared with `sequence_agent`
Current reality:
- no dedicated `audio_analyst` unit-test suite in `apps/xlightsdesigner-ui/tests/agent/`
- service has eval scripts, but not the same contract/runtime coverage posture

Impact:
- weaker regression confidence
- harder to refactor orchestration cleanly

## 5) Architectural Audit Against Target Direction

### 5.1 Independence from xLights state
Target:
- `audio_analyst` should know media context only

Current status:
- mostly aligned
- current pipeline no longer writes timing tracks to xLights
- but still shaped by older timing-track naming and UI summary assumptions

Assessment:
- close, but not fully normalized

### 5.2 One artifact per media file
Target:
- one canonical artifact under project-root analysis storage

Current status:
- storage spec exists
- implementation does not yet do it

Assessment:
- missing

### 5.3 Modular, replaceable provider/tool framework
Target:
- external tools/services swappable
- internal analyzers pluggable later

Current status:
- partial
- service is already multi-provider
- desktop bridge talks to service cleanly
- but no formal provider plugin contract is defined yet

Assessment:
- partial

### 5.4 Downstream usability for `designer_dialog` and `sequence_agent`
Target:
- `designer_dialog` references metadata
- `sequence_agent` consumes timing/structure/chord/lyric analysis directly

Current status:
- partial
- `analysis_handoff_v1` exists and is consumed downstream
- but the handoff is not yet generated from a canonical stored artifact

Assessment:
- partial

## 6) Recommended Canonical Model

### 6.1 Artifact boundary
`audio_analyst` should produce:
- one canonical `analysis.json` artifact per media file

Stored under:
- `<project-root>/analysis/media/<media-id>/analysis.json`

Optional derived/export files may exist later, but `analysis.json` should be the source of truth.

### 6.2 Artifact role split
- canonical artifact:
  - full normalized analysis result with provenance and provider diagnostics
- handoff:
  - distilled `analysis_handoff_v1` view derived from the artifact

This keeps:
- persistent truth
- downstream convenience

### 6.3 Provider framework split
- provider adapters:
  - service-backed analyzers
  - future in-process analyzers
- arbitration layer:
  - provider selection / scoring / fallback policy
- artifact normalizer:
  - one stable output schema regardless of provider mix

## 7) Audit Conclusion
The current codebase is not starting from scratch. It already has:
- a capable analysis service,
- desktop bridge integration,
- a partial audio-analysis runtime,
- a minimal `audio_analyst` training package,
- a downstream handoff contract.

The missing work is architectural completion:
- isolate `audio_analyst` runtime from `app.js`,
- define and persist one canonical per-media artifact,
- formalize modular provider/adaptor boundaries,
- harden contracts/tests/training assets to the same standard as `sequence_agent`.

This is enough existing functionality to justify an end-to-end implementation checklist rather than another exploratory phase.
