# App Assistant Role And Boundary

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-12

## Purpose
Define the top-level conversational assistant that the user experiences across the entire product.

`app_assistant` is the unified chat shell for xLightsDesigner. It is responsible for understanding user intent anywhere in the app, guiding the user through setup and workflow transitions, and routing specialized work to domain agents.

## Core Role
`app_assistant` owns:
- the primary chat experience
- app-wide conversational context and continuity
- project setup guidance
- media and metadata guidance
- audio-analysis initiation and explanation
- designer kickoff, refinement, and conversational handoff
- sequence review/revise/apply workflow coordination
- bounded app-level action assistance when the requested action is clearly within an owned workflow

`app_assistant` does not replace specialist agents. It coordinates them.

## Specialist Delegation Model
- `audio_analyst`
  - owns media analysis only
  - produces `analysis_artifact_v1` and `analysis_handoff_v1`
- `designer_dialog`
  - owns creative design conversation specialization
  - produces `creative_brief_v1`, `proposal_bundle_v1`, and `intent_handoff_v1`
- `sequence_agent`
  - owns technical xLights sequencing plans and apply behavior

## Boundary Rules
- `app_assistant` is the only role that should present as the unified chat companion across the whole app.
- `designer_dialog` is a specialist invoked when the conversation is primarily about creative design intent, design refinement, or proposal shaping.
- `audio_analyst` is a specialist invoked when the conversation is primarily about media analysis or analysis artifact refresh.
- `sequence_agent` is a specialist invoked when the conversation is primarily about sequencing realization, review, revise, or apply.
- `app_assistant` may answer direct product questions itself when no specialist invocation is needed.

## Conversation Model
- The user experience should feel like one continuous conversation.
- The conversation may include practical setup questions, emotional or image-driven design inspiration, technical sequencing questions, and requests for action.
- `app_assistant` must preserve context across those modes and route work without forcing the user to switch personas manually.

## Structured Output Model
Conversation may remain open-ended, but specialist work must still terminate in explicit structured outputs.

Required specialist artifacts remain:
- `analysis_artifact_v1`
- `analysis_handoff_v1`
- `creative_brief_v1`
- `proposal_bundle_v1`
- `intent_handoff_v1`
- sequence-agent plan/apply result contracts

`app_assistant` may maintain its own conversation/session state, but it must not bypass structured artifacts for downstream specialist work.

## Preference And Memory Model
- `app_assistant` should maintain broad conversational continuity and user-facing preference memory.
- `designer_dialog` should maintain and consume director-style design preferences as soft guidance.
- Preference memory must inform conversation and proposal quality without forcing hard stylistic cloning.

## Non-Goals For v1
- hidden autonomous apply without explicit user approval
- replacing specialist agent contracts with free-form text handoffs
- turning `designer_dialog` into the entire app shell
- collapsing app setup, analysis, design, and sequencing into one undifferentiated runtime module

## Practical Consequence
The product should present one chat, but the repo and runtime should remain specialist-oriented under that shell.
