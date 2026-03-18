# Deep Training Next-Phase Checklist

Status: Planned
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: define the next phase once the pre-training framework checklist is complete. This phase is focused on improving designer quality, not changing the underlying workflow model.

## Exit Criteria

By the end of the deep-training phase:
- the designer can produce high-quality concept groups for broad sequence work
- concept revisions are common and clean
- whole-sequence passes are materially useful without heavy manual repair
- the evaluation rubric can distinguish good, mediocre, and poor designer behavior consistently

## Checklist

### A. Training Rubric and Eval Set

- [x] Finalize concept-quality rubric
- [x] Finalize whole-sequence pass rubric
- [x] Build eval sets for:
  - concept clarity
  - prop understanding from xLights source data and metadata tags
  - setting/layout awareness
  - musical understanding beyond section labels
  - stage-lighting reasoning
  - composition reasoning
  - section contrast
  - focal hierarchy
  - target reuse balance
  - palette coherence
  - effect-family diversity
  - layer usage quality
  - revise behavior on existing concepts
- [x] Define failure classes for unacceptable designer outputs
- [x] Add comparative quality evals that distinguish stronger outputs from flatter but still valid alternatives
- [x] Broaden the eval corpus across alternate layout and song-arc fixtures so the baseline is not tied to one synthetic scene

### B. Concept Authoring Quality

- [x] Improve concept summaries so they are concise and actionable
- [x] Improve anchors so concepts can target sections, beats, chords, or global ranges appropriately
- [x] Improve target-group selection quality
- [x] Improve use of xLights source structure and metadata tags in concept selection
- [x] Improve user-guided metadata capture so tag refinement can affect later concepts
- [x] Improve setting/layout-aware concept selection based on prop position and visibility
- [x] Add layout-weighted impact awareness using node count and spatial footprint
- [x] Improve palette and motion-language consistency across a whole song
- [x] Improve focal vs support balance within and across concepts
- [x] Improve the designer's use of stage-lighting concepts where they materially improve sequencing choices
- [x] Improve the designer's use of composition principles where they materially improve sequencing choices

### C. Placement Quality

- [x] Increase use of explicit `effectPlacements[]` as the primary authored output
- [x] Improve exact timing-window quality within sections
- [x] Improve timing-window quality from beat, chord, phrase, and transition cues when section labels are insufficient
- [x] Improve multi-effect same-target layering quality
- [x] Improve per-effect settings intent quality
- [x] Improve layer/render intent quality

### D. Revision Quality

- [x] Train revise behavior to preserve concept identity
- [x] Automate offline scoring for revise-existing-concept eval cases through the app revision path
- [x] Train revise behavior to modify only the requested concepts when possible
- [x] Train delete/regenerate workflows at the concept level
- [x] Train partial-pass refinement without whole-sequence drift

### E. Whole-Sequence Pass Quality

- [x] Train richer broad-pass authorship using the supported effect families intentionally
- [x] Improve section-to-section contrast across an entire song
- [x] Improve thematic continuity across the full pass
- [x] Improve restraint so the designer does not overfill dense sections
- [x] Add target-impact balance awareness so focal moments use enough visual weight without saturating the layout
- [x] Improve escalation into late-song peaks and finales
- [x] Improve translation from musical structure into whole-song pacing and contrast

### F. Preference and Director Adaptation

- [x] Use director preferences as soft guidance, not hard style cloning
- [x] Improve consistency across multiple passes with the same director
- [x] Make preference influence legible in review artifacts
- [x] Add evals for preference-aware but still fresh proposals

### G. Knowledge and Context Inputs

- [x] Verify metadata tags needed for design reasoning are available from xLights source data or user dialog capture
- [x] Identify gaps where the app needs better musical-analysis outputs for training and eval
- [x] Identify which stage-lighting terms are allowed vocabulary versus unsupported stylistic noise
- [x] Identify which composition principles should be actively evaluated versus treated as optional language

### H. Live Validation Cadence

- [x] Run concept-only review validations without apply
- [x] Run concept apply validations on selected concepts
- [x] Run whole-sequence apply validations on fresh sequences
- [x] Run live comparative concept validations where a stronger scoped prompt must outrank a flatter or drifted alternative
- [x] Score outputs against the rubric after each training slice
- [x] Promote only stable improvements into the training baseline

## Principle

The deep-training phase should improve designer quality using the framework, not reshape the framework repeatedly.
