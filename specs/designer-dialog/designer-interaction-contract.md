# Designer Interaction Contract: Agent + User Iterative Sequencing

Status: In Progress (Sprint 0)
Date: 2026-03-07
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

Scope: xLightsDesigner interaction layer above xLights control APIs

## 1) Purpose
Define how user intent is captured, clarified, and converted into deterministic, reviewable API mutations so sequence design is iterative, not a black-box one-shot generation flow.

This spec defines the contract between:
- `app_assistant` as the unified user-facing chat shell,
- `designer_dialog` as the creative specialist runtime,
- downstream specialist/runtime layers,
- existing xLights v2 control APIs.

## 2) Design Goals
- Keep user in control with clear scope and constraints.
- Make every proposed mutation inspectable before apply.
- Support iterative refinement ("keep X, change Y") without global unintended drift.
- Preserve deterministic behavior and rollback safety in execution.
- Let the agent act as a lighting designer that translates director-level intent into executable design choices.
- Let the agent make bounded creative assumptions autonomously when user direction is broad, as long as those assumptions are traceable in the brief/proposal and remain reviewable before apply.
- Allow the agent to improve over time by learning the recurring preferences of its user/director without collapsing into a fixed house style.
- Avoid recreating xLights editing surfaces; xLightsDesigner is a director console, not a sequencer replacement.

## 3) Core Principles
1. Natural language is primary, structured fields are mandatory before apply.
2. Default operation mode is surgical edits, not global rewrites.
3. All applies are represented as explicit change sets with scope.
4. User feedback updates future proposals but does not silently rewrite prior accepted regions.
5. Every applied change can be traced, reverted, and replayed.
6. When user intent is incomplete, the agent must proactively ask domain-relevant questions using lighting and audio context.
7. User and agent are collaborative co-editors; if user edits occur, agent must refresh sequence state before proposing/applying further mutations.
8. `designer_dialog` is expected to act autonomously as a creative specialist: it should make reasonable lighting-design assumptions and advance the work unless a missing decision would create unacceptable ambiguity or risk.
9. The user is the director; `designer_dialog` should learn that director's preferences over time and use them as soft steering guidance, not hard stylistic lock-in.

## 3.4) Dual-Knowledge Model

`designer_dialog` must operate from two distinct knowledge buckets that remain separate in both runtime design and training strategy.

### Core design knowledge
Stable, user-independent professional knowledge:
- artistic principles
- composition
- lighting design craft
- visual storytelling
- pacing and rhythm
- focus and contrast
- color theory
- staging, layering, and reveal logic

Rules:
- this is the designer's professional baseline
- it must not be rewritten by user preference learning
- it should improve only through curated training, explicit spec updates, and deliberate external corpus refinement

### Director preference knowledge
Adaptive, user-specific soft guidance:
- preferred motion density
- preferred pacing intensity
- focus/emphasis tendencies
- palette tendencies
- tolerance for complexity
- tolerance for aggressive vs conservative changes
- recurring likes/dislikes inferred from accepted and rejected work

Rules:
- this must be stored separately from core design knowledge
- it must remain soft steering guidance, not hard rules
- it may bias choices within the space allowed by good design practice
- it must not collapse the designer into fixed style imitation

### Required balance
- core design knowledge determines principled design quality
- director preferences bias choices within that principled space
- the system must preserve freshness, novelty, and variation while still converging toward the director's taste over time
- preference learning must never override safety, readability, or other hard design-quality constraints

## 3.1) Sprint 0 Lock: v1 Intent Contract

### Supported v1 intent verbs
- `analyze`: read-only analysis and recommendations.
- `propose_changes`: produce a scoped, reviewable mutation proposal.
- `refine_proposal`: regenerate proposal with updated constraints.
- `apply_approved_plan`: execute previously approved command plan.

### Required fields before `apply_approved_plan`
- open sequence context
- explicit target scope (models/groups/submodels and/or metadata tags)
- explicit time scope (range or explicit full-sequence confirmation)
- base revision token from latest sequence read
- explicit approval from user action (button-driven)

### Guided workflow requirement (v1)
- Agent must guide users through a structured creative workflow:
  - project concept, tone, goals
  - sequence-specific intent and constraints
  - gap-filling questions before plan generation
- Agent should proactively identify missing decisions and present concise choices.
- Agent owns sequencing craft decisions (effect choice, layering approach, transition technique, model emphasis) while honoring user direction.
- User is treated as director-level intent owner; agent is responsible for translating intent into concrete sequencing plans.
- Agent should not stall on every open variable. When enough guidance exists to make a conservative, reviewable creative decision, it should proceed and make the assumption explicit in the brief/proposal.
- Preference learning is a required behavior:
  - user likes/dislikes
  - preferred pacing/motion tendencies
  - favored emphasis/focus patterns
  - tolerance for aggressive vs conservative changes
  These should influence future proposals as soft preferences, not as immutable rules.

### Agent-assisted settings edits (v1)
- Agent may read and propose updates to editable app form/settings fields.
- Agent may apply settings edits only after explicit user confirmation.
- Agent should offer to apply settings changes when they reduce friction for the user.

### v1 non-goals (interaction-level)
- free-form autonomous apply without explicit user approval
- hidden/background mutation outside visible proposal contract
- global sequence rewrites unless user explicitly confirms elevated risk
- controller/channel configuration authoring
- requiring users to micromanage low-level effect authoring choices for normal workflows

## 3.2) Multi-Agent Role Boundary Contract

This interaction contract assumes three cooperating runtime roles:
- `audio_analyst`
- `designer_dialog`
- `sequence_agent`

Boundary rules:
- `app_assistant` is the unified user-facing chat shell across the whole product.
- `designer_dialog` is the creative specialist that `app_assistant` invokes when the conversation is primarily about design intent, proposal shaping, and creative refinement.
- `audio_analyst` provides structured analysis context; it does not own apply decisions or timing-track writes.
- `sequence_agent` owns technical plan construction for apply paths (including timing-track creation decisions); it does not bypass approval or revision gates.

Required upstream context for `designer_dialog` proposal quality:
- `analysis_handoff_v1` from `audio_analyst` when available.

Required upstream context for `sequence_agent` execution quality:
- `intent_handoff_v1` from `designer_dialog`.
- `analysis_handoff_v1` from `audio_analyst` for timing/context-aware sequencing.

## 3.3) Direct Technical Sequencing Exception
`designer_dialog` is the preferred/default path for creative sequencing work.

However, xLightsDesigner must also support direct technical sequencing requests from the user when the request is already specific enough to execute, for example:
- exact target/model requests
- explicit effect changes
- narrow revise/apply asks
- timing/shift/scope corrections

Rules:
- direct technical sequencing requests may bypass `designer_dialog`
- they must still be normalized into the same canonical `intent_handoff_v1` shape before `sequence_agent`
- `sequence_agent` must not receive ad hoc free-form user text as its only contract input
- direct technical sequencing is a secondary/expert path, not the long-term primary creative workflow

Practical consequence:
- broad creative/design requests should still go through `designer_dialog`
- explicit technical sequencing requests may go `app_assistant -> handoff normalizer -> sequence_agent`

## 3.5) Preference Memory Contract

Preference learning must be explicit and inspectable.

Required behavior:
- accepted proposals and retained sequencing choices may strengthen preference signals
- repeated revision requests may weaken or counter prior preference signals
- preferences must be represented as weighted tendencies, not as binary absolutes
- `designer_dialog` must be able to explain when a proposal is being influenced by learned preferences

Required artifact boundary:
- user-specific preferences belong in a dedicated `director_profile_v1` artifact
- `creative_brief_v1` and `proposal_bundle_v1` may reference which profile signals influenced the current pass
- `director_profile_v1` must remain separate from the stable design-principles corpus

## 4) Interaction Model

### 4.1 Modes
- `create`: initial sequence authoring from high-level intent.
- `revise`: targeted updates to existing sequence content.
- `polish`: constrained quality pass (intensity, timing tightness, transitions, etc.).
- `analyze`: read-only diagnostics/recommendations with no mutation.

### 4.2 Flow States
1. Initial Creative Analysis (new sequence setup or re-seed on demand)
2. Capture Intent
3. Clarify Missing Inputs (if needed)
4. Build Proposed Change Set
5. User Review/Adjust
6. Apply via API
7. Readback + Summary
8. Continue Iteration

Direct technical sequencing requests use the same review/apply model after normalization.
They do not bypass:
- explicit draft visibility
- approval gating
- sequence revision safety
- apply/readback checks

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

Clarification is not the default answer to every gap.
- If a missing field would materially change safety, scope, or reviewability, ask.
- If a missing field can be covered by a bounded, conservative designer assumption, proceed and record the assumption in the brief/proposal.

## 6.5 Initial Creative Analysis (Required for New Sequence Authoring)
- Before first major proposal in `create` mode, agent performs a creative analysis pass.
- Creative analysis begins with a short kickoff conversation to capture user goals, desired feel, and inspiration.
- Analysis sources:
  - audio track features (section boundaries, energy shape, rhythmic density),
  - lyrics/text when available (theme, emotional tone, narrative cues),
  - user-provided visual references (single image, multiple images, or video clips),
  - optional external context research for inspiration.
- External research is optional and must not block proposal generation.
- Analysis output must be summarized as a `Creative Brief` that guides proposal generation.
- `Creative Brief` should include:
  - user goals + inspiration summary,
  - section map candidates,
  - mood/energy arc,
  - narrative/theme notes,
  - visual direction cues inferred from references,
  - initial design hypotheses.
- User can refine or override the brief before large apply operations.
- If external research is used, source links/notes should be retained in internal traceability metadata.
- If user visual references are provided, brief traceability should retain reference ids/filenames and a short interpretation note.

## 6.1 Designer-Led Elicitation (Required Behavior)
- Agent should behave as an interactive designer, not a passive command executor.
- Agent should infer likely missing inputs from:
  - audio structure (intro/verse/chorus/drop/outro),
  - detected rhythm/energy changes,
  - current sequence style and effect density,
  - prior user likes/dislikes in session memory.
- Agent must present concise, high-value questions that reduce ambiguity before proposing mutations.
- Agent must also be willing to proceed without another question round when:
  - user direction is broad but usable,
  - a conservative creative assumption is available,
  - the resulting proposal stays explicit, scoped, and reviewable.

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
- Do not over-question. The designer should ask only when the answer materially changes the proposal or prevents a coherent design decision.

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

## 7.1.1 Assumption Transparency
- Proposals must surface important designer assumptions explicitly.
- Assumptions should be framed in designer terms, for example:
  - focus hierarchy chosen
  - motion strategy assumed
  - palette direction inferred
  - change tolerance inferred from prior collaboration
- These assumptions are reviewable and may be corrected by the user without invalidating the overall role autonomy model.

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
- `xlights-sequencer-control-agent-orchestration-architecture.md`
- `xlights-sequencer-control-project-spec.md`
- `xlights-sequencer-control-api-surface-contract.md`

## 16) Chat-First UI Contract (Amendment)
Status: Proposed  
Date: 2026-03-05

### 16.1 Rationale
- Sequencing intent is inherently high-variance and too complex for comprehensive form controls.
- Chat is the primary interaction mode and must remain continuously available.
- Right-side UI should communicate agent state and planned mutations, not replicate manual sequencing tools.

### 16.2 Layout Contract
1. Minimal persistent header remains at top:
   - `Project`
   - `Active Sequence`
   - `xLights Status`
   - `Revision`
   - Global `Refresh`
2. Main body is split:
   - Left pane: persistent chat thread + composer (always visible).
   - Right pane: stacked collapsible summary panels, single-open behavior.
3. Diagnostics is a simple expandable drawer at bottom (collapsed by default), not a top-header action target.

### 16.3 Right Pane Panel Order
1. `Media`
2. `Intent`
3. `Proposed`
4. `History`
5. `Metadata`
6. `Project`

### 16.4 Interaction Ownership
1. User may operate chat-only.
2. Agent is primary owner of sequencing selections and mutation planning.
3. Right-side panels are read-only summaries by default.
4. If user wants changes, user requests them in chat; agent updates plan/selections accordingly.
5. Direct user-editable controls in right pane are limited to setup/runtime concerns (project/sequence/media/connection/safety).

### 16.5 Sequencing Controls Policy
1. No broad manual sequencing forms for scope/mood/energy/range in main right-pane summaries.
2. No full model/group/submodel browser in primary flow.
3. Targeting details should be presented as compact summary tokens generated by agent and editable through chat requests.
4. xLights timeline/lane-level edits remain out of scope for xLightsDesigner UI.

### 16.6 Timing Track Policy
1. `XD:` prefix remains the app-owned timing track identity.
2. Agent creates and manages `XD:` tracks as needed from dialog context.
3. UI surfaces available `XD:` tracks and associated labels/sections as reference context.
4. Panel-level refresh controls are not used; refresh is global/automatic at project/sequence level.

### 16.7 Apply and Approval Policy
1. Proposed changes remain explicit and reviewable before apply.
2. User approval remains explicit (`Apply to xLights`).
3. Rollback remains available from history.
4. Chat may request regenerate/re-target/re-scope without direct right-pane editing.

## 17) Implementation Steps (for Amendment 16)
1. Replace left-nav routed content with split workspace shell:
   - persistent chat left,
   - single-open panel stack right.
2. Keep minimal top header and global refresh wiring.
3. Convert right-side sequencing panels to read-only summaries:
   - remove manual sequencing form controls,
   - keep concise state/proposal summaries.
4. Add `Media` summary panel at top of right stack.
5. Move diagnostics to bottom expandable drawer and remove header diagnostics action.
6. Preserve existing apply gating/stale/revision safety rules unchanged.
7. Preserve history rollback/compare mechanics.
8. Add acceptance checks:
   - chat-only flow can fully drive targeting and proposal generation,
   - right-pane summary updates reflect agent decisions,
   - no sequencing-critical action requires manual right-pane form edits.

## 18) Director vs Designer Contract (Subjective Intent Translation)
Status: Proposed  
Date: 2026-03-05

### 18.1 Roles
1. User is the `Director`: can provide either precise commands or broad artistic direction.
2. Agent is the `Designer`: responsible for translating direction into concrete, scoped sequence mutations.
3. Agent must not require users to speak in rigid `Section/Model/Change` syntax.

### 18.2 Accepted User Prompt Styles
1. Specific: "Reduce twinkle on candy canes in chorus 2."
2. Semi-structured: "Make chorus bigger, keep verse calm."
3. Subjective/artistic: "Create a sense of magic in the background, like a starry night."

All three are first-class and must produce a valid proposal path.

### 18.3 Translation Behavior (Required)
1. Agent infers likely targets, timing, and effect families from intent + current sequence context.
2. Agent asks clarifying questions only when ambiguity would materially change outcome.
3. If user is broad and does not constrain scope, agent may use bounded artistic license and proceed with a conservative, reversible proposal.
4. Agent must summarize inferred decisions back to user before apply.

### 18.4 Proposed Change Summary Writing Rules
1. Proposed entries should be concise designer summaries, not raw internal command strings.
2. Entries should be readable by non-technical users.
3. Prefer language like:
   - "Add gentle twinkle texture to background props"
   - "Shift chorus palette toward cooler high-contrast accents"
   - "Soften bridge transitions to reduce visual busyness"
4. Avoid forcing every row into strict slash-delimited fields.
5. Optional context tags may be appended only when helpful (for example, affected models or section labels).

### 18.5 Acceptance Additions
1. A broad subjective user prompt produces a concrete proposed change set without requiring structured form input.
2. Proposed list entries are human-readable summaries of intended design changes.
3. User can refine those summaries through chat ("less sparkle", "more dramatic", "only background") without losing unaffected accepted content.
