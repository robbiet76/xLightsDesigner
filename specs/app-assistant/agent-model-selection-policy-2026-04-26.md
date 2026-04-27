# Agent Model Selection Policy

Status: Active
Date: 2026-04-26
Owner: xLightsDesigner Team

## Prompt Captured

> proceed. please confirm we are using a good model for the agents as well since OpenAI models have been updated. I think we are using gpt-4.1-mini-2025-04-14 so I'm not sure if that should be updated. I do like that it is inexpensive and we should continue to use the minimum model needed for the agents to keep cost down.

## Decision

Use `gpt-5.4-mini` as the default text agent model for local development and BYO-provider desktop use.

Reasons:
- current OpenAI docs identify `gpt-5.5` as the flagship model for complex reasoning and coding
- current OpenAI docs identify smaller variants such as `gpt-5.4-mini` and `gpt-5.4-nano` as the cost/latency-optimized options
- `gpt-5.4-mini` is a better fit than the old `gpt-4.1-mini` default because it stays on the current model family while preserving the cost-conscious default
- `gpt-5.4-mini` leaves `gpt-5.4` and `gpt-5.5` available as explicit overrides when a task needs more reasoning depth

## Runtime Policy

Default precedence:
1. stored desktop provider setting
2. `OPENAI_MODEL` environment override
3. app fallback default: `gpt-5.4-mini`

The app must keep the model editable in provider settings. User/provider choices override the fallback default.

## Escalation Guidance

Stay on `gpt-5.4-mini` for:
- normal app assistant routing
- designer conversation and structured handoff drafting
- display discovery conversation
- eval/simulation runs where cost matters

Escalate to `gpt-5.4` or `gpt-5.5` only when:
- a validation loop repeatedly fails on the mini model
- a full-sequence planning turn requires large, complex reasoning across many artifacts
- the agent must resolve ambiguous conflicts between existing sequence state, user intent, and render feedback
- a release-quality eval shows materially better outcomes from the larger model

Do not silently escalate model size. Escalation should be visible in diagnostics and should remain configurable.

## Image Generation

The designer visual inspiration feature uses the image-generation model separately from the text agent model. The current target for generated inspiration images and themed sequence media is `gpt-image-2`, with prompt/revision/provider metadata recorded in the visual design asset manifest. If provider access blocks `gpt-image-2`, the app may fall back to `gpt-image-1` and must record the actual model used.

## Audit Notes

As of 2026-04-26:
- the active desktop assistant fallback was `gpt-5.4`
- display-discovery simulation default was `gpt-5.4`
- the macOS Settings placeholder still showed stale `gpt-4.1-mini`
- the app-level structure eval runner still defaulted to stale `gpt-4.1-mini`

Those defaults should align on `gpt-5.4-mini` unless a deliberate override is configured.
