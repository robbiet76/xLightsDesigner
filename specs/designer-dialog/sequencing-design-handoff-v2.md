# Sequencing Design Handoff V2 Spec

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

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

Internal contract:

- `sequencing_design_handoff_v2`

Current policy:
- `intent_handoff_v1` remains the broad compatibility envelope for app and sequence-agent entry.
- `sequencing_design_handoff_v2` is the richer designer-driven sequencing contract.
- Designer-driven paths should attach `sequencing_design_handoff_v2` when enough creative context exists.
- The sequencer should prefer `sequencing_design_handoff_v2` over vague goal text when both are present.

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

## Adoption Requirements

Designer-driven sequencing paths should produce:
- a valid `intent_handoff_v1` compatibility envelope
- a valid `sequencing_design_handoff_v2` internal handoff when the request includes creative or display-specific direction

Runtime validation should reject malformed `sequencing_design_handoff_v2` payloads instead of silently falling back to vague-only intent.

Training and evaluation examples for designer-driven sequencing should use `sequencing_design_handoff_v2` as the target contract. `intent_handoff_v1` remains useful for direct technical requests, compatibility tests, and app-level routing.
