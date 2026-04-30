# Agent Model Selection Policy

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: point-in-time OpenAI model selection note

## Purpose

Define durable model-selection behavior for local assistant agents without hardcoding time-sensitive provider model names into the product spec.

## Policy

Use the minimum capable configured model for each agent task.

The app should prefer cost-conscious defaults for normal routing, conversation, display discovery, handoff drafting, and eval/simulation runs. Larger or more expensive models should be explicit escalations, not silent defaults.

## Runtime Precedence

Default precedence:

1. stored app provider setting
2. environment override such as `OPENAI_MODEL`
3. app fallback default

The fallback default may change as provider offerings evolve. The current runtime value belongs in settings/configuration and validation evidence, not in this durable policy.

## Escalation Rules

Escalate only when:

- a validation loop repeatedly fails on the configured default
- full-sequence planning requires broader reasoning across many artifacts
- the agent must resolve ambiguous conflicts between sequence state, user intent, and render feedback
- release-quality evaluation shows materially better outcomes from a larger model

Escalation must be visible in diagnostics and configurable by the user/provider settings.

## Agent Guidance

Stay on the configured economical model for:

- app assistant routing
- normal designer conversation
- structured handoff drafting
- display discovery conversation
- cost-sensitive eval/simulation runs

Use stronger configured models for:

- complex full-song planning
- hard conflict resolution
- repeated failed validation/revision loops
- high-value release-gate evaluations

## Image Generation

Image generation uses a separate configured provider/model from text agents.

Visual inspiration and sequence media generation must record actual provider, model, prompt, revision, and source metadata in the visual design asset manifest.
