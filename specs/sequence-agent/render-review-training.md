# Render Review Training

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-05-04

## Purpose

Define the next training method for improving sequencing quality from rendered whole-display output, not just effect apply/render success.

## Direction

The training loop should move from target/effect proof toward section-level render review. A useful training record must preserve:

1. the intended creative and musical objective
2. the generated sequencing plan
3. the rendered whole-display evidence
4. deterministic temporal and visual metrics
5. artistic critique against the objective
6. the revision recommendation
7. the accepted or rejected outcome

The preferred review input is a short section video. If xLights cannot export video directly, the app may export or reconstruct ordered sampled frames and assemble a review clip with `ffmpeg`. Frame contact sheets are useful for diagnostics, but the primary review contract is temporal because sequencing quality depends on pacing, transitions, motion, musical alignment, and display evolution over time.

## Evidence Inputs

Render review may use these inputs:

- rendered section video
- ordered sampled frame images
- contact sheet generated from sampled frames
- deterministic frame metrics
- current sequence context and applied plan
- music section, beat, phrase, lyric, and energy context
- design intent and target hierarchy from Designer handoff

Raw video and full frames are local/generated artifacts. Durable training promotion should use compact review summaries and evidence references.

## Deterministic Metrics

The first evaluator should calculate metrics that do not require a vision model:

- sampled frame count and duration
- active coverage over time
- average and peak brightness
- dominant brightness / overexposure risk
- color diversity and palette drift
- temporal motion and color deltas
- balance and display-region occupancy when geometry is available
- blank-span risk
- clutter risk from too much simultaneous activity
- flatness risk from too little temporal change
- transition strength at section boundaries

These metrics should not be treated as final creative judgment. They are signals that make vision review and agent critique more grounded.

## Vision Review

Vision review should analyze a section video or ordered frame strip and score:

- `intentMatch`: does the result match the declared creative objective
- `musicalFit`: does motion and energy follow the song section
- `visualReadability`: can the viewer understand the main idea quickly
- `targetHierarchy`: do lead, support, accent, and background targets read correctly
- `compositionBalance`: does the whole display feel balanced for the section
- `colorDiscipline`: does the rendered palette match the intended palette
- `motionCoherence`: does motion feel purposeful rather than random
- `transitionQuality`: do entries, exits, and section changes land cleanly
- `clutterRisk`: are too many unrelated ideas active at once
- `revisionValue`: whether revision is likely to improve the section

The vision output must include a short rationale and concrete revision recommendations. It should not overwrite deterministic metrics or project-local evidence.

## Artifact Contract

`render_review_v1` is the compact section-level review artifact.

Required top-level fields:

- `artifactType`: `render_review_v1`
- `artifactVersion`: `1.0`
- `createdAt`
- `section`: id, label, start/end milliseconds
- `intent`: compact creative objective, music role, target hierarchy, palette intent
- `evidence`: local refs to rendered video, frame directory, contact sheet, source sequence, and render observation
- `deterministicMetrics`: normalized temporal and visual metrics
- `qualityScores`: 0-1 scores for intent, music, readability, hierarchy, composition, color, motion, transition, clutter, and overall quality
- `critique`: strengths, issues, revision recommendations, and decision
- `promotion`: whether this review is eligible for training promotion and blockers

Promotion requires repeated evidence across compatible sections or targets. One attractive render is not enough to promote a generalized training rule.

`video_aesthetic_score_v1` is the compact display-level review artifact produced
after the full-sequence review loop. It does not keep raw media. It reads the
ordered section reviews plus `progression_observation_v1` and scores the larger
sequence slice for display evolution, pacing variety, transition flow, focal
clarity, visual balance, motion interest, color discipline, clutter control, and
quality consistency. This is the first contract for measuring whether the whole
sequence is getting better rather than only whether each effect rendered.

The current scorer identifies itself as
`scoringModelVersion: video_aesthetic_score_model_v2`. It still scores the
controller-selected candidate pass when one is present, but it also keeps a
full-display context layer over all eligible windows. That context layer adds
narrative shape, focal handoff stability, palette purpose coverage, and
full-sequence context dimensions so a candidate cannot be judged only by its own
render quality when the surrounding display arc is weak.

`video_aesthetic_attempt_comparison_v1` compares the current video aesthetic
score against the previous loop's score. It records overall and per-dimension
deltas, classifies the attempt as `improved`, `neutral`, `regressed`, or
`blocked`, and keeps enough compact evidence for the controller to avoid
repeating revision patterns that did not help.

`creative_intent_revision_comparison_v1` compares paired creative-intent passes.
The baseline pair remains `intent_first_draft` to `intent_targeted_revision`.
The richer variant set adds `focus_simplification`,
`focal_handoff_stability`, and `pacing_balance` revision variants. These are
scored as targeted objectives so a revision can be accepted for improving the
specific v2 weakness it was built to address, while still guarding readability,
motion coherence, coverage, and clutter.

## Loop Integration

The self-improvement loop should add a render-review phase after live apply/render:

1. Generate a candidate section from intent.
2. Apply and render through the owned xLights API.
3. Capture section video or ordered frames.
4. Build deterministic metrics.
5. Run vision review when available.
6. Compare against the original intent.
7. Generate a revision if the review identifies fixable issues.
8. Re-render and compare before/after.
9. Store accepted improvements as project-local evidence.
10. Promote only compact repeated patterns.

## Current Implementation Path

1. Deterministic `render_review_v1` artifacts can be built from sampled frame metrics.
2. The self-improvement cycle can run manifest-defined `render_review` phases and summarize accept/revise/reject decisions.
3. `ffmpeg`-based media extraction can produce sampled frame metrics, ordered frame images, and contact sheets for rendered section windows.
4. The self-improvement cycle can extract review media automatically when a `render_review` manifest entry points at a media file instead of a prebuilt frame-features artifact.
5. Reconstructed `preview_scene_window_v1` artifacts can be rasterized into reviewable media, bridging xLights FSEQ render output into the same media-analysis path.
6. FSEQ render review can run as a single command from geometry + FSEQ + section window to preview media, frame metrics, contact sheet, and `render_review_v1`.
7. The self-improvement loop can run `fseq_render_review` phases that reconstruct and review one or more rendered `.fseq` files from a manifest.
8. Render-review phases produce a dedicated render-review gate; `revise` and `reject` outcomes block promotion and become revision-loop input.
9. Render-review revision objectives can be generated from `revise` and `reject` artifacts, turning metrics and critique into concrete coverage/readability/motion actions.
10. Wire live xLights render jobs directly into FSEQ-backed render-review phases.
11. Attach richer section intent and music context to generated review artifacts.
12. Add vision review as an optional second-pass evaluator.
13. Use review decisions to drive revision loops before promotion.
14. Build `video_aesthetic_score_v1` after full-sequence review so unattended
    runs retain compact whole-display quality evidence.
15. Build `video_aesthetic_attempt_comparison_v1` after scoring when a previous
    run root exists so the loop can learn whether a display-level attempt helped.
