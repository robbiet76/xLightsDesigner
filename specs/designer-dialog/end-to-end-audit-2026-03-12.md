# Designer Dialog End-to-End Audit (2026-03-12)

Status: Active audit
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-12

Purpose: assess the current `designer_dialog` implementation as the creative specialist domain under `app_assistant` before starting the next development phase.

## 1) Scope

This audit covers:
- the current `designer_dialog` runtime modules
- the new requirement that unified user-facing chat belongs to `app_assistant`, not to `designer_dialog`
- the active interaction contract
- the current app-owned orchestration/UI behavior
- training-package alignment for `lighting_design_principles`
- test coverage and missing runtime boundaries

This audit does not cover:
- `audio_analyst` implementation details except where used as upstream context
- `sequence_agent` implementation details except where used as downstream handoff consumer
- broader shared `app.js` cleanup outside the designer-owned slice

## 2) Current Domain Files

Runtime modules:
- [intent-normalizer.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/intent-normalizer.js)
- [guided-dialog.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/guided-dialog.js)
- [brief-synthesizer.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/brief-synthesizer.js)
- [planner.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/planner.js)

Tests:
- [agent-planner.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/designer-dialog/agent-planner.test.js)

Active spec:
- [designer-interaction-contract.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/designer-interaction-contract.md)

Training assets:
- [designer_dialog.agent.json](/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1/agents/designer_dialog.agent.json)
- [module.manifest.json](/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1/modules/lighting_design_principles/module.manifest.json)
- [datasets/index.json](/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1/modules/lighting_design_principles/datasets/index.json)
- [fewshot/index.json](/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1/modules/lighting_design_principles/fewshot/index.json)
- [eval/index.json](/Users/robterry/Projects/xLightsDesigner/training-packages/training-package-v1/modules/lighting_design_principles/eval/index.json)

## 3) What Is Actually In Place

### 3.1 Intent normalization exists, but is shallow

Current normalization in [intent-normalizer.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/intent-normalizer.js):
- captures prompt text
- selected sections
- selected tags
- selected target ids
- infers coarse `tempoIntent`
- infers coarse `motionIntent`
- extracts a small set of literal effect overrides

This is useful as a bootstrap layer, but it is not yet a full `designer_dialog` contract. It does not yet normalize:
- change tolerance
- style direction
- color direction
- focus hierarchy
- revision mode semantics
- explicit preservation constraints beyond `preserveTimingTracks`
- structured user feedback deltas

### 3.2 Guided questioning exists, but only as a simple helper

Current guided questioning in [guided-dialog.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/guided-dialog.js):
- asks for goal if missing
- asks for section if missing
- asks for target priority if no targets resolve

This is materially below the active interaction contract, which expects:
- context-aware designer-led elicitation
- field-targeted clarification
- concise high-value question rounds
- clearer handling of style, scope, tolerance, and constraints

### 3.3 Creative brief synthesis exists, but only as an app helper

Current brief synthesis in [brief-synthesizer.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/brief-synthesizer.js):
- combines goals/inspiration/notes/references
- injects audio section map if available
- emits a readable summary object

This is a valid starting point, but it is not yet backed by:
- a canonical `creative_brief_v1` contract
- persistence rules
- update/merge semantics
- designer-specific evaluation criteria

### 3.4 Proposal seeding exists, but it is not a full designer runtime

Current planner in [planner.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/planner.js):
- normalizes intent
- resolves targets using `sequence_agent` targeting helpers
- builds proposal seed lines using `sequence_agent` sequencing strategy

This proves the handoff shape is viable, but it means the current designer domain is still heavily dependent on sequence-domain logic. The output is effectively:
- proposal seed lines for sequencing

not yet:
- a complete designer-side proposal object
- a formal review/edit lifecycle
- a dedicated creative decision runtime

### 3.5 The real proposal workflow still lives mostly in `app.js`

Current app-owned behavior in [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js):
- generate proposal flow
- creative brief handling
- intent handoff emission
- stale proposal detection
- proposal/apply gating
- orchestration matrix
- proposal history/version snapshots
- many designer-specific UI state transitions

This means `designer_dialog` is not yet mature in the same way as:
- `audio_analyst`
- `sequence_agent`

Those two now have explicit runtime boundaries. `designer_dialog` still depends on `app.js` for most of its actual lifecycle.

### 3.6 There is no dedicated designer contract/runtime layer yet

Missing today:
- `designer-dialog-contracts.js`
- `designer-dialog-runtime.js`
- `designer-dialog-orchestrator.js`
- designer failure taxonomy
- canonical proposal contract and review/apply-prep contract

This is the biggest architecture gap.

### 3.7 Training exists only as scaffold

Current `lighting_design_principles` status:
- datasets are bootstrap-level references
- few-shot is `pending`
- eval is `pending`

So the designer training package is much less mature than:
- `audio_track_analysis`
- `xlights_sequencer_execution`

### 3.8 Test coverage is narrow

Current dedicated designer tests only cover:
- intent normalization
- proposal seeding determinism

There is no dedicated test coverage yet for:
- guided questions
- creative brief synthesis
- proposal lifecycle
- stale proposal rebasing behavior
- handoff validity
- failure classification

## 4) Architectural Assessment

### 4.1 Strengths

- domain boundary is now explicit in the repo
- `designer_dialog` can now be kept focused as a creative specialist instead of absorbing all app-wide chat behavior
- active designer interaction contract is strong and detailed
- basic intent normalization and proposal seeding already exist
- integration with audio and sequencing roles is already conceptually defined

### 4.2 Weaknesses

- current designer domain is mostly helpers, not a true specialist runtime
- the conversational shell above specialist roles is not implemented yet
- too much designer lifecycle logic remains in `app.js`
- no canonical designer contracts
- no structured proposal object owned by designer runtime
- training/eval assets are largely placeholders

### 4.3 Practical conclusion

`designer_dialog` is currently:
- structurally isolated in the repo
- conceptually better-scoped now that app-wide chat is assigned to `app_assistant`
- partially implemented

But it is not yet end-to-end complete in the way `audio_analyst` and `sequence_agent` now are.

## 5) What The Next Phase Should Build

### 5.1 Canonical contracts

Needed:
- `designer_dialog_input_v1`
- `creative_brief_v1`
- `proposal_bundle_v1`
- `designer_dialog_result_v1`

### 5.2 Dedicated runtime boundary

Needed modules:
- `designer-dialog-contracts.js`
- `designer-dialog-runtime.js`
- `designer-dialog-orchestrator.js`
- `designer-dialog-ui-state.js`

### 5.3 App extraction

Move out of `app.js`:
- proposal generation orchestration
- creative brief state projection
- proposal stale/rebase rules
- proposal history/state projection
- guided clarification flow helpers

### 5.4 Training-package parity

Needed:
- real few-shot cases
- real eval cases
- prompt alignment with current role boundary
- runtime-contract-backed dataset references

### 5.5 Testing parity

Needed:
- contracts tests
- runtime tests
- orchestration tests
- creative brief fidelity tests
- proposal lifecycle tests

## 6) Audit Conclusion

`designer_dialog` is the next agent that needs full end-to-end hardening.

The implementation pattern should follow the same successful path used for:
- `audio_analyst`
- `sequence_agent`

That means:
1. define contracts,
2. extract runtime/orchestration,
3. persist canonical designer artifacts if needed,
4. align training assets,
5. back the role with dedicated tests,
6. shrink `app.js` to UI wiring and state reflection.
