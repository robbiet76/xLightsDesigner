# Director Profile v1

Status: Draft
Date: 2026-03-13
Owner: xLightsDesigner Team

Purpose: define the user-specific preference artifact consumed by `designer_dialog` without polluting the stable design-principles corpus.

## 1) Role

`director_profile_v1` stores soft preference signals about a specific director/user.

In v1, this artifact should be treated as a conservative baseline profile scoped to the current project/show, not as a truly global preference store across all work.

It must not store:
- xLights effect-library semantics
- stable artistic principles
- general lighting-design knowledge

Those belong to the core design-principles corpus.

## 2) Required Properties

- user-specific
- persistent across sessions
- scoped appropriately rather than assumed global
- inspectable
- weighted rather than binary
- explainable when used
- reversible as more evidence is collected

## 2.1) Scope Layers

Preference memory exists at multiple scopes and must not be collapsed into one bucket:

1. Baseline director preferences
- broad, long-lived tendencies
- should update slowly
- should require stronger evidence before changing

2. Project/show preferences
- tied to a specific show or season
- may differ from the director's broader baseline
- are the safest place for early automatic learning

3. Sequence-local preferences
- tied to one song/sequence only
- should usually remain in the current brief/proposal instead of mutating broader preference memory

V1 rule:
- `director_profile_v1` should be treated as project/show-scoped baseline memory
- sequence-specific creative direction should stay in `creative_brief_v1` / `proposal_bundle_v1`
- truly cross-project baseline preference memory should be deferred until there is stronger evidence and clearer UX

## 3) Preference Categories

Suggested initial categories:
- `motionDensity`
- `energyBias`
- `focusBias`
- `colorTemperatureBias`
- `complexityTolerance`
- `changeTolerance`
- `noveltyTolerance`
- `strobeTolerance`

Each category should support:
- `weight`
- `confidence`
- `evidenceCount`
- `lastUpdatedAt`
- optional `notes`

## 4) Inputs

Profile updates may come from:
- accepted proposals
- rejected proposals
- repeated revision requests
- explicit user statements of taste

Priority order:
1. explicit user statements
2. repeated accept/reject patterns
3. inferred weak signals from retained work

Additional rule:
- accepted work from a single sequence is weak evidence only
- repeated patterns across multiple accepted proposals are stronger evidence
- obviously sequence-specific requests should not substantially alter broader preference memory

## 5) Usage Rules

- profile signals bias proposal generation; they do not dictate it
- stable design principles remain primary
- preference influence must be traceable in:
  - `creative_brief_v1`
  - `proposal_bundle_v1`
- the designer should preserve freshness and variation even when a preference is strong
- preference learning should default to the narrowest valid scope
- broader baseline updates should require stronger accumulated evidence

## 6) Non-Goals

- fixed style cloning
- replacing design principles with user taste
- hidden preference mutation with no traceability
- treating one sequence-specific request as a global/director-wide rule

## 7) Suggested Initial Shape

```json
{
  "artifactType": "director_profile_v1",
  "artifactVersion": "1.0",
  "directorId": "rob-terry",
  "displayName": "Rob Terry",
  "preferences": {
    "motionDensity": {
      "weight": 0.7,
      "confidence": 0.6,
      "evidenceCount": 8,
      "lastUpdatedAt": "2026-03-13T12:00:00Z"
    },
    "focusBias": {
      "weight": 0.8,
      "confidence": 0.7,
      "evidenceCount": 11,
      "lastUpdatedAt": "2026-03-13T12:00:00Z"
    }
  },
  "evidence": {
    "acceptedProposalIds": [],
    "rejectedProposalIds": [],
    "explicitPreferenceNotes": []
  }
}
```
