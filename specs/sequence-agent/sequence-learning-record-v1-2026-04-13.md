# Sequence Learning Record v1

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define the primary learning artifact emitted by each sequencing feedback cycle.

This artifact should let the system learn from real sequencing attempts by joining:
- intent
- design handoff
- applied revision batches
- local prediction or reconstruction outputs
- authoritative xLights truth
- critique
- next-step revision direction

This is the core artifact that allows the sequencer to improve over time.

## References

- [sequencing-feedback-loop-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencing-feedback-loop-v1-2026-04-13.md)
- [preview-scene-geometry-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/preview-scene-geometry-v1-2026-04-13.md)
- [sequencing-design-handoff-v2-spec-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/sequencing-design-handoff-v2-spec-2026-03-19.md)
- [director-profile-v1.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/director-profile-v1.md)
- [hybrid-cloud-learning-and-billing-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/hybrid-cloud-learning-and-billing-2026-04-10.md)

## Core Role

`sequence_learning_record_v1` is the main joined artifact for sequencing improvement.

It is not:
- a user-facing chat artifact
- a raw xLights command log only
- a user preference store
- a geometry artifact

It is a structured record of one feedback cycle.

## Design Principles

### 1. Local-first, cloud-portable
During the POC this artifact may live entirely locally.
It must still be explicit, versioned, and portable so it can later be synced into a centralized learning corpus.

### 2. Keep user preferences separate
This artifact may reference user/project preference influence, but it must not embed mutable preference state as though that were general training truth.

### 3. Join prediction and truth
The artifact must preserve the difference between:
- what the system predicted or reconstructed locally
- what xLights produced as authoritative truth

Without that distinction, learning quality will collapse.

### 4. One record per feedback cycle
The record should represent one coherent revision/critique cycle, not an unbounded conversation transcript.

## Artifact Shape

```json
{
  "artifactType": "sequence_learning_record_v1",
  "artifactVersion": 1,
  "recordId": "string",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "scope": {},
  "context": {},
  "preferences": {},
  "revisionBatch": {},
  "prediction": {},
  "truth": {},
  "critique": {},
  "outcome": {},
  "provenance": {}
}
```

## Scope Section

The scope identifies where this learning record belongs.

Suggested fields:
- `projectId`
- `projectName`
- `sequenceId`
- `sequenceName`
- `trackId`
- `phaseId`
- `checkpointId`
- `recordScope` (`sequence|project|evaluation_run`)

This makes the record queryable without mixing it with user preference state.

## Context Section

The context captures the design inputs that shaped the cycle.

Suggested fields:
- `projectMissionRef`
- `displayUnderstandingRef`
- `analysisHandoffRef`
- `designHandoffRef`
- `revisionGoal`
- `sectionScope`
- `targetScope`
- `changeTolerance`

Recommended rule:
- prefer references to larger upstream artifacts where possible
- include compact inline summaries only when necessary for portability

## Preferences Section

This section records influence, not mutable preference ownership.

Suggested fields:
- `directorProfileRef`
- `projectPreferenceRef`
- `preferenceSignalsUsed[]`
- `preferenceScope` (`none|sequence_local|project_show|user_profile`)

Important rule:
- this section must only capture which preference signals influenced the cycle
- it must not become the storage location for actual evolving preference profiles

That keeps user preferences separate from general training records.

## Revision Batch Section

This section records what the system tried to do.

Suggested fields:
- `revisionBatchPlanRef`
- `appliedRevisionBatchRef`
- `summary`
- `changeCategory`
- `sectionTargets[]`
- `targetIds[]`
- `effectFamilies[]`
- `appliedCommandStats`
- `baseRevision`
- `resultingRevision`

This is the operational “attempt” layer.

## Prediction Section

This section captures local prediction or local reconstruction-side expectations.

Suggested fields:
- `mode` (`none|reconstruction|surrogate_prediction|hybrid`)
- `previewSceneGeometryRef`
- `previewSceneTensorRef`
- `renderObservationRef`
- `predictedStrengths[]`
- `predictedRisks[]`
- `predictionSummary`

Rule:
- this section is optional in early v1 adoption
- but the contract must preserve the field now so future local-prediction work does not require schema redesign

## Truth Section

This section captures authoritative xLights output.

Suggested fields:
- `renderTruthCheckpointRef`
- `xlightsRevision`
- `renderWindow`
- `truthSummary`
- `previewParityRef` if later available

This is the ground-truth anchor for the cycle.

## Critique Section

This section stores what was learned from the result.

Suggested fields:
- `critiqueRef`
- `strengths[]`
- `weaknesses[]`
- `intentAlignment`
- `musicAlignment`
- `displayUseAssessment`
- `focusAssessment`
- `densityAssessment`
- `coherenceAssessment`
- `recommendedNextMoves[]`

This should be concrete enough to train future revision behavior.

## Outcome Section

This section captures the net result of the cycle.

Suggested fields:
- `cycleOutcome` (`promising|usable_with_revision|weak_foundation|discarded`)
- `shouldContinueFromHere` (bool)
- `nextRevisionPriority`
- `humanAccepted` (bool|null)
- `checkpointWorthKeeping` (bool)

This is the top-level supervisory signal.

## Provenance Section

Suggested fields:
- `appVersion`
- `assistantModel`
- `designerAgentVersion`
- `sequenceAgentVersion`
- `xlightsApiVersion`
- `xlightsIntegrationBranch`
- `createdBy`
- `sourceRunId`

This is required for debugging and future training hygiene.

## Required Distinctions

The artifact must preserve these distinctions explicitly:

### 1. Preference vs general learning
- preference influence is referenced only
- general training signal is the rest of the record

### 2. Prediction vs truth
- local prediction/reconstruction and xLights truth must not be merged into one undifferentiated summary

### 3. Attempt vs critique
- what was tried and how it was judged are separate concepts

### 4. Shared artifact vs user account state
- this record is learning evidence
- it is not the user profile itself

## Suggested Minimal v1 Record

The minimal viable v1 record should include:
- identity and scope fields
- design handoff reference
- revision batch summary
- truth checkpoint reference
- critique summary
- outcome classification
- preference signal references if used
- provenance

That is enough to start leaving behind usable learning trails during the POC.

## Example Shape

```json
{
  "artifactType": "sequence_learning_record_v1",
  "artifactVersion": 1,
  "recordId": "slr_2026_04_13_001",
  "createdAt": "2026-04-13T18:00:00Z",
  "updatedAt": "2026-04-13T18:05:00Z",
  "scope": {
    "projectId": "proj_demo",
    "sequenceId": "seq_song_a",
    "checkpointId": "chk_07",
    "recordScope": "sequence"
  },
  "context": {
    "designHandoffRef": "sequencing_design_handoff_v2:handoff_17",
    "revisionGoal": "Make the chorus read bigger while keeping the tree as the emotional lead.",
    "sectionScope": ["chorus_1"]
  },
  "preferences": {
    "directorProfileRef": "director_profile_v1:proj_demo",
    "preferenceSignalsUsed": ["focusBias", "complexityTolerance"],
    "preferenceScope": "project_show"
  },
  "revisionBatch": {
    "summary": "Rebalanced chorus toward tree-led focal motion with cleaner support layers.",
    "targetIds": ["MegaTree", "Roofline", "Windows"]
  },
  "prediction": {
    "mode": "reconstruction",
    "renderObservationRef": "render_observation_v1:obs_07"
  },
  "truth": {
    "renderTruthCheckpointRef": "render_truth_checkpoint_v1:chk_07",
    "truthSummary": "Authoritative xLights render for chorus_1 checkpoint."
  },
  "critique": {
    "strengths": ["Tree focus reads clearly."],
    "weaknesses": ["Support layers still feel too even and reduce contrast."],
    "recommendedNextMoves": ["Reduce roofline persistence during phrase peaks."]
  },
  "outcome": {
    "cycleOutcome": "usable_with_revision",
    "shouldContinueFromHere": true,
    "checkpointWorthKeeping": true
  },
  "provenance": {
    "xlightsIntegrationBranch": "api-cleanup"
  }
}
```

## Storage Rule

During the POC:
- store these locally
- version them explicitly
- do not bury them inside general app state blobs

Later:
- they may be uploaded to a central learning corpus
- but they must remain separate from preference profile storage

## Recommendation

Proceed with `sequence_learning_record_v1` as the main learning artifact for the sequencing POC.

It should:
- capture each critique/revision cycle
- preserve prediction vs truth
- preserve preference influence without embedding mutable preference state
- remain portable for future centralized learning
