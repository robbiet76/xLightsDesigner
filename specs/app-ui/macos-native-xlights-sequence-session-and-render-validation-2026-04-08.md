# Native xLights Sequence Session And Render Validation

Status: Active
Date: 2026-04-08
Owner: xLightsDesigner Team

## Purpose

Define how the native macOS app owns xLights sequence lifecycle orchestration, what remains inside xLights, and how future rendered-output validation fits into the architecture.

This spec closes the current gap where xLights still surfaces save/open prompts that the user must handle manually.

## Product Rule

The native app owns the workflow.

xLights remains the sequence engine and rendering engine, but the native app should directly control the sequence session lifecycle wherever the owned xLights API already supports it.

## Ownership Boundary

### Native app owns

- deciding which sequence should be active for the current workflow
- reading current xLights session state
- opening an existing sequence
- creating a new sequence
- saving the current sequence
- saving after apply
- surfacing sequence-session and save/apply status in the native validation harness
- deciding when sequencing can proceed or is blocked

### xLights owns

- actual sequence document storage engine
- effect/timing persistence implementation
- render/export implementation
- live model/sequence runtime

### Current boundary exception

- closing the active sequence is not yet reliable on the owned API path
- render/export is not yet exposed through a stable owned API path

## Native Sequence Session Contract

The native app should maintain a first-class xLights session read model with:

- runtime state
- supported commands
- whether a sequence is open
- open sequence path
- current revision token
- current media file
- current xLights show directory
- whether the current xLights show matches the active project show
- whether the current open sequence matches the active native workflow expectation

This state must be visible in the native validation harness.

## Save / Apply Policy

### Immediate policy

- after native review/apply succeeds, the native app should save the current xLights sequence automatically
- if save fails, the native app must surface that failure explicitly
- the user should not be left with an unmanaged xLights save prompt after a successful native apply

### Target policy

- render before save
- then save
- then mark the native review/apply flow complete

### Current implementation note

The owned API currently exposes:

- `sequence.getOpen`
- `sequence.getRevision`
- `sequence.getSettings`
- `sequence.open`
- `sequence.create`
- `sequence.save`
- `media.getCurrent`

There is not yet a stable owned render/export endpoint to use as the native pre-save render hook.

## Validation Harness Requirements

The native automation layer must expose xLights session state directly so agent-driven validation does not depend on manual user inspection for intermediate checks.

Required native harness snapshot fields:

- xLights runtime state
- xLights supported commands
- open sequence path
- open sequence revision
- media file
- show directory
- project show match
- whether save/open/create are supported
- last native save/apply result

Required native harness actions:

- refresh xLights session snapshot
- save current xLights sequence

Future actions:

- open sequence
- create sequence
- close sequence
- render current sequence

## Long-Term Render Validation Placeholder

Rendered-output validation is a deliberate future architecture layer, not a speculative idea.

The long-term goal is for the system to inspect what the rendered sequence actually produces so the AI can validate, learn, and improve sequencing quality.

### Placeholder architecture

#### `SequenceSessionService`

Owns xLights sequence lifecycle orchestration and exposes live xLights session state.

#### `RenderValidationService`

Owns render-trigger orchestration and capture bookkeeping.

Initial responsibility:

- request render
- record render artifact path
- record project / sequence / revision / timestamps

It does not need to interpret the render yet.

#### `RenderObservationStore`

Stores:

- rendered output artifact path
- project id
- sequence path
- revision token
- audio track reference
- render timestamp
- render settings snapshot

#### `RenderAssessmentService`

Future layer that compares rendered output against:

- design intent
- sequencing plan expectations
- previous renders

This is where the AI eventually "sees" the output.

## Step 1 Build Scope

Implement now:

- native xLights session service
- native validation harness visibility into xLights session state
- native save-current-sequence action
- save-after-apply behavior on the native review path

Do not implement yet:

- render/export automation
- rendered-output assessment
- close-sequence orchestration on unsupported owned paths

## Why this matters

Without native control of the xLights sequence session:

- the user gets stuck in xLights modal prompts
- the native app cannot reliably validate its own state
- agent-driven testing remains incomplete

With this layer:

- the native app becomes the workflow owner
- xLights becomes the controlled engine beneath it
- future render validation has a clean home in the architecture
