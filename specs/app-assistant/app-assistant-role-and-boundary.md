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

## Sequencing Request Modes
There are two valid ways sequencing work can enter the system:

1. `designer-led sequencing`
- the normal/default path
- user speaks in director or lighting-design terms
- `app_assistant` routes to `designer_dialog`
- `designer_dialog` produces creative artifacts and normalized sequencing intent
- `sequence_agent` turns that intent into a technical xLights plan

2. `direct technical sequencing request`
- supported as a secondary/expert path
- user gives a specific, execution-oriented sequencing ask
- `app_assistant` may route straight to `sequence_agent`
- the request must still be normalized into the same canonical sequencing handoff shape before planning
- this path must not force the request through designer-only proposal scaffolding

Boundary rule:
- direct technical sequencing is allowed
- it is not the preferred primary user workflow long-term
- it exists so specific technical requests can be handled cleanly without requiring the user to wait on `designer_dialog` maturity

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

## Team Chat Identity Model
- The user experience should feel like one team chat, not separate disconnected agent consoles.
- `app_assistant` is the default front door and coordinating presence in that chat.
- When specialist work is delegated, the UI should make the responding specialist visible.
- Canonical specialist identities remain:
  - `audio_analyst`
  - `designer_dialog`
  - `sequence_agent`
- UI presentation may use human-readable display names and optional user-defined nicknames, but canonical runtime role ids must remain unchanged underneath.
- Nicknames are cosmetic and conversational. They must not replace canonical role ids in contracts, artifacts, logs, or routing logic.

## Direct Address And Routing Rules
- The user may address specialists by canonical role, display label, or nickname.
- Direct address is a routing hint, not a hard dispatch command.
- `app_assistant` remains responsible for deciding which specialist should actually handle the request.
- Routing precedence should consider:
  - current workflow state
  - available artifacts and revision state
  - request shape and specificity
  - direct addressee or nickname as an advisory signal
- If the addressed specialist is not the best actual handler, `app_assistant` may route the request elsewhere.
- When routing overrides the named addressee, the UI should make the actual handler visible so the user understands who responded.

## Practical Routing Examples
- `Hey Patch, make the trees less blinky in Chorus 3`
  - may route to `sequence_agent` if there is already a concrete proposal or execution draft
  - may route to `designer_dialog` if the request is still a creative refinement without an execution-ready baseline
- `Rhythm, analyze this song again`
  - should normally route to `audio_analyst`
- `How do I set up my show folder?`
  - should normally remain with `app_assistant` as setup/help

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

### Canonical Sequence Handoff Rule
`sequence_agent` must receive one canonical sequencing handoff shape regardless of origin.

That means:
- `designer_dialog` output may be normalized into `intent_handoff_v1`
- direct technical sequencing requests may also be normalized into `intent_handoff_v1`
- `sequence_agent` must not branch on whether the source was `designer_dialog` or the user directly

`app_assistant` owns routing.
The middle normalization layer owns contract shaping.
`sequence_agent` owns technical realization only.

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
