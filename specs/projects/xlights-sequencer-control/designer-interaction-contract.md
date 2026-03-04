# Designer Interaction Contract: Agent + User Iterative Sequencing

Status: Draft  
Date: 2026-03-04  
Scope: xLightsDesigner interaction layer above xLights control APIs

## 1) Purpose
Define how user intent is captured, clarified, and converted into deterministic, reviewable API mutations so sequence design is iterative, not a black-box one-shot generation flow.

This spec defines the contract between:
- User-facing UI (chat + structured controls),
- Agent planning/execution layer,
- Existing xLights v2 control APIs.

## 2) Design Goals
- Keep user in control with clear scope and constraints.
- Make every proposed mutation inspectable before apply.
- Support iterative refinement ("keep X, change Y") without global unintended drift.
- Preserve deterministic behavior and rollback safety in execution.
- Let the agent act as a lighting designer that translates director-level intent into executable design choices.
- Avoid recreating xLights editing surfaces; xLightsDesigner is a director console, not a sequencer replacement.

## 3) Core Principles
1. Natural language is primary, structured fields are mandatory before apply.
2. Default operation mode is surgical edits, not global rewrites.
3. All applies are represented as explicit change sets with scope.
4. User feedback updates future proposals but does not silently rewrite prior accepted regions.
5. Every applied change can be traced, reverted, and replayed.
6. When user intent is incomplete, the agent must proactively ask domain-relevant questions using lighting and audio context.
7. User and agent are collaborative co-editors; if user edits occur, agent must refresh sequence state before proposing/applying further mutations.

## 4) Interaction Model

### 4.1 Modes
- `create`: initial sequence authoring from high-level intent.
- `revise`: targeted updates to existing sequence content.
- `polish`: constrained quality pass (intensity, timing tightness, transitions, etc.).
- `analyze`: read-only diagnostics/recommendations with no mutation.

### 4.2 Flow States
1. Capture Intent
2. Clarify Missing Inputs (if needed)
3. Build Proposed Change Set
4. User Review/Adjust
5. Apply via API
6. Readback + Summary
7. Continue Iteration

### 4.3 Required Pre-Apply Check
No mutating apply can execute unless these are known:
- target scope (models/elements + time range),
- mutation type (create/update/delete/bulk),
- preservation constraints,
- user approval action.
- current sequence revision matches proposal base revision, or a fresh scan/reproposal has been completed.

## 5) Intent Contract

## 5.1 Intent Object
```json
{
  "intentId": "intent-uuid",
  "mode": "revise",
  "goal": "Increase chorus energy while preserving timing marks",
  "scope": {
    "sequence": "HolidayRoad",
    "models": ["MegaTree", "Roofline"],
    "timeRangeMs": { "start": 45000, "end": 73000 },
    "layers": [0, 1]
  },
  "constraints": {
    "preserveTimingTracks": true,
    "preserveDisplayOrder": true,
    "allowNewEffects": true,
    "allowGlobalRewrite": false
  },
  "references": {
    "effectIds": [],
    "timingTrackNames": ["Beat Track"],
    "labels": ["chorus-1"]
  },
  "feedback": {
    "likes": ["sparkle accents on downbeat"],
    "dislikes": ["rapid strobe"],
    "strength": "moderate"
  }
}
```

## 5.2 Scope Semantics
- Scope must be explicit before apply.
- Scope is additive intersection:
  - model filter
  - time range
  - optional layer filter
- Anything outside scope is protected unless user opts into global changes.

## 5.3 Constraint Semantics
- `allowGlobalRewrite=false` is default.
- If `allowGlobalRewrite=true`, UI must present elevated-risk confirmation.
- Preserve flags map to hard execution guards where possible.

## 6) Clarification Contract

When intent is underspecified, agent must ask targeted questions tied to fields:
- Missing time range -> request explicit range or "entire sequence".
- Missing scope -> request selected models/elements.
- Ambiguous reference ("this effect") -> resolve from UI selection/history.
- Missing design direction -> ask style/mood/energy questions grounded in current audio section.
- Missing change tolerance -> ask how much existing content can change (`minimal`, `moderate`, `aggressive`).

Clarification must produce field-level deltas, not free-form hidden state.

## 6.1 Designer-Led Elicitation (Required Behavior)
- Agent should behave as an interactive designer, not a passive command executor.
- Agent should infer likely missing inputs from:
  - audio structure (intro/verse/chorus/drop/outro),
  - detected rhythm/energy changes,
  - current sequence style and effect density,
  - prior user likes/dislikes in session memory.
- Agent must present concise, high-value questions that reduce ambiguity before proposing mutations.

## 6.2 Elicitation Fields
Before significant mutation proposals, agent should attempt to resolve:
- `styleDirection`: cinematic, punchy, smooth, playful, dramatic, etc.
- `energyArc`: where intensity should rise/fall over time.
- `focusElements`: which props/models should lead vs support.
- `motionPreference`: calm, moderate, high motion.
- `colorDirection`: palette intent (warm/cool/holiday/custom).
- `changeTolerance`: how much existing content can be altered.
- `safetyConstraints`: patterns to avoid (for example rapid strobe).

## 6.3 Question Framework
- Prefer 1-3 concise, multiple-choice-first questions per round.
- Ask questions tied to current section context (time range + detected section label).
- Include a recommended option when confidence is high, but always allow override.
- If user gives high-level direction only ("make chorus bigger"), agent must still resolve missing critical fields with follow-up questions.

## 6.4 Example Elicitation Prompt Shape
```json
{
  "promptId": "prompt-uuid",
  "context": {
    "timeRangeMs": { "start": 45000, "end": 73000 },
    "section": "chorus",
    "detectedEnergy": "high"
  },
  "questions": [
    {
      "field": "styleDirection",
      "question": "For this chorus, which feel should lead?",
      "options": ["Punchy", "Cinematic", "Smooth"],
      "recommended": "Punchy"
    },
    {
      "field": "changeTolerance",
      "question": "How much of existing chorus content can I change?",
      "options": ["Minimal", "Moderate", "Aggressive"],
      "recommended": "Moderate"
    }
  ]
}
```

## 7) Proposal Contract (Pre-Apply)

## 7.1 Proposal Object
```json
{
  "proposalId": "proposal-uuid",
  "intentId": "intent-uuid",
  "summary": "Boost chorus energy by tightening pulse effect and increasing contrast.",
  "impact": {
    "effectsCreate": 2,
    "effectsUpdate": 5,
    "effectsDelete": 0,
    "timingMutations": 0,
    "modelsTouched": ["MegaTree", "Roofline"],
    "timeRangeMs": { "start": 45000, "end": 73000 }
  },
  "riskFlags": [
    { "code": "MULTI_LAYER_UPDATE", "severity": "medium" }
  ],
  "operations": [
    {
      "op": "effects.update",
      "target": { "effectId": "fx-123" },
      "changes": { "settings": { "speed": 1.25, "intensity": 0.8 } }
    }
  ],
  "preservationChecks": {
    "outsideScopeUntouched": true,
    "lockedRegionsUntouched": true
  }
}
```

## 7.2 User Actions on Proposal
- `approve`
- `approve_with_edits` (agent must regenerate proposal)
- `reject`
- `request_alternative`

No implicit apply on assistant narrative text.

## 8) Change Set and Apply Contract

## 8.1 Change Set Object
```json
{
  "changeSetId": "cs-uuid",
  "proposalId": "proposal-uuid",
  "baseRevision": "rev-token",
  "operations": [],
  "applyPolicy": {
    "atomic": true,
    "dryRunFirst": true
  }
}
```

## 8.2 Execution Requirements
- Must run dry-run validation when supported.
- Must use atomic apply path (`transactions`/`executePlan`) for multi-op updates.
- Must include revision conflict protection for stale state detection.

## 8.3 Apply Outcome Object
```json
{
  "changeSetId": "cs-uuid",
  "status": "applied",
  "appliedRevision": "rev-token-2",
  "results": [],
  "rollbackAvailable": true
}
```

## 9) Iteration and Memory Contract

## 9.1 Session Memory
Track persistent design context per sequence session:
- accepted stylistic preferences,
- rejected patterns,
- locked regions/effects,
- recent change sets and outcomes.

## 9.2 User Feedback Loop
User comments like:
- "I like X"
- "change Y to Z"
must map to explicit deltas:
- lock kept regions/elements when requested,
- generate narrow-scope proposal against existing content,
- avoid re-authoring unaffected areas.

## 9.3 Locked Content
UI must support locking at:
- time range,
- model/display element,
- effect/layer.

Locked content cannot be mutated unless user explicitly unlocks.

## 9.4 Collaborative User Edits (Fresh-Scan Requirement)
- Users may directly edit sequence content between agent turns.
- Before proposing or applying new mutations, agent must validate current sequence state against its last planning snapshot.
- If drift is detected (revision change or conflicting state delta), agent must:
  1. run a fresh scan/readback of affected sequence state,
  2. rebase or regenerate the proposal on updated state,
  3. present updated diff/risk summary before apply.
- Agent must not apply stale plans built on outdated state.

## 9.5 Fresh Scan Triggers
Fresh scan is required when any of the following is true:
- `sequence.getRevision` token changed since last proposal generation.
- User manually changed timing/effects/display ordering in UI.
- Apply attempt returns revision conflict or stale-state error.
- User requests edits that reference recently changed content ("tweak what I just adjusted").

## 10) UI Requirements

## 10.1 Layout
- Chat panel: natural-language intent and discussion.
- Scope panel: models/elements, ranges, layers.
- Constraint panel: preserve/allow toggles.
- Proposal panel: structured diff preview and risk flags.
- History panel: change sets with undo/reapply.

### 10.1.1 Non-Duplication Requirement (Hard)
- xLightsDesigner must not implement a timeline grid or sequencer-lane editing surface that duplicates xLights.
- Detailed timeline/effect lane editing remains in xLights.
- xLightsDesigner acts as:
  - intent capture + clarification,
  - proposal/review/approval,
  - change tracking + rollback orchestration,
  - preference/freshness controls.

## 10.2 Required Interactive Controls
- Scope chips/tags (`Entire Sequence`, selected models, selected range).
- Constraint toggles:
  - Preserve timing
  - Preserve display order
  - Allow new effects
  - Allow global rewrite
- Confidence/risk badges on proposed change sets.

## 10.3 Selection Binding
When user has timeline/effect selection in UI, agent references must bind to stable ids (not ambiguous text pointers).

## 10.4 xLights Collaboration Bridge
- Designer must provide explicit sync controls with xLights:
  - `Refresh from xLights` to pull latest state,
  - clear revision badge indicating proposal base revision,
  - stale-state warnings when xLights changed since last proposal.
- Designer should support "review in xLights" workflow rather than replicating xLights rendering/editing UI.

## 10.5 Designer-Linked Timing Tracks
- Designer should use custom timing tracks in xLights as the primary visual bridge between designer intent and sequence structure.
- These tracks are for semantic overlays (not replacing beat/timing analysis tracks), for example:
  - song sections (`intro`, `verse`, `chorus`, `bridge`, `outro`),
  - mood/energy arcs (`calm`, `lift`, `peak`, `resolve`),
  - design directives (`focus-megatree`, `color-shift-warm`).
- Track labels should map to designer-side metadata so selecting a label can bind designer panel context (scope, constraints, references).

### 10.5.1 Contract Requirements
- Designer-created semantic tracks must use stable naming conventions and ids.
- Labels must include deterministic time ranges and machine-readable keys.
- Designer must be able to re-scan and rebind to existing labels after restart/session restore.
- Agent proposals should reference these labels when available to reduce ambiguity in user directives.

### 10.5.2 Example Metadata Binding
```json
{
  "timingTrackName": "Designer:SongStructure",
  "label": "chorus-1",
  "timeRangeMs": { "start": 45000, "end": 73000 },
  "designerContext": {
    "sectionType": "chorus",
    "mood": "high-energy",
    "preferredFocusModels": ["MegaTree", "Roofline"]
  }
}
```

## 11) Non-Black-Box Guarantees
- Every mutation is tied to a visible change set.
- User can inspect "what changed" before and after apply.
- User can revert latest change set without resetting entire sequence.
- Agent cannot silently create a brand-new sequence unless user explicitly switches mode to create/new.

## 12) Error and Recovery Behavior
- On validation failure: return actionable field-level correction prompts.
- On conflict/stale revision: re-read state and regenerate proposal diff.
- On apply failure: surface partial/rollback status and recovery options.

## 13) Acceptance Criteria
1. User can request targeted revisions without unrelated sequence drift.
2. Proposed changes are reviewable with scope + risk metadata before apply.
3. Applied changes are traceable to change sets with deterministic readback.
4. User can iteratively refine with feedback commands while preserving accepted areas.
5. System supports rollback of the latest applied change set.
6. No mutating apply occurs without explicit user approval action.
7. For underspecified requests, agent asks domain-informed clarification questions before proposing major changes.
8. Clarification questions reference audio/section context where available.
9. User can direct at a high level ("director intent") while agent translates it into structured design inputs.
10. If user edits sequence content between turns, agent performs a fresh scan and rebases proposals before apply.
11. Designer can project song/design structure into xLights via custom semantic timing tracks with stable label bindings.
12. Agent can consume and reference semantic timing labels in proposal generation and clarification.

## 14) Out of Scope (This Spec)
- LLM model/provider selection policy.
- Visual styling/theme details of xLightsDesigner UI.
- Controller/layout write operations (remains outside program scope).
- Implementing a duplicate timeline/sequencer editor surface already provided by xLights.

## 15) Related Specs
- `learning-and-freshness-loop.md`
- `model-context-and-semantic-metadata.md`
