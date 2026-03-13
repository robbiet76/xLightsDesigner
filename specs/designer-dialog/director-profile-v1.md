# Director Profile v1

Status: Draft
Date: 2026-03-13
Owner: xLightsDesigner Team

Purpose: define the user-specific preference artifact consumed by `designer_dialog` without polluting the stable design-principles corpus.

## 1) Role

`director_profile_v1` stores soft preference signals about a specific director/user.

It must not store:
- xLights effect-library semantics
- stable artistic principles
- general lighting-design knowledge

Those belong to the core design-principles corpus.

## 2) Required Properties

- user-specific
- persistent across sessions
- inspectable
- weighted rather than binary
- explainable when used
- reversible as more evidence is collected

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

## 5) Usage Rules

- profile signals bias proposal generation; they do not dictate it
- stable design principles remain primary
- preference influence must be traceable in:
  - `creative_brief_v1`
  - `proposal_bundle_v1`
- the designer should preserve freshness and variation even when a preference is strong

## 6) Non-Goals

- fixed style cloning
- replacing design principles with user taste
- hidden preference mutation with no traceability

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
