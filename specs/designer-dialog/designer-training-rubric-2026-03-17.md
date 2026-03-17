# Designer Training Rubric

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: define the evaluation rubric for the deep training phase so quality can be judged consistently without changing framework assumptions.

## Scoring Scale

Use a 0-3 scale for each category:
- `0`: unacceptable
- `1`: weak
- `2`: acceptable
- `3`: strong

## Concept-Quality Rubric

### 1. Concept Clarity

Question:
- can a human understand what the concept is trying to do without reading raw effect rows?

Strong signals:
- concise intent summary
- clear anchor
- clear focus targets
- concept sounds purposeful, not generic

Failure examples:
- vague summary
- no clear focal intent
- concept reads like raw sequencing text

### 2. Anchor Quality

Question:
- is the concept anchored to the right musical/timing reference?

Strong signals:
- section, beat, chord, or global anchor is appropriate to the request
- anchor is neither over-broad nor overly fragmented

Failure examples:
- all concepts forced to section rows when beat/chord anchoring is needed
- anchor choice fights the requested behavior

### 3. Target Coherence

Question:
- do the selected focus targets make sense for the concept?

Strong signals:
- focal targets are obvious and believable
- support targets do not overwhelm the concept
- target reuse feels intentional

Failure examples:
- arbitrary target spread
- one concept tries to touch too much of the show without purpose
- focal and support roles are muddled

### 4. Palette Coherence

Question:
- does the concept use a readable and intentional color direction?

Strong signals:
- palette supports the concept mood
- accent usage is restrained and clear
- colors fit the section role and broader pass

Failure examples:
- palette feels random
- too many unrelated colors
- no meaningful palette direction captured

### 5. Effect-Family Choice

Question:
- are effect families appropriate for the concept role?

Strong signals:
- effect family matches section energy and target type
- family choice contributes contrast across the song
- family choice is not repetitive without reason

Failure examples:
- overuse of the same family
- families chosen mechanically rather than musically
- effects that clash with the concept intent

### 6. Layering Intent

Question:
- does the concept describe believable focal/support layering?

Strong signals:
- layer roles are purposeful
- multiple effects on one target feel like an intentional stack
- overlays are used selectively

Failure examples:
- no clear layering intent
- every concept sits on one layer with no distinction
- unnecessary layer complexity

## Whole-Sequence Pass Rubric

### 1. Section Contrast
- does the pass create meaningful contrast across sections?

### 2. Focal Hierarchy
- is there a readable lead/support hierarchy across the song?

### 3. Target Reuse Balance
- are important targets revisited intentionally without feeling repetitive?

### 4. Palette Continuity
- does the song feel like one coherent design language rather than disconnected scenes?

### 5. Escalation and Restraint
- does the pass hold back early enough and escalate late enough?

### 6. Family Diversity
- does the pass use more than a trivial family set where musically appropriate?

### 7. Placement Plausibility
- do exact windows/layers feel musically and visually plausible?

## Failure Classes

Mark a sample as failed even if some category scores are acceptable when any of these occur:
- concept identity drift: a revise request creates a new concept instead of revising the existing one
- concept scope drift: revising one concept materially rewrites unrelated concepts
- anchor failure: concept uses the wrong timing reference system
- focal collapse: no clear focal hierarchy remains
- palette incoherence: no legible color direction
- repetitive flattening: whole pass collapses to a trivial repeated family pattern
- sequencing leakage: concept summaries become raw sequence-command mirrors

## Promotion Rule

A training slice should only be promoted when:
- no hard failure classes appear in the eval set
- concept-quality scores are at least acceptable on the core set
- whole-sequence pass scores are at least acceptable on the broad-pass set
