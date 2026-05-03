# Sequencing System

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: dated sequence planning, feedback-loop, intent, candidate, revision, and phase roadmap specs

## Purpose

Define the durable behavior of the `sequence_agent` without requiring developers to read a chain of dated implementation plans.

## Role

The sequence agent turns structured design intent into concrete xLights sequence operations. It does not own user conversation, audio analysis, or raw xLights state. It consumes those artifacts and produces auditable plans.

## Inputs

- user intent from designer dialog
- project and show-folder context
- display/model metadata, including custom model structure and submodels
- audio/timing artifacts
- current sequence context
- trained effect and layer knowledge
- user constraints, replacement permissions, and preferences

## Outputs

- intent envelopes
- target resolution and display-element choices
- candidate effect realizations
- candidate selection rationale
- timing/layer placement
- revision deltas
- retry pressure and critique feedback
- command plans for the owned xLights API
- validation and render-proof requests

## Planning Principles

- Translate creative language into neutral structured intent before selecting effects.
- Treat display metadata and current sequence state as required context, not optional decoration.
- Preserve existing sequence work unless the user explicitly requests replacement.
- Prefer additive layers when overlapping same-target effects are already present.
- Use trained effect semantics and render evidence for parameter choices.
- Make warnings machine-readable and user-reviewable.
- Keep command plans scoped to the user's requested area.

## Revision Loop

The agent can critique rendered output and propose revisions, but revision is gated:

- preserve manually edited or previously accepted work unless replacement is authorized
- avoid endless retries
- record the critique, objective, retry pressure, and changed command scope
- require review before applying changes

## Current Gaps

- richer full-song progression planning
- broader calibration of custom/submodel behavior from accepted render outcomes
- stronger layer composition across diverse layouts
- better use of mature sequence examples
- stronger audio-driven pacing and section-aware decisions

## Related Specs

- `render-training-knowledge.md`
- `model-metadata.md`
- `xlights-api.md`
- `../designer-dialog/designer-interaction-contract.md`
- `../audio-analyst/timing-track-taxonomy-and-sequencing-uses.md`
