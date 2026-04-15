# Effect Training Reference File v1

Status: Active  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Define the canonical per-effect training file that the sequencer should reference after the full regeneration rerun.

This file is the main human-inspectable and machine-consumable training surface for one effect.
It replaces umbrella documentation as the primary place to inspect what the sequencer has learned about that effect.

## Core Principle

After the full rerun, training understanding must be inspectable effect by effect.

The canonical question should be:

- what does the sequencer know about `this` effect?

not:

- where in a large umbrella artifact do we find fragments about this effect?

## Canonical Shape

One canonical file per effect.

Examples:

- `bars.json`
- `on.json`
- `shockwave.json`
- `twinkle.json`

These files must live under one generated directory emitted by the unattended regeneration cycle.

## Required Content

Each per-effect file must include all of the following.

### 1. Effect Capability

What behaviors the effect can produce.

Required coverage:

- behavior clusters
- parameter-region-conditioned behavior
- geometry-conditioned behavior
- confidence and evidence counts

### 2. Full Parameter Semantics

For every meaningful parameter:

- parameter name
- semantic axis
- affected behavior signals
- value regions
- observed directionality
- geometry sensitivity
- evidence counts
- confidence

### 3. Additive Interaction Semantics

For all meaningful interactions:

- parameter + parameter interactions
- parameter + shared-setting interactions
- parameter + palette-context interactions when relevant

The file must state:

- reinforcing interactions
- masking interactions
- threshold interactions
- saturating interactions
- independent interactions

### 4. Shared-Setting Semantics

For shared controls that materially change the read:

- transitions
- layer method
- layer mix
- buffer style
- palette behavior
- other cross-effect settings that change interpretation

### 5. Geometry-Conditioned Rendering

How the same effect and setting regions read on different geometries.

This must describe:

- what changes in the rendered read
- where the effect becomes clearer or weaker
- where geometry amplifies interaction behavior

This must not become:

- model-use doctrine

### 6. Language Mapping

How design language maps to behavior and control surfaces for this effect.

Examples:

- `soft`
- `dense`
- `crisp`
- `restrained`
- `diffuse`
- `segmented`

This mapping must point to:

- behavior targets
- parameter regions
- shared settings

not:

- fixed use-case doctrine

### 7. Evidence And Traceability

Each file must include:

- source manifest ids
- source record ids
- geometry coverage summary
- interaction coverage summary
- evidence counts
- confidence summary
- known gaps

## What Must Not Appear

The per-effect file must not encode:

- best prop for this effect
- effect belongs on model X
- effect belongs in section Y
- genre doctrine
- prompt-to-effect shortcut claims
- director taste rules

## Relationship To Other Artifacts

After the full rerun:

- per-effect files are the canonical training reference
- aggregate reports are supporting views only
- umbrella summaries may exist for planning or coverage, but they are not the primary training reference surface

## Acceptance Requirement

The full regeneration rerun is not complete until it emits:

- one canonical per-effect training file for every active effect in scope
- one index file over that directory
- one consolidated regeneration report

## Current Transitional Note

The current dossier export is a temporary inspection surface only.
It is not the final canonical reference until it is rebuilt from the new record generators and the full rerun completes.
