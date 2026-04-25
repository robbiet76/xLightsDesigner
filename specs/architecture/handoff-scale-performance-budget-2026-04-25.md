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

## Future Work

- Replace large embedded downstream objects with artifact refs plus compact summaries where practical.
- Add warning thresholds once realistic full-sequence baselines exist.
- Track handoff size in native validation evidence for large sequence scenarios.
- Add section/pass chunking for full-song generation and revision.
- Keep validation selective: verify anchors, tracks, scope, target coverage, and practical quality without loading full expanded sequence state unless needed.
