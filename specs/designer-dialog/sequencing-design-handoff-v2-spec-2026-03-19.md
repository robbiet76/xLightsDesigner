# Sequencing Design Handoff V2 Spec

Status: Draft
Date: 2026-03-19
Owner: xLightsDesigner Team

## Purpose
Define the internal handoff contract between `designer_dialog` and `sequence_agent` so the sequencer receives explicit, actionable sequencing direction without exposing that internal structure to the end user.

## Boundary

### Director -> Designer
User-facing conversation.

Characteristics:
- natural language
- high-level goals
- taste and preference discussion
- broad revision feedback
- concept-level direction

Examples:
- "Make the chorus feel bigger."
- "I want this cleaner and more elegant."
- "Let the trees lead here and keep the rest secondary."

This boundary must remain lightweight and conversational.

### Designer -> Sequencer
Internal execution handoff.

Characteristics:
- structured
- specific
- operational
- testable
- not surfaced directly in chat

The user should not be asked to think in these terms unless they explicitly want expert-level control.

## Design Rule
The designer is responsible for translating vague or semi-structured director intent into a sequencer-ready handoff.

The sequencer is responsible for executing that handoff faithfully and creatively within its allowed latitude.

The sequencer should not be the primary interpreter of vague director language.

## Why V2 Is Needed
Current `intent_handoff_v1` is too coarse for stable sequencer training.

It carries:
- goal
- scope
- constraints
- coarse director preferences

It does not require:
- section purpose
- prop roles
- density target
- motion target
- transition intent
- avoidances
- preferred visual families
- execution latitude

That leaves too much ambiguity in the sequencer.

## Contract Shape
Proposed internal contract:
- `sequencing_design_handoff_v2`

This can either:
- replace `intent_handoff_v1` for designer-driven sequencing
or
- sit alongside it during migration

Recommended approach:
- keep `intent_handoff_v1` for compatibility
- add `sequencing_design_handoff_v2` as the richer contract consumed by the sequencer when available

## Required Fields

### Identity
- `artifactId`
- `createdAt`
- `contractVersion`
- `agentRole`
- `requestId`
- `baseRevision`

### Goal Layer
- `goal`
  - concise overall execution objective
- `designSummary`
  - short human-readable summary of the sequencing intent

### Scope Layer
- `scope.sections`
- `scope.targetIds`
- `scope.tagNames`
- `scope.timeRangeMs`

### Section Directives
- `sectionDirectives[]`

Each section directive must include:
- `sectionName`
- `sectionPurpose`
  - examples:
    - `intro_establish`
    - `verse_support`
    - `chorus_reveal`
    - `bridge_reset`
    - `outro_resolve`
- `energyTarget`
  - `low | medium | high | peak`
- `motionTarget`
  - examples:
    - `still`
    - `restrained_motion`
    - `steady_motion`
    - `expanding_motion`
    - `aggressive_motion`
- `densityTarget`
  - `sparse | moderate | dense | very_dense`
- `transitionIntent`
  - examples:
    - `hold`
    - `build`
    - `release`
    - `snap`
    - `resolve`

Optional per-section fields:
- `preferredVisualFamilies[]`
- `avoidVisualFamilies[]`
- `notes`

### Prop Role Assignments
- `propRoleAssignments[]`

Each assignment:
- `targetId`
- `role`
  - `lead | support | accent | background | texture`
- `priority`
  - numeric or ordinal
- `behaviorIntent`
  - short directive such as:
    - `carry main motion`
    - `support with restrained motion`
    - `accent phrase endings`

### Focus Plan
- `focusPlan.primaryTargets[]`
- `focusPlan.secondaryTargets[]`
- `focusPlan.accentTargets[]`
- `focusPlan.balanceRule`

### Visual Family Preferences
- `visualFamilyPreferences.preferred[]`
- `visualFamilyPreferences.allowed[]`
- `visualFamilyPreferences.avoid[]`

These should refer to structural families, not exact effect settings.

Examples:
- `large_form_motion`
- `segmented_directional`
- `soft_texture`
- `radial_rotation`
- `spiral_flow`
- `diffuse_shockwave`

### Constraints
- `constraints.preserveTimingTracks`
- `constraints.allowGlobalRewrite`
- `constraints.changeTolerance`
- `constraints.readabilityPriority`
- `constraints.flashTolerance`

### Avoidances
- `avoidances[]`

Examples:
- `no_full_yard_noise_wall`
- `no_busy_background_texture`
- `no_multiple_competing_leads`
- `avoid_high_flash_behavior`

### Execution Latitude
- `executionLatitude`
  - `tight | moderate | broad`

Meaning:
- `tight`
  - sequencer should stay close to the brief
- `moderate`
  - sequencer may choose execution details and refine within the brief
- `broad`
  - sequencer may explore more within the stated design direction

### Traceability
- `traceability.briefId`
- `traceability.proposalId`
- `traceability.directorProfileSignals`
- `traceability.designSceneSignals`
- `traceability.musicDesignSignals`

## Non-Goals
This contract should not contain:
- raw xLights command payloads
- low-level effect settings for every placement
- verbose designer chain-of-thought
- user-facing prose that exists only for conversation

Those belong elsewhere.

## User Experience Rule
The app should not surface the full internal handoff structure in the normal user chat flow.

The user-facing layer should remain:
- conversational
- director-oriented
- concise

The designer may summarize the brief in natural language, but the internal structured handoff stays behind the scenes.

This is a hard UX boundary.

## Designer Training Implications
The designer should be trained to do two things well:

1. talk naturally with the director
- gather intent without burdening the user with sequencing jargon
- ask only clarifying questions that materially affect the result

2. emit a precise internal sequencing brief
- explicit section directives
- explicit prop roles
- explicit visual goals
- explicit avoidances

That means designer training should not optimize for:
- exposing structured internals to the user
- asking the user to fill in execution-level fields directly

It should optimize for:
- implicit extraction
- structured normalization
- disciplined translation from natural direction into sequencing directives

## Sequencer Training Implications
The sequencer should be trained against:
- `sequencing_design_handoff_v2`
not vague chat text

That will make sequencer behavior:
- more consistent
- more testable
- less stylistically generic
- less dependent on fragile prompt inference

## Migration Plan
1. define `sequencing_design_handoff_v2` schema
2. add validator support
3. teach `designer_dialog` to emit it in parallel with `intent_handoff_v1`
4. update `sequence_agent` to prefer `sequencing_design_handoff_v2`
5. update tests and training packages to use the new contract
6. de-emphasize direct sequencer reliance on vague `goal` + `directorPreferences`

## Immediate Next Steps
1. create the machine-readable contract file
2. add app/runtime validators
3. add designer tests that reject vague-only handoff payloads
4. update sequence-agent input validation to require the richer contract on the designer-driven path
