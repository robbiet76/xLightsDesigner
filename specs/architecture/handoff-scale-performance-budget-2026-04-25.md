# Handoff Scale and Performance Budget (2026-04-25)

Status: Active Guidance
Date: 2026-04-25
Owner: xLightsDesigner Team

## Purpose

Define how xLightsDesigner handoffs should scale from local validation sequences to full production sequences without turning agent artifacts into oversized sequence dumps.

This guidance applies to agent handoffs, plan artifacts, automation validation, and future cloud-backed agent orchestration.

## User Context

User concern captured during development:

> how much can be passed in a handoff? Will we able to scale to full sequences? We should make sure we are considering performance i our architecture if that is a concern

Follow-up agreement:

> agree. Let's make sure we consider this going forward.

## Principle

Handoffs should carry structured planning intent, compact operational instructions, and artifact references. They should not carry fully expanded sequence state.

Acceptable handoff payloads:

- section windows and timing-track summaries
- cue marks needed for sequencing decisions
- target scope and app metadata summaries
- design intent, behavior targets, and sequencing directives
- sparse effect placements and xLights command graphs
- references to full artifacts stored in the app project or backend artifact store

Payloads to avoid:

- rendered frame grids
- fully expanded model-cell data
- full xLights XML snapshots
- repeated full copies of the same upstream artifact in every downstream artifact
- unbounded readback payloads when a summary or filtered validation slice is enough

## Scaling Target

Full-sequence generation should scale through chunking and references:

- plan section-by-section, pass-by-pass, or cue-track-by-cue-track
- keep each sequencing pass reviewable and recoverable
- persist large artifacts once, then pass artifact ids and compact summaries
- load only the timing, target, and prior-pass slices needed for the current decision

The local app can store larger artifacts than the cloud model context should receive. Cloud-bound requests should use summaries, refs, retrieval slices, and explicit budgets.

## Current Guardrail

`plan_handoff_v1.metadata.handoffScale` records lightweight size telemetry:

- command count
- approximate command JSON bytes
- effect command count
- timing command count
- timing mark count
- approximate metadata JSON bytes
- embedded execution strategy, design handoff, realization candidate, candidate selection, and metadata assignment sizes

This is diagnostic telemetry, not a hard gate. It should be used to spot growth before large-sequence workflows become slow or expensive.

`plan_handoff_v1.metadata.artifactRefs` and `plan_handoff_v1.metadata.generativeSummary` provide the compact path for consumers that only need ids, counts, selected candidate state, retry signals, revision deltas, and feedback summaries. Existing embedded objects remain available during migration, but new UI and validation consumers should prefer the compact summary when the full artifact is not needed.

History entry construction should also prefer these compact fields when building snapshot summaries and artifact refs. History needs stable audit summaries, not full candidate or revision artifacts, unless the user opens a detailed artifact view.

Runtime code that needs prior revision state may synthesize minimal `revision_retry_pressure_v1` and `revision_feedback_v1` objects from `metadata.generativeSummary` when expanded artifacts are not embedded. Expanded artifacts remain preferred when present.

`plan_handoff_v1.metadata.passExecution` records the sequencing pass policy:

- iteration is pass-based, not one-effect-at-a-time
- the sequencer should plan the full intended scope before apply
- Review should apply the command graph as a batch
- render should normally happen once after the batch apply
- additional renders are for clear failure/revision cases
- existing sequence content should be inspected and preserved unless the request scope authorizes replacement
- a pass is not final until structural validation, practical validation, render feedback, and user acceptance are satisfied

The agent may mark a pass stable against known checks, but user acceptance remains the final product-level completion signal.

`current_sequence_context_v1` is the compact existing-sequence inspection artifact for revision planning. It carries bounded timing track names/counts, effect names/counts, target ids, display/model order, layer summaries, sequence revision, and scoped effect samples so the sequencer can reason about current xLights state without passing a full sequence document through every handoff. Proposal generation, review apply, and native review apply build this artifact from xLights readback before planning. `plan_handoff_v1.metadata.currentSequenceContext` stores the sanitized version, which keeps placement fields such as effect id, target id, layer index, time window, timing-track anchor, and display order while dropping large settings/palette payloads. `metadata.artifactRefs.currentSequenceContextRef` gives compact consumers a stable pointer.

When the expanded current-sequence context includes sampled existing effects, the sequence planner preserves overlapping same-target effects unless the request explicitly uses replacement language such as replace, overwrite, clear, remove, delete, redo, or rebuild. Preservation does not mean the planner must avoid overlap. Additive layered looks are valid creative decisions: for example, an existing spiral on layer 0 can remain while a new counter-moving spiral with a different color is added on layer 1 to create a composite look.

The default preservation move is to place new effect writes on the next open layer when an existing same-target effect already occupies the scoped window. Explicit replacement authorizes same-layer reuse inside the scoped window. Each created effect records `intent.existingSequencePolicy` with overlap counts, replacement authorization, original layer, and planned layer so Review can audit whether the command graph chose additive layering or authorized same-layer replacement.

Layered output is an editable realized effect, not a special preservation exception. The observed result may be changed by adding a layer, deleting a layer, changing any layer's effect/settings/palette/timing, moving an effect horizontally in time, moving it vertically in the layer stack, or changing display/model order. Plan handoffs should treat `layerIndex`, effect time window, target/model order, and display-element order as first-class sequencing placement fields because each one can change rendered output.

As of 2026-04-25, native review apply can execute mixed owned API plans by compressing timing/effect-create commands into `sequencing.applyBatchPlan` and then applying explicit display-order and effect/layer edit commands through direct owned API calls. This keeps create-heavy plans efficient while allowing `effects.update`, `effects.delete`, `effects.deleteLayer`, `effects.reorderLayer`, `effects.compactLayers`, and `sequencer.setDisplayElementOrder` to remain first-class command-graph operations.

## Future Work

- Replace large embedded downstream objects with artifact refs plus compact summaries where practical.
- Add warning thresholds once realistic full-sequence baselines exist.
- Track handoff size in native validation evidence for large sequence scenarios.
- Add section/pass chunking for full-song generation and revision.
- Expand full-sequence effect readback coverage once the owned API supports efficient all-target effect summaries without target-by-target queries.
- Add explicit retry/pass budgets so automatic iteration stops after bounded attempts and returns to user review.
- Keep validation selective: verify anchors, tracks, scope, target coverage, and practical quality without loading full expanded sequence state unless needed.
