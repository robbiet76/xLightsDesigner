# Model Context and Semantic Metadata Spec

Status: Draft  
Date: 2026-03-04  
Scope: Model awareness and designer-side metadata used by agent planning

## 1) Purpose
Define the model-awareness contract so the agent can reason about:
- model and model-group structure,
- spatial layout in 2D plus optional Z-depth,
- construction characteristics (native/custom),
- additional show-specific semantic metadata not stored in xLights.

## 2) Goals
- Ensure agent has full authoritative model context before sequencing decisions.
- Support depth-aware reasoning when Z-axis data is available.
- Enable user-defined "soft" metadata (roles, intent, narrative tags).
- Keep metadata extensible without blocking unknown future fields.

## 3) Context Layers

## 3.1 Layer A: Authoritative xLights Facts (Required)
Agent must ingest from xLights APIs:
- model id/name,
- model type and subtype (where available),
- model-group memberships,
- position/rotation/scale (as available),
- 2D layout coordinates and optional Z/depth,
- node-level structural facts (counts/grid/strings where available),
- display element relationships used for sequencing scope.

These facts are source-of-truth and must not be overridden by designer metadata.

## 3.2 Layer B: Derived Designer Context (Computed)
Designer may compute helper context from authoritative geometry:
- spatial zones (`left`, `center`, `right`, `foreground`, `background`, `high`, `low`),
- proximity/adjacency graph,
- symmetry pair/group hints,
- scale/coverage classes (`hero_scale`, `accent_scale`),
- motion suitability hints (for example, dense matrix vs sparse prop).

Derived context is recomputed after refresh and should be deterministic.

## 3.3 Layer C: User Semantic Metadata (Authored)
User/team-authored metadata may include:
- role tags (`hero`, `support`, `accent`, `ambient`),
- narrative tags (`chorus lead`, `verse texture`, `finale anchor`),
- intent notes (`use for impact hits`, `avoid as primary`),
- safety/accessibility hints (`limit flash intensity`, `low-motion`),
- show-specific organization tags.

User metadata augments planning context and is allowed to be partially defined.

## 4) Depth (Z-Axis) Requirements
- If Z-axis is present in xLights model transforms, agent should incorporate it in spatial reasoning.
- If Z-axis is absent/unknown, agent should degrade gracefully to 2D reasoning.
- Depth-aware planning should influence:
  - foreground/background layering,
  - emphasis routing (front focal props vs rear support props),
  - movement/readability heuristics.

## 5) Model Construction Awareness
- Agent must distinguish model construction classes where possible:
  - native model families (tree/matrix/line/arch/etc.),
  - custom models.
- Construction class should inform effect suitability heuristics (not hard bans unless constrained).

## 6) Metadata Store Contract

## 6.1 Design
- Maintain a designer-managed metadata store keyed by stable model identity.
- Store should support:
  - per-model metadata,
  - per-group metadata,
  - optional global defaults.

## 6.2 Merge Precedence
1. Authoritative xLights facts
2. Derived deterministic context
3. User-authored semantic metadata

Semantic metadata cannot replace authoritative geometry/topology fields.

## 6.3 Extensibility
- Unknown metadata keys must be preserved (forward-compatible behavior).
- Schema should support namespaced custom fields (for example `team.*`, `show.*`).

## 7) Refresh and Drift Handling
- Agent must refresh model context from xLights when:
  - sequence/layout revision changes,
  - user requests refresh,
  - stale-state conflict is detected.
- After refresh:
  - recompute derived context,
  - rebind semantic metadata to current model identities,
  - flag orphaned metadata entries for user review.

## 8) Example Context Object
```json
{
  "modelId": "MegaTree",
  "authoritative": {
    "name": "MegaTree",
    "type": "Tree",
    "groupIds": ["FrontYard"],
    "transform": {
      "position": { "x": 120.0, "y": 40.0, "z": 15.0 },
      "rotationDeg": { "x": 0, "y": 0, "z": 0 },
      "scale": { "x": 1, "y": 1, "z": 1 }
    },
    "nodeSummary": {
      "count": 2400,
      "layoutHint": "radial-strings"
    },
    "constructionClass": "native_tree"
  },
  "derived": {
    "zones": ["center", "foreground", "high"],
    "adjacentModels": ["Roofline", "Arches"],
    "symmetryKey": "center-axis"
  },
  "semantic": {
    "role": "hero",
    "narrativeTags": ["chorus_lead", "finale_anchor"],
    "safety": {
      "flashIntensityMax": 0.6
    },
    "custom": {
      "show.priority": "high"
    }
  }
}
```

## 9) UI Requirements
- Provide model metadata panel with:
  - authoritative facts (read-only),
  - editable semantic metadata fields,
  - derived context preview.
- Support bulk tagging by model group.
- Show warnings for unresolved/orphaned metadata after refresh.

## 10) Agent Usage Requirements
- Proposal generation must consider model role metadata when selecting targets.
- Agent should explain when semantic tags influence decisions.
- In conflicts between user prompt and stored semantic metadata, explicit user prompt wins for current operation.

## 11) Acceptance Criteria
1. Agent can enumerate models and groups with spatial/context facts before planning.
2. Agent uses Z-axis depth when available and degrades gracefully when absent.
3. User can attach and edit semantic metadata per model/group.
4. Metadata survives session restart and rebinds after context refresh.
5. Unknown custom metadata keys are preserved without loss.
