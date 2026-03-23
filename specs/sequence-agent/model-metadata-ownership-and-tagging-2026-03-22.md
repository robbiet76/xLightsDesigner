# Model Metadata Ownership And Tagging (2026-03-22)

## Purpose

Define how model/group/submodel metadata should work as the system expands beyond the current narrow trained model buckets.

This spec is driven by two constraints:

1. Real layouts are large.
   A user with `400+` elements should not be expected to manually maintain a taxonomy.
2. Custom models must be supported without hardcoding show-specific semantic families into runtime code.

The system should learn and update metadata in the background, while giving the user a clean way to inspect and correct it.

## Current Reality

Current metadata/tagging surfaces exist, but they are still primitive:

- metadata targets are built in [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)
- tag library and assignments are also managed in [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)
- designer/sequencer consume `metadataAssignments`
- tests rely on a small set of hardcoded tags such as:
  - `focal`
  - `support`
  - `character`
  - `lyric`
  - `rhythm`
  - `background`
  - `perimeter`

That is adequate for validation, but not sufficient as the long-term metadata system for large, mixed, custom-heavy layouts.

## Product Goals

The metadata system should be:

1. app-managed by default
2. visible to the user on demand
3. correctable by the user where high-value
4. low-maintenance even on large shows
5. structured first, tags second
6. generic across arbitrary custom models

## Ownership Model

Metadata has three ownership classes.

### 1. System Metadata

System metadata is inferred or computed by the application and is not expected to be maintained manually.

Examples:

- raw model type
- geometry/topology traits
- node count
- spatial zone
- group/submodel structure
- render-risk hints
- trained compatibility state
- inferred semantic traits

Normal behavior:

- generated silently
- updated silently
- visible in UI
- not user-edited in the default UI

Advanced behavior:

- override only if the user explicitly enters an advanced correction flow

### 2. User Preference Metadata

User preference metadata captures meaning or preference the system cannot infer reliably.

Examples:

- role preference: `lead`, `support`, `frame`, `accent`
- sequencing preference: `support_only`
- avoidances: `avoid_dense_effects`
- motion preference: `prefer_smooth_motion`
- semantic hint: `treat_as_radial`
- prominence: `high_visibility`

Normal behavior:

- shown as editable controls
- low-cardinality, structured fields
- user only edits when the app’s inference is wrong or incomplete

### 3. Tags

Tags are supplemental metadata, not the primary semantic model.

Tags should be used for:

- search/filtering
- project-local organization
- optional semantic hints not worth first-class schema yet
- controlled cross-cutting labels

Tags should not become the main place where every meaning is stored.

## Core Principle

Structured metadata fields come first.
Tags complement them.

Bad long-term model:

- tag everything
- interpret tags through scattered runtime `if` branches

Good long-term model:

- structured fields for stable semantics
- tags for optional/project-specific overlay
- shared metadata registries consume both

## Metadata Layers

The metadata stack should be split into four layers.

### Layer 1: Raw Layout Facts

Pulled from xLights/layout state.

Examples:

- model id
- raw type
- submodels
- group membership
- spatial position
- node count

### Layer 2: Derived Structural Metadata

Computed automatically from raw layout facts.

Examples:

- topology class
- coverage class
- aggregate vs concrete target
- submodel complexity
- radial/linear/matrix-like geometry traits
- visual footprint

### Layer 3: Learned Semantic Metadata

Updated silently by the app as sequencing/training improves.

Examples:

- inferred prop role
- effect-family affinity
- motion affinity
- preferred sequencing use
- confidence score
- provenance

### Layer 4: User Overrides

Explicit user corrections or preferences.

Examples:

- `rolePreference = focal`
- `motionPreference = rotational`
- `avoidDenseEffects = true`
- `semanticHint = character`

## Precedence Rules

Metadata precedence should be explicit:

1. user override
2. trusted project metadata
3. learned semantic metadata
4. derived structural metadata
5. raw layout facts

This must be consistent everywhere:

- UI
- designer runtime
- sequencer runtime
- validation
- training export

## Tag Model

Tags should be split by purpose.

### Structural Tags

Stable target organization.

Examples:

- `left`
- `right`
- `center`
- `foreground`
- `background`
- `frame`
- `accent`

### Semantic Tags

Meaningful design hints.

Examples:

- `character`
- `radial`
- `linear`
- `matrix_like`
- `text`
- `texture_prop`

### Operational Tags

Sequencing constraints/preferences.

Examples:

- `support_only`
- `avoid_dense_effects`
- `good_for_peaks`
- `slow_motion_preferred`

### Project Tags

Show-specific organization.

Examples:

- `north_pole`
- `roofline`
- `kid_zone`

## Tag Rules

1. controlled tags should be suggested first
2. freeform tags are allowed, but clearly distinguished from controlled tags
3. tags should have descriptions and optional examples
4. tags should support scope:
   - model
   - group
   - submodel
5. tags must not be the only storage for high-value semantics if a structured field exists

## UI Model

The UI should let the user inspect metadata without forcing manual maintenance.

### Metadata Table

For each target row, show:

- name
- target kind: `model`, `group`, `submodel`
- raw type
- support state
- inferred semantic summary
- confidence
- override indicator

### Detail Panel

Clicking a target should open a detail panel with sections:

1. Identity
- id
- type
- parent/group membership

2. Structural Metadata
- geometry/topology traits
- spatial role
- render-risk

3. Learned Metadata
- inferred semantic role
- learned effect affinities
- confidence/provenance
- last updated

4. User Preferences
- editable structured fields

5. Tags
- controlled tags
- project tags
- descriptions

6. Support State
- `trained_supported`
- `runtime_targetable_only`
- `out_of_scope`

## User Editing Philosophy

The user should not be required to tag hundreds of elements.

Default behavior:

- the app infers metadata
- the app updates it silently
- the app uses it automatically

User editing should be reserved for:

- correcting an important misclassification
- setting a creative preference
- labeling a prop with project-specific meaning

The target interaction model is:

- inspect if curious
- correct if wrong
- ignore otherwise

## Custom Models

Custom models must not be handled by hardcoded name-based logic in runtime code.

Wrong approach:

- `if modelName contains Snowman`
- `if custom and Spinner`

Correct approach:

- infer structural traits
- incorporate tags and user overrides
- store learned semantics as metadata
- let training/selection operate on metadata, not literal model names

This means a future custom-model Stage 1 expansion should be driven by:

- structural metadata
- learned metadata
- user overrides
- tags

not runtime-specific prop-name branches.

## System Behavior For Silent Learning

The app should be allowed to update learned metadata in the background when:

- a model repeatedly receives a consistent effect family
- revisions repeatedly push it toward a stable role
- training support for its structure improves
- validation shows a target consistently behaves like a known semantic pattern

Every learned change should store provenance:

- source
- timestamp
- confidence
- superseded value if applicable

## Current Implementation Direction

The current codebase already has the start of this system:

- metadata targets
- tag library
- metadata assignments
- shared effect semantics
- shared target semantics

What is missing is a proper product boundary and ownership model.

This spec provides that boundary.

## Immediate Follow-On Work

1. build a layout support report from the current show
- classify every target as:
  - `trained_supported`
  - `runtime_targetable_only`
  - `out_of_scope`

2. define a normalized metadata record contract for:
- model
- group
- submodel

3. add a metadata detail panel contract to the UI layer

4. convert current hardcoded test tags into:
- controlled tag schema where appropriate
- structured metadata fields where tags are carrying too much meaning

5. ensure future custom-model training uses metadata-driven classification rather than inline prop-family logic
