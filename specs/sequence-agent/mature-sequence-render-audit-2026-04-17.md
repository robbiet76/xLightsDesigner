# Mature Sequence Render Audit

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Use mature production sequences as a read-only benchmark for render understanding.

These sequences are allowed to calibrate and audit:
- `render_observation_v1`
- `composition_observation_v1`
- `layering_observation_v1`
- `progression_observation_v1`
- `sequence_critique_v1`

These sequences are not allowed to influence:
- effect-choice priors
- sequencing policy
- stylistic defaults
- imitation of a human sequencer's arrangement decisions

The benchmark question is:
- can the system correctly interpret what was rendered?

The benchmark question is not:
- can the system learn how to sequence like the original author?

## Source Boundary

Read-only source root:
- `/Users/robterry/Documents/Lights/Current/Christmas/Show`

Rules:
- no edits to the production show tree
- no generated artifacts written into the production show tree
- use existing `.fseq` files when present
- render from `.xsq` only when an `.fseq` is missing or a refreshed render is explicitly needed for audit consistency
- stage all derived audit artifacts outside the production show tree

## Pool Definition

Included:
- non-`Static` folders under the show root that contain at least one `.xsq`

Excluded:
- `Static`

Current manifest:
- [mature-sequence-benchmark-manifest-2026-04-17.json](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/reports/mature-sequence-benchmark-manifest-2026-04-17.json)

Current inventory summary:
- candidate sequence folders: `42`
- with existing `.fseq`: `37`
- requires fresh render from `.xsq`: `5`

## Initial Audit Subset

Start with a deliberately varied subset of `12` sequences:
- `Intro_ElectricChristmas`
- `Intro_Magical`
- `CozyLittleChristmas`
- `CarolOfTheBells`
- `ChristmasMedley`
- `HolidayRoad`
- `LittleDrummerBoy_TobyMac`
- `PolarExpress`
- `SleighRide`
- `WeWishYouXmas_Muppets`
- `WinterWonderland`
- `YouMakeItFeelLikeXmas`

Selection goals:
- intro material
- warm low-to-mid energy material
- dramatic material
- denser/high-energy material
- novelty/theatrical material
- a mix of existing `.fseq` availability states weighted toward already-rendered sequences for faster audit startup

## Audit Procedure

For each benchmark sequence:
1. load `.fseq` if present, otherwise render from `.xsq` into an external audit workspace
2. identify representative windows for:
   - opening
   - support/verse
   - peak/chorus
   - transition/breakdown
   - closing
3. derive:
   - `render_observation_v1`
   - `composition_observation_v1`
   - `layering_observation_v1` when proof-supported
   - `progression_observation_v1`
   - `sequence_critique_v1`
4. compare the machine reading to a human reading of the rendered result
5. record mismatches as visualizer gaps, not sequencing-policy gaps

## Evaluation Questions

Use the mature-sequence audit to answer:
- does the render visualizer detect meaningful section development?
- does composition reading track focal distribution and scene contrast?
- does layering reading detect same-structure masking and support failure where present?
- does progression reading detect stagnation, escalation, and handoff quality?
- are the current color and cadence metrics sufficient for real production material?

## Deliverables

The first mature-sequence audit pass should produce:
- one dated audit report per analyzed sequence or a consolidated benchmark report
- an explicit success/failure matrix for:
  - realization understanding
  - composition understanding
  - layering understanding
  - progression understanding
- a prioritized visualizer gap list

## Enforcement Rule

If a mature sequence exposes a render-reading failure, the corrective action is:
- improve render observation or critique

The corrective action is not:
- learn that the sequencer should copy the human author's choices
