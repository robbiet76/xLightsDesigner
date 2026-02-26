# Two-Agent Architecture and Flow (Conceptual)

## Purpose

Define how a human show designer collaborates with two agents:

- `Creative Director` agent: concept and artistic intent.
- `Executor` agent: technical realization in xLights.

This document is intentionally high level. It defines ownership, flow, and decision points without locking into concrete model mappings yet.

## Actors and Roles

### 1) Human User (Show Designer / Operator)

Primary role:
- Sets goals, constraints, and approval criteria.

Key responsibilities:
- Provide song choice, holiday/theme, audience context, neighborhood/safety constraints, and quality bar.
- Approve creative direction before technical execution.
- Approve or reject executor substitutions when intent cannot be matched exactly.

Decision authority:
- Final approval on concept.
- Final approval on tradeoffs and fallbacks.

### 2) Creative Director Agent

Primary role:
- Convert user intent into structured creative direction.

Owns:
- Story arc, mood progression, energy shaping, section intent.
- Conceptual spatial roles and effect-family boundaries.

Must not do:
- Name concrete props, model IDs, channels, controllers, or xLights implementation details.

### 3) Executor Agent

Primary role:
- Convert creative intent into technically valid xLights sequence plans and implementation.

Owns:
- Validation, feasibility assessment, model assignment logic, sequencing steps, and diagnostics.
- All concrete xLights decisions.

Must not do:
- Rewrite core artistic intent unless a constraint conflict requires a declared fallback.

## Collaboration Principles

- `Separation`: creative remains conceptual; execution remains technical.
- `Traceability`: every technical decision should link back to a creative intent element.
- `Explicit fallback`: substitutions must be visible, structured, and reviewable.
- `Human checkpointing`: user approves at defined gates instead of only at final output.

## End-to-End Interaction Flow

### Phase 0: Brief Intake (User -> Creative Director)

Inputs:
- Song, holiday/theme, target audience, tone, constraints, success criteria.

Output:
- Structured creative brief draft for confirmation.

User interaction:
- User confirms brief accuracy before creative generation.

### Phase 1: Creative Contract Generation (Creative Director)

Inputs:
- Approved brief.

Output:
- Creative contract JSON (conceptual vocabulary only).

User interaction:
- User reviews high-level arc and section intent.
- User approves or requests revisions.

### Phase 2: Technical Feasibility Planning (Executor, Pre-Implementation)

Inputs:
- Approved creative contract.
- Local xLights environment context (inventory and constraints, when available).

Output:
- Feasibility and mapping plan:
  - what can be matched directly,
  - where substitutions may be needed,
  - risk areas requiring user attention.

User interaction:
- User approves tradeoff policy for this show before full build.

### Phase 3: Execution Build (Executor)

Inputs:
- Approved contract + approved tradeoff policy.

Output:
- Implemented xLights sequence artifact(s) and execution report.

User interaction:
- User reviews result and any critical fallback events.

### Phase 4: Review and Iteration (User + Both Agents)

Inputs:
- Execution report and playback feedback.

Output:
- Focused change requests:
  - creative intent updates (handled by Creative Director),
  - technical tuning updates (handled by Executor).

User interaction:
- User decides if changes are conceptual, technical, or both.

## Control Gates (Required Approvals)

1. `Gate A`: Brief approved by user.
2. `Gate B`: Creative contract approved by user.
3. `Gate C`: Executor tradeoff/fallback policy approved by user.
4. `Gate D`: Final sequence accepted by user.

## Interaction Surfaces

### User <-> Creative Director

Used for:
- Intent, style, storytelling, emotional contour, audience fit.

Not used for:
- xLights technical details.

### User <-> Executor

Used for:
- Feasibility, constraints, substitutions, implementation risks, final delivery.

Not used for:
- Redefining artistic narrative without explicit user request.

### Creative Director <-> Executor

Used for:
- Structured handoff contract and clarification requests.

Required behavior:
- Executor asks for clarification when intent is ambiguous.
- Creative Director responds in conceptual terms only.

## Core Artifacts

- `Creative Brief`: user-approved intent and constraints.
- `Creative Contract`: sectioned conceptual plan for execution.
- `Execution Plan`: technical feasibility and mapping strategy.
- `Execution Report`: assignments, substitutions, unresolved intent, risk flags.

## Fallback and Escalation Model

When exact realization is not possible:

1. Executor applies pre-approved fallback policy.
2. Executor records structured diagnostics.
3. Critical mismatches are escalated to user for approval.
4. If fallback changes artistic meaning, route back through Creative Director and user.

## What We Need Before xLights-Deep Work

1. Canonical `User Brief` template.
2. Tradeoff policy schema (what can auto-substitute vs must escalate).
3. Standardized `Execution Report` shape for user review.
4. Acceptance rubric (quality thresholds for “ship” vs “revise”).
5. Test scenarios covering common show types and edge constraints.

## Out of Scope for This Phase

- Concrete prop/model assignment rules.
- Controller/channel-level implementation details.
- Performance optimization inside xLights runtime.

