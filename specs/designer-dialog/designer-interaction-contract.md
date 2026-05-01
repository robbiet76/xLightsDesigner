# Designer Interaction Contract

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: Sprint 0 interaction contract and later chat-first/director-designer amendments

## Purpose

Define how xLightsDesigner captures user creative intent, turns it into structured design inputs, and hands reviewable sequencing work to downstream agents without becoming a black-box generator or a duplicate xLights editor.

## Role

`designer_dialog` is the creative specialist between the user-facing `app_assistant` and the execution-focused `sequence_agent`.

It owns:

- creative elicitation and clarification
- display understanding from a design perspective
- director preference interpretation
- proposal shaping and human-readable change summaries
- structured sequencing handoff quality

It does not own:

- audio analysis
- raw xLights state access
- command generation
- mutation apply
- rollback mechanics
- model/provider selection policy

## Core Principles

- Natural language is the primary input.
- Structured fields are required before apply.
- The user is the director; the agent is the lighting designer.
- The agent should translate broad artistic intent into concrete, scoped, reviewable proposals.
- The agent may make bounded creative assumptions when the request is broad, but assumptions must be visible before apply.
- Existing sequence work is preserved unless replacement is explicit.
- Every mutation is tied to a visible change set and current sequence revision.
- User edits in xLights require a fresh scan or rebase before further apply.
- xLightsDesigner should not recreate xLights timeline or sequencer editing surfaces.

## Role Boundaries

Runtime roles:

- `app_assistant`: unified user-facing chat shell and routing layer.
- `audio_analyst`: music analysis, timing context, and reusable track artifacts.
- `designer_dialog`: creative direction, clarification, preference-aware proposal shaping, and structured design handoff.
- `sequence_agent`: target resolution, effect choice, timing/layer placement, command planning, revision planning, and apply-readback validation.

Broad creative requests should flow through `designer_dialog`.

Specific technical sequencing requests may bypass creative elicitation only when they are already executable. They must still be normalized into the same structured handoff shape before reaching `sequence_agent`.

## Supported User Intent

The designer must support all of these prompt styles:

- specific: "Reduce twinkle on candy canes in chorus 2."
- semi-structured: "Make chorus bigger, keep verse calm."
- subjective: "Create a sense of magic in the background, like a starry night."

All three must produce a valid proposal path.

Supported interaction modes:

- `create`: initial sequence authoring from high-level intent.
- `revise`: targeted updates to existing sequence content.
- `polish`: constrained quality pass for intensity, timing, transitions, or readability.
- `analyze`: read-only diagnostics and recommendations.

Supported intent verbs:

- `analyze`
- `propose_changes`
- `refine_proposal`
- `apply_approved_plan`

## Required Context

Proposal quality depends on:

- project and sequence context
- current show folder and layout metadata
- display/model metadata and semantic tags
- custom model understanding when relevant
- audio analysis and timing tracks when available
- current sequence state and revision
- user constraints, preferences, and preservation rules

The designer should ask clarification questions only when ambiguity would materially change the outcome or increase apply risk.

## Preference Memory

Preference learning must remain explicit and inspectable.

Stable professional design knowledge and user-specific preference memory are separate:

- Core design knowledge covers composition, pacing, color, focus, contrast, staging, layering, and visual storytelling.
- Director preference knowledge covers user-specific tendencies such as motion density, pacing, color taste, focus patterns, and tolerance for complexity.

Preference rules:

- preferences are weighted tendencies, not binary rules
- accepted proposals may strengthen preferences
- repeated revision requests may weaken or counter preferences
- preferences should apply at the narrowest reasonable scope
- preferences must not override safety, readability, or hard design-quality constraints
- the agent should be able to explain when learned preferences influenced a proposal

User-specific preference records belong in `director_profile_v1` or its successor, not in the stable design-principles corpus.

## Interaction Flow

Normal creative flow:

1. Gather project, sequence, display, audio, and current-state context.
2. Capture user creative intent.
3. Ask concise domain-informed clarification questions only when needed.
4. Build a structured design handoff.
5. Produce a human-readable proposed change set.
6. Let the user review, refine, approve, or cancel.
7. Hand approved structured intent to `sequence_agent`.
8. Show readback, validation, warnings, and history after apply.

Direct technical flow:

1. Normalize the specific request into canonical design handoff fields.
2. Preserve the same review/apply gates.
3. Avoid creative elicitation unless required context is missing.

## Pre-Apply Requirements

No mutating apply can execute unless these are known:

- open sequence context
- explicit target scope
- explicit time scope or full-sequence confirmation
- mutation type
- preservation/replacement constraints
- base revision token from the latest read
- explicit user approval action

If the current sequence revision no longer matches the proposal base revision, the system must refresh and rebase or regenerate before apply.

## Proposal Contract

Proposals must be visible, reviewable, and understandable to non-technical users.

Each proposed change should include:

- human-readable summary
- affected target scope
- affected timing scope
- intended visual result
- assumptions made by the designer
- risk or replacement warnings
- whether existing work is preserved, updated, deleted, or layered over
- traceability to user intent and relevant context

Summary language should describe design intent, not raw internal command strings. Good examples:

- "Add gentle twinkle texture to background props."
- "Shift chorus palette toward cooler high-contrast accents."
- "Soften bridge transitions to reduce visual busyness."

## UI Contract

The primary interaction is chat-first.

App UI should support:

- persistent chat/composer access
- visible project, show folder, sequence, xLights status, and revision
- compact proposal, intent, media, history, metadata, and project summaries
- explicit `Apply to xLights` approval
- global refresh/rebase behavior
- diagnostics and warnings without hiding apply blockers

Right-side or inspector panels are summaries and setup surfaces, not comprehensive sequencing forms. Users can refine scope, timing, mood, and targets through chat.

xLights timeline/lane-level editing remains out of scope for xLightsDesigner UI.

## Timing Labels

Designer-owned semantic timing tracks use the `XD:` prefix.

The designer may project song/design structure into app-owned timing tracks when that improves clarification or sequencing handoff. These labels must remain stable enough for `sequence_agent` to reference during proposal generation and review.

## Error And Recovery

- Validation failure should produce actionable correction prompts.
- Stale sequence revision should trigger refresh and rebase/regeneration.
- Apply failure should surface partial/rollback status and recovery options.
- User-authored xLights edits between turns should trigger fresh scan before apply.

## Acceptance Criteria

1. User can request targeted revisions without unrelated sequence drift.
2. Broad subjective prompts can produce concrete proposals without forcing structured form input.
3. Proposed changes are reviewable with scope, intent, assumptions, and risk metadata before apply.
4. Mutating apply never occurs without explicit user approval.
5. Applied changes are traceable to change sets and deterministic readback.
6. The user can iteratively refine while preserving accepted areas.
7. Agent asks domain-informed clarification questions only when needed.
8. Timing labels and section context can be referenced in proposal generation.
9. Proposal summaries are readable by non-technical users.
10. User edits between turns cause refresh/rebase before apply.

## Related Specs

- `sequencing-design-handoff-v2.md`
- `director-profile-v1.md`
- `display-metadata-v1.md`
- `display-discovery-conversation.md`
- `../app-ui/app-workspace.md`
- `../sequence-agent/sequencing-system.md`
- `../sequence-agent/xlights-api.md`
