# Layering Gap Audit

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team

## Purpose

Record the neutral-language correction pass for `layering_observation_v1`.

## Initial Problem

The first layering artifact was structurally sound, but its public surface still encoded a default same-structure hierarchy model.

Main issues:

- element refs used `lead` / `support` role hints by default
- masking fields centered on `dominanceConflict` / `supportObscuration`
- critique language assumed one layer should naturally dominate the others

That was too prescriptive for the project direction.

## Correction

The layering layer now exposes neutral same-structure fields alongside the compatibility names.

New preferred fields:

- `attentionCompetition`
- `elementObscuration`
- `frontLayerLoss`
- `colorReinforcement`
- `colorConflict`
- `colorRoleLoss`

Element refs now prefer neutral role hints such as:

- `primary`
- `secondary`

Compatibility fields retained:

- `dominanceConflict`
- `supportObscuration`
- `foregroundLoss`
- `paletteReinforcement`
- `paletteConflict`
- `dominantRoleLoss`

## Critique Correction

`extract-sequence-critique.py` now reads the neutral layering fields first and falls back to compatibility names only when necessary.

This keeps the critique focused on:

- same-structure separation
- obscuration
- cadence clash
- color conflict

rather than on a presumed lead/support stack.

## What Is Better

1. same-structure layering is described more neutrally
2. critique no longer assumes one layer must always read as the lead
3. same-target masking language now focuses on obscuration rather than role doctrine
4. compatibility with existing pipeline consumers is preserved

## Remaining Gaps

The layering layer is still early.

Remaining gaps:

1. production benchmarking of same-structure layering is still limited
2. handoff and ownership-derived proofs need more real-sequence coverage
3. layering judgment is still not intent-conditioned
4. some downstream specs and tests still use older lead/support language outside the layering artifact itself

## Next Direction

The next layering improvements should stay on the same path:

1. keep the measurements compact and structural
2. avoid treating dominance as universally desirable
3. evaluate same-structure behavior relative to intent later, not inside the observation artifact
4. benchmark more real xLights layering cases before expanding the metric surface
