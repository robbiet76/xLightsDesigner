# Render Visualizer Gap Audit

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Lock the project onto the correct validation path:

- translation intent should be evaluated against rendered truth
- rendered truth should be described through machine-observable metrics
- scoring should happen at the realization level, not the effect-family level

This spec exists because the current render visualizer is useful, but still incomplete.
If setting-level meaning is still guessed instead of observed, the translation layer will drift into heuristics and repetition.

## Governing Decision

The render visualizer is not trying to simulate human vision.

It is trying to produce a machine-usable observation layer that is:

- stable
- discriminative
- geometry-conditioned
- compositional
- cheap enough to run repeatedly in training and sequence validation

That is the correct target.

## Non-Negotiable Rules

### 1. No Effect-Level Scoring

The visualizer must not be used to conclude:

- effect `X` is the best answer
- effect `Y` is inherently calm or aggressive
- effect `Z` should always win for a given prompt

The visualizer should support conclusions about realized settings combinations:

- effect family
- effect settings
- shared settings
- palette
- layering
- geometry context

That full realized configuration is the thing being observed and later scored.

### 2. Rendered Observation Is The Evidence Layer

If a setting-level claim cannot be defended from rendered observation, it is not yet reliable project knowledge.

That applies to:

- parameter semantics
- behavior capability
- realization ranking
- sequence critique
- translation-layer validation

### 3. Metrics Are Acceptable If They Separate Meaningful Outcomes

The visualizer does not need human-like vision.

It does need metrics that can reliably distinguish:

- different motion reads
- different texture reads
- different coverage or hierarchy reads
- different color behaviors
- different section-level artistic outcomes

## Current Visualizer Architecture

The current path is:

1. decode an FSEQ render window into per-frame node and channel data
2. build aggregate and frame-level observations
3. run geometry-specific analyzers to produce behavior summaries and pattern families

Current code surfaces:

- decoder:
  - [fseq_window_decoder.cpp](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/fseq_window_decoder.cpp)
- observation extraction:
  - [extract-render-observation.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/extract-render-observation.py)
- analyzer dispatch:
  - [analyze_decoded_window.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/analysis/analyze_decoded_window.py)
- geometry and effect analyzers:
  - [framework.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/analysis/framework.py)

## What The Visualizer Currently Sees

It currently sees structured render metrics, not semantic images.

### Decoder-Level Signals

The decoder already exposes:

- per-frame active node masks
- per-frame node brightness
- per-frame node RGB values
- average node brightness
- active node ratio
- centroid position
- centroid motion mean and max
- centroid direction reversals
- run count
- longest run ratio
- temporal change mean and max

These are real rendered signals, not synthetic labels.

### Observation-Level Signals

The observation extractor already derives:

- active model ratio
- scene spread ratio
- weighted scene centroid
- region distribution
- density bucket
- model contribution shares
- lead model share
- opening, middle, and closing summaries

### Analyzer-Level Outputs

The analyzers already emit:

- `patternFamily`
- coarse quality summaries
- geometry-conditioned behavior labels
- some coarse color-role conclusions
- effect-specific behavior interpretations

## What The Visualizer Does Not Yet See Well Enough

This is the current gap set.

### 1. Color Dynamics

Current state:

- can see node RGB values
- can compute coarse dominant color role

Missing:

- palette spread across time
- color contrast strength
- mono vs multicolor dominance over time
- region-local color distribution
- color cycling behavior
- color stability vs color churn

Why it matters:

- translation-layer validation cannot claim warm, cool, colorful, or restrained reads reliably without stronger color metrics
- palette behavior must be validated at the realization level

### 2. Temporal Structure

Current state:

- can see aggregate temporal change
- can see centroid movement

Missing:

- cadence and pulse interval detection
- burst onset detection
- hold vs drift vs sweep segmentation over time
- periodicity or loop character
- transition sharpness
- hit-then-decay shape detection

Why it matters:

- motion intent is one of the main translation-layer axes
- section validation will fail if timing character is still reduced to coarse motion averages

### 3. Spatial Structure

Current state:

- can see centroid, spread, density, contiguity, and region occupancy

Missing:

- symmetry
- stripe or band repetition
- edge-weighted vs center-weighted energy
- multi-cluster structure
- lobe count or arm count style metrics where geometry supports it
- directional concentration by region over time

Why it matters:

- many settings changes are spatial rather than purely temporal
- the system must separate broad wash, banded structure, segmented structure, centered focus, and edge emphasis

### 4. Hierarchy And Role

Current state:

- can estimate lead model share and overall spread

Missing:

- foreground vs background separation quality
- support texture vs focal texture distinction
- focus stability over time
- moving focus vs stable focus
- dominance balance across targets

Why it matters:

- sequence-level translation depends on lead, support, and background roles
- render validation needs better compositional signals than generic density and spread

### 5. Sequence-Read Readiness

Current state:

- mostly single-realization metrics

Missing:

- novelty over time
- adjacent-section contrast
- pacing variety
- repeated motion-texture reuse
- repeated palette behavior reuse

Why it matters:

- sequence-level critique must evaluate development, not just isolated render correctness

## Current Strengths

The current system is already good enough to support:

- first-pass effect and setting breadth validation
- geometry-conditioned pattern-family classification
- collapse detection
- reanalysis after analyzer improvements
- training-driven medium learning

That is why the stage1 work has been productive.

The current system is not useless.
It is incomplete.

## Approved Direction

The project will continue to build the visualizer as a metric-driven observation system.

It will not pivot to:

- effect-family doctrine
- prompt-to-effect shortcut tables
- effect-level scoring
- human-vision imitation as the primary architecture

## Upgrade Priorities

Implementation priority order:

1. color dynamics
2. temporal cadence and transition structure
3. spatial structure
4. hierarchy and role metrics
5. sequence-level contrast and novelty metrics

## Acceptance Standard For New Metrics

A new render metric is worth keeping only if it:

- is derived from rendered truth
- improves separation between meaningfully different realizations
- remains stable across reruns
- is understandable enough to use in critique and validation
- helps sequence-level validation later

If a metric does not help distinguish meaningful realized behavior, it should not be added just to make the system look more sophisticated.

## Immediate Next Step

The next visualizer implementation pass should:

1. add richer color metrics from `nodeRgb`
2. add cadence and periodicity features from sampled frame series
3. add stronger spatial-structure metrics from `nodeActive` and region occupancy
4. emit those as explicit observation fields before they are used in analyzer heuristics

Rule:

- observation features should be added before semantic claims are expanded
- the evidence layer should improve first
- the translation layer should build on top of that stronger evidence
