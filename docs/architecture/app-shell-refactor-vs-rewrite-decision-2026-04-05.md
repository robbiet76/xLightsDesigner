# App Shell Refactor Vs Rewrite Decision

Date: 2026-04-05
Status: Active

## Question

Should the app be aggressively optimized by incremental refactor, or should we rewrite major parts of it now that significant functionality has accumulated?

## Short Answer

A **partial rewrite of the app shell** is justified.
A **full product rewrite is not justified**.

## Why

The current code shape shows two different things at once:

1. The **product architecture is mostly correct**.
   - analysis -> reviewed timing tracks -> sequencing
   - xLights-backed validation and review loop
   - explicit timing provenance and guardrails

2. The **app shell implementation is too concentrated**.
   - `apps/xlightsdesigner-ui/app.js` is still `13k+` lines
   - it imports and coordinates a very large number of modules
   - it still owns too many concerns directly

That means the system is not wrong enough to rewrite from scratch.
But the shell is concentrated enough that a bounded partial rewrite is reasonable and likely higher leverage than only doing tiny extractions forever.

## What I Checked

### 1. Current size and hotspot profile

Tracked first-party hotspots:

- `apps/xlightsdesigner-ui/app.js`: `13,454` lines after the latest extraction
- `apps/xlightsdesigner-analysis-service/main.py`: `4,537` lines
- `apps/xlightsdesigner-desktop/main.mjs`: `2,981` lines
- `apps/xlightsdesigner-ui/eval/run-designer-eval.mjs`: `2,195` lines
- `apps/xlightsdesigner-ui/agent/designer-dialog/designer-dialog-runtime.js`: `2,188` lines
- `apps/xlightsdesigner-desktop/live-validation-suites.mjs`: `1,536` lines

### 2. Import surface of `app.js`

`app.js` currently imports runtime, UI, analysis, sequencing, assistant, metadata, timing, and xLights integration concerns in one place.

That is the clearest sign that the file is an integration monolith rather than just a long file.

### 3. Recent extraction result

The timing-track runtime extraction was useful, but it only reduced `app.js` from:

- `13,547`
- to `13,454`

That confirms an important point:

- the file is not large because of one isolated blob
- it is large because many active concerns are still anchored there

### 4. Eval cleanup result

The eval surface responded well to explicit lifecycle cleanup:

- top-level `apps/xlightsdesigner-ui/eval` files reduced from `33` to `26`

That is evidence that the repo can be cleaned incrementally and safely when the boundary is explicit.

## Decision

### Not recommended: full rewrite of the whole app

Why not:

- too much validated behavior already exists
- timing provenance and sequencing guardrails are now meaningful assets
- a full rewrite would put analysis/timing/sequencing integration correctness at risk
- the product architecture does not appear fundamentally wrong

### Recommended: partial rewrite of the app shell

Meaning:

- keep existing lower-level modules where they are already coherent
- rewrite the app shell layer around clearer service boundaries
- treat `app.js` as the rewrite target, not the whole product

## Target State

Instead of one large app shell, we want a composition root plus a few service modules.

### Proposed shell-level modules

1. `sequence-session-runtime`
- single owner for show/sequence/media context truth
- already started with `SequenceSession`

2. `timing-track-runtime`
- timing policies, provenance, review acceptance
- already started

3. `automation-bridge-runtime`
- runtime automation exposure and health hooks
- should move out of `app.js`

4. `analysis-runtime`
- analysis orchestration coordination and apply-to-state glue

5. `project-runtime`
- project open/save/snapshot/media catalog/sequence catalog coordination

6. `ui-composition-runtime`
- page-state helper construction and screen wiring

Then `app.js` becomes mostly:

- initialize state
- create runtimes
- wire events
- render

## Realistic Size Goal

Current `app.js`:
- `13.4k`

Reasonable target after partial rewrite:
- `8k` to `10k`

Stretch target:
- below `8k`

That is realistic only if we do larger shell extractions, not just micro-cleanups.

## Did We Check For Redundant Or Unused Code?

Partially, not exhaustively.

What we know:

- eval surface had real redundancy and historical clutter, and we reduced it
- `app.js` appears to be mostly active code, not mostly dead code
- the biggest inefficiency is ownership concentration, not obvious dead code

So the next wins are more likely from:

- consolidation
- service extraction
- removing duplicated responsibility

than from a dead-code sweep alone

That said, a full unreferenced-function audit of `app.js` is still worth doing later.

## Recommended Implementation Strategy

### Phase 1: continue low-risk extractions

1. automation exposure/bootstrap
2. page-state helper construction
3. timing-track fetch/refresh glue

### Phase 2: shell partial rewrite

Create a new shell composition layer that:

- initializes state
- composes service modules
- exposes only narrow event handlers to the UI layer

At that point, `app.js` should lose most of its orchestration role.

### Phase 3: dead-code and duplication sweep

After the new shell shape is in place:

- identify leftover wrappers
- remove compatibility shims that are no longer needed
- collapse duplicate helper paths

## Bottom Line

Yes, optimization should now be a primary goal.

And yes, a **bounded rewrite of the app shell** should be considered part of that optimization effort.

But the right move is:

- **rewrite the shell boundary**
- **not rewrite the full application**

That is the highest-leverage way to improve organization, reduce code size, and preserve the validated behavior already in the system.
