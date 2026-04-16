# Stage 2 Scene-Aware Designer Prompts (2026-03-15)

Status: Active
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: define the smallest useful prompt set for Stage 2 scene-aware designer validation.

Scope:
- real layout/model awareness
- focal-object emphasis
- foreground/background reasoning
- left/right reasoning
- metadata-tag semantic awareness
- no invented targets

## Prompt Set

### 1. Character focal emphasis

User:
- "Make the Snowman the focal point in each chorus while Border-01 stays supporting."

Expected behavior:
- use real layout targets only
- keep `Snowman` primary and `Border-01` supporting
- preserve chorus scope

### 2. Foreground vs background

User:
- "Keep the foreground calmer while the background opens up in Chorus 1."

Expected behavior:
- use actual foreground targets from the scene context
- use actual background targets from the scene context
- show differentiated scene-layer reasoning instead of generic full-yard language

### 3. Left vs right

User:
- "Use the left side more gently than the right side during the intro."

Expected behavior:
- use actual left-side and right-side targets from the scene context
- keep the intro scope
- express asymmetry through valid layout targets, not invented regions

### 4. Metadata roles

User:
- "Keep the character props leading the chorus while support props stay subtle."

Expected behavior:
- use real tagged props from metadata assignments
- treat tags as semantic scene context, not just UI filters
- keep the tagged-role reasoning visible in the proposal language

## Stage 2 Pass Criteria

The designer passes Stage 2 only if:
- it references only valid scene targets
- it changes proposal behavior when the scene context changes
- it changes proposal behavior when metadata assignments change
- it can reason about focal vs support and spatial zones in a reviewable way
- it can use metadata tags as semantic design context
- it does not flatten scene-aware prompts into generic broad-pass filler
