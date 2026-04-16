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

Operational meaning:
- `0`: wrong enough that the sample should not be promoted without direct correction
- `1`: partially usable, but still requires obvious repair or leaves the wrong impression
- `2`: good enough to keep moving without changing framework assumptions
- `3`: strong enough to serve as a positive training reference

## General Evaluation Rules

- score concept samples and whole-sequence samples separately
- use the same frozen handoff contract for all samples in one training slice
- record both category scores and hard-failure classes
- do not promote a slice based on average score alone if a hard-failure class appears

Core gating rule:
- a sample fails if any hard-failure class is present
- a concept sample is promotable only when all core concept categories score at least `2`
- a whole-sequence sample is promotable only when all core whole-pass categories score at least `2`

Core concept categories:
- Concept Clarity
- Anchor Quality
- Target Coherence
- Palette Coherence
- Effect-Family Choice

Core whole-pass categories:
- Section Contrast
- Focal Hierarchy
- Target Reuse Balance
- Palette Continuity
- Escalation and Restraint

Cross-cutting evaluation lenses:
- Prop Understanding
- Setting and Layout Awareness
- Musical Understanding
- Stage Lighting Reasoning
- Composition Reasoning

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

### 7. Design/Sequence Boundary Quality

Question:
- does the concept remain conceptual instead of leaking into raw sequence-command detail?

Strong signals:
- summary stays readable in Design and Review
- concept can be understood without reading exact effect rows
- technical detail remains on the Sequence page

Failure examples:
- concept summary is basically raw sequencing text
- concept identity is replaced by command-like implementation notes
- design review cannot be understood without Sequence detail

## Cross-Cutting Evaluation Lenses

These lenses apply across both concept-only and whole-sequence evals. They do not replace the main rubric categories; they explain how a reviewer should judge whether the designer is using the available information well.

### 1. Prop Understanding

Question:
- does the designer demonstrate understanding of what the props are, how they are grouped, and what metadata tags imply about their role?

Expected evidence:
- xLights source structure and metadata tags influence target selection
- target groups reflect real prop categories rather than arbitrary buckets
- user-created or refined metadata is reflected in later concept choices

Failure examples:
- props are treated as interchangeable when source data clearly distinguishes them
- metadata tags exist but do not influence design reasoning
- concepts ignore obvious prop-role differences such as focal props vs perimeter props

### 2. Setting and Layout Awareness

Question:
- does the designer understand where props live in the layout and how their physical position should affect use?

Expected evidence:
- layout position influences focal vs support decisions
- high-visibility props are used differently from peripheral props
- vertical, horizontal, center-stage, edge, and background roles are used intentionally

Failure examples:
- center/focal props are used like anonymous filler
- edge props dominate when the concept calls for concentrated focus
- spatial composition ignores the actual layout

### 3. Musical Understanding

Question:
- does the designer demonstrate that musical structure is driving the design rather than acting as a loose label source?

Expected evidence:
- anchor choice matches the musical behavior requested
- energy, phrasing, rhythm, harmonic movement, and transitions affect concept decisions
- timing-window quality reflects actual musical events rather than arbitrary slices

Failure examples:
- concepts use section labels mechanically without musical justification
- beat or chord-sensitive requests stay section-only
- placement timing does not respond to musical changes

### 4. Stage Lighting Reasoning

Question:
- can the designer relate stage-lighting concepts and best practices to sequencing decisions in a meaningful way?

Expected evidence:
- concepts use recognizable ideas such as key/fill contrast, backlight-style support, silhouette, punch, wash, accent, build, and blackout-style restraint appropriately
- focal hierarchy and layering reflect lighting logic, not just random effect stacking
- terminology is applied correctly and improves the design rather than decorating the explanation

Failure examples:
- lighting terms are used superficially or incorrectly
- concept language references lighting ideas but the target/layer choices do not support them
- every concept behaves like a flat wash regardless of stated lighting intent

### 5. Composition Reasoning

Question:
- can the designer relate visual composition principles to the design in a way that changes what gets sequenced?

Expected evidence:
- concepts reflect balance, contrast, rhythm, repetition, emphasis, negative space, framing, and progression where appropriate
- target selection and coverage density show compositional restraint
- palette and motion decisions reinforce visual composition rather than compete with it

Failure examples:
- composition language is absent from the resulting choices
- everything is treated as equally important
- the pass lacks framing, balance, or intentional negative space

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

### 8. Coverage Discipline

Question:
- does the pass put effects where they matter instead of filling space mechanically?

Strong signals:
- dense moments are not overfilled
- quieter moments still have enough visual intent
- broad passes leave room for contrast and later refinement

Failure examples:
- blanket coverage on every section
- empty sections with no purposeful reason
- mechanical overpopulation of all available targets

## Failure Classes

Mark a sample as failed even if some category scores are acceptable when any of these occur:
- concept identity drift: a revise request creates a new concept instead of revising the existing one
- concept scope drift: revising one concept materially rewrites unrelated concepts
- anchor failure: concept uses the wrong timing reference system
- focal collapse: no clear focal hierarchy remains
- palette incoherence: no legible color direction
- repetitive flattening: whole pass collapses to a trivial repeated family pattern
- sequencing leakage: concept summaries become raw sequence-command mirrors
- coverage collapse: the pass floods too much of the show without restraint or leaves major gaps without purpose
- revision leakage: a revised concept is no longer clearly distinguishable from unrelated concepts

## Eval Set Composition

The initial deep-training eval set should include at minimum:
- `10` concept-only samples
- `6` revise-existing-concept samples
- `6` broad whole-sequence pass samples
- `3` preference-aware samples for the same director profile

Each eval set should intentionally include:
- one beat-anchored case
- one chord-anchored case
- one global or cross-section case
- one concept revision case where only one concept should change
- one broad pass where restraint matters more than density
- one metadata-sensitive prop-selection case
- one layout-sensitive focal-composition case
- one music-driven accent case where section labels alone are insufficient
- one case that explicitly references stage-lighting terminology
- one case that explicitly references composition principles

Review note:
- each eval sample should record which cross-cutting lenses are materially in play so scores can be explained against the same expectations
- once category floors are saturated, add comparative evals that require the scorer to prefer a stronger output over a flatter but still structurally valid alternative

## Promotion Thresholds

Promote a concept-training slice only when:
- no hard failure classes appear
- all core concept categories are `>= 2`
- average concept score is `>= 2.2`

Promote a whole-sequence training slice only when:
- no hard failure classes appear
- all core whole-pass categories are `>= 2`
- average whole-pass score is `>= 2.1`

Use `3`-score samples as:
- positive references
- candidate exemplars for future training examples

## Promotion Rule

A training slice should only be promoted when:
- no hard failure classes appear in the eval set
- concept-quality scores are at least acceptable on the core set
- whole-sequence pass scores are at least acceptable on the broad-pass set
