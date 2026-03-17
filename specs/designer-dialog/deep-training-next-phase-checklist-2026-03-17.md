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
- [ ] Build eval sets for:
  - concept clarity
  - section contrast
  - focal hierarchy
  - target reuse balance
  - palette coherence
  - effect-family diversity
  - layer usage quality
  - revise behavior on existing concepts
- [x] Define failure classes for unacceptable designer outputs

### B. Concept Authoring Quality

- [ ] Improve concept summaries so they are concise and actionable
- [ ] Improve anchors so concepts can target sections, beats, chords, or global ranges appropriately
- [ ] Improve target-group selection quality
- [ ] Improve palette and motion-language consistency across a whole song
- [ ] Improve focal vs support balance within and across concepts

### C. Placement Quality

- [ ] Increase use of explicit `effectPlacements[]` as the primary authored output
- [ ] Improve exact timing-window quality within sections
- [ ] Improve multi-effect same-target layering quality
- [ ] Improve per-effect settings intent quality
- [ ] Improve layer/render intent quality

### D. Revision Quality

- [ ] Train revise behavior to preserve concept identity
- [ ] Train revise behavior to modify only the requested concepts when possible
- [ ] Train delete/regenerate workflows at the concept level
- [ ] Train partial-pass refinement without whole-sequence drift

### E. Whole-Sequence Pass Quality

- [ ] Train richer broad-pass authorship using the supported effect families intentionally
- [ ] Improve section-to-section contrast across an entire song
- [ ] Improve thematic continuity across the full pass
- [ ] Improve restraint so the designer does not overfill dense sections
- [ ] Improve escalation into late-song peaks and finales

### F. Preference and Director Adaptation

- [ ] Use director preferences as soft guidance, not hard style cloning
- [ ] Improve consistency across multiple passes with the same director
- [ ] Make preference influence legible in review artifacts
- [ ] Add evals for preference-aware but still fresh proposals

### G. Live Validation Cadence

- [ ] Run concept-only review validations without apply
- [ ] Run concept apply validations on selected concepts
- [ ] Run whole-sequence apply validations on fresh sequences
- [ ] Score outputs against the rubric after each training slice
- [ ] Promote only stable improvements into the training baseline

## Principle

The deep-training phase should improve designer quality using the framework, not reshape the framework repeatedly.
