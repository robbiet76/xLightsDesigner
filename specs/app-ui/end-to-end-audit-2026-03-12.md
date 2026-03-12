# App UI/UX End-to-End Audit

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-12

Purpose: assess the current UI and user workflow so the next phase can focus on a coherent product experience instead of continuing incremental drift inside `app.js`.

## Audit Scope
Reviewed:
- current renderer shell and screen layout in [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)
- current `app_assistant` team-chat direction in [app-assistant-role-and-boundary.md](/Users/robterry/Projects/xLightsDesigner/specs/app-assistant/app-assistant-role-and-boundary.md)
- current domain boundaries for:
  - `audio_analyst`
  - `designer_dialog`
  - `sequence_agent`

Not reviewed here:
- low-level xLights automation completeness
- training package quality except where it directly affects UI expectations

## Current UI Shape

### 1. One shell exists, but it is not yet one workflow
The renderer already has a real application shell:
- left navigation
- top header
- main content area
- persistent right-side coach/chat panel
- bottom global chat bar
- settings drawer
- diagnostics footer

That is enough to support a strong product. The problem is not missing shell structure. The problem is workflow coherence inside the shell.

Today, the app behaves more like a collection of implementation surfaces than a deliberate user journey.

### 2. Main screens exist, but their responsibilities blur
Current top-level screens:
- `Project`
- `Sequence`
- `Inspiration`
- `Design`
- `History`
- `Metadata`

These screens expose real capability, but the grouping is inconsistent:
- `Sequence` mixes sequence open/setup, audio analysis, and creative brief entry
- `Design` mixes team chat, proposal review, and execution approval
- `Metadata` is powerful but visually isolated from how the designer and sequencer actually consume those targets
- `Inspiration` is clearly concept-level, but it is disconnected from the current design conversation artifact flow

The screens do not yet tell a clear story of:
1. set up the project,
2. attach media and analyze it,
3. choose/open the sequence context,
4. shape the design,
5. review and apply sequencing,
6. inspect history and diagnostics.

### 3. Chat exists, but its placement and ownership are split
Current chat-related surfaces:
- persistent right-side chat thread
- bottom global input composer

This is workable, but the current experience still feels transitional because:
- the thread lives in a panel labeled `Designer`
- the composer is global
- the routing logic now belongs to `app_assistant`
- visible specialist identity has started to land, but the shell still visually reads as a designer-side coach panel rather than the central team conversation

This means the UI is currently between two models:
- old designer-coach sidebar
- new app-wide team chat

The team-chat model is the correct one. The UI has not fully caught up yet.

### 4. Artifacts are real, but they are not surfaced as first-class UI objects
The runtime now has strong structured artifacts:
- `analysis_artifact_v1`
- `analysis_handoff_v1`
- `creative_brief_v1`
- `proposal_bundle_v1`
- `intent_handoff_v1`
- sequence-agent plan/apply artifacts

But the UI still mostly renders:
- text summaries
- proposal rows
- diagnostics strings

The user does not yet see artifacts as clear, inspectable objects in the workflow. That weakens:
- trust
- reviewability
- delegation clarity
- understanding of what each specialist produced

### 5. Design review/apply loop is strong, but too buried
The `Design` screen already contains valuable behavior:
- proposed change list
- payload preview
- impact summary
- approval gate
- restore backup
- stale draft handling

This is one of the strongest parts of the current UI.

The issue is that it is nested inside a broader screen model that still assumes the right-side coach panel is the primary control surface. The review/apply loop should be treated as one of the app’s main product moments, not as a side effect of the design screen.

### 6. Settings drawer is overloaded
Current Settings mixes:
- endpoint and safety policy
- cloud agent config
- analysis service config
- rollout policy
- team chat nicknames
- application health

This is functional, but not target state.

There are too many unrelated concerns in one drawer:
- environment/config
- specialist naming
- operator health/diagnostics

This will become harder to use as the app grows.

### 7. Diagnostics are available, but not contextual enough
Current diagnostics surfaces:
- footer diagnostics tray
- apply history
- health fields in Settings

These are useful for engineering and debugging, but still too raw for normal workflow support.

The UI does not yet clearly separate:
- user-facing workflow status
- specialist artifact summaries
- developer/operator diagnostics

### 8. `app.js` still owns too much screen composition
Domain extraction is much better than before, but the UI still depends on one large render/bind file.

Current state:
- screen rendering, settings drawer, diagnostics, chat rendering, and many event bindings still live in [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)

This is not a blocker for continuing UI work, but it does mean:
- UI changes are riskier than they should be
- visual/interaction redesign will be slower
- there is no stable UI-domain runtime boundary yet

## What Is Working Well
- there is already a usable multi-screen desktop shell
- specialist domains are now structurally separated underneath the shell
- team-chat routing foundation exists
- designer proposal lifecycle exists
- review/approve/apply flow exists
- audio analysis now has a reusable artifact model
- the app is already much closer to a real product than to a prototype script

## Primary UX Problems To Solve Next

### 1. Information architecture is not aligned to the actual user journey
The current tabs/screens expose capability, but they do not guide the user through the intended flow cleanly.

### 2. Team chat is conceptually right, visually transitional
The app now has a team-chat runtime model, but the UI still looks like a single “designer coach” panel with a separate global input.

### 3. Specialist artifact visibility is too weak
Artifacts exist in code more strongly than they exist in the product experience.

### 4. Project/setup vs design vs execution boundaries are not clear enough
The user can do the work, but the app does not yet make the phase transitions feel intentional.

### 5. Settings and diagnostics need stronger separation from normal workflow
These are necessary surfaces, but they should not dominate the normal user path.

## Recommended Target Interaction Model

### 1. Workflow-first shell
The UI should guide the user through these major phases:
1. Project
2. Analysis
3. Sequence
4. Design
5. Review
6. History
7. Metadata

Whether those remain tabs or become a different structure is an implementation detail. The important change is that the information architecture should mirror the real workflow.

Locked high-level screen model:
- `Project`
- `Analysis`
- `Sequence`
- `Design`
- `Review`
- `History`
- `Metadata`

Locked screen ownership model:
- `Project`
  - app shell / project setup
- `Analysis`
  - `audio_analyst`
- `Sequence`
  - sequence context open/create/select
- `Design`
  - `designer_dialog`
- `Review`
  - `sequence_agent`
- `History`
  - app shell / audit and recovery
- `Metadata`
  - shared semantic context editing

Locked consolidation decision:
- `Inspiration` should not remain a top-level screen
- reference media, palette direction, and other inspiration inputs should live inside `Design`

### 2. Team chat as a first-class core panel
The shared conversation should become visibly central to the product instead of behaving like a legacy sidebar.

Requirements:
- visible speaker identity
- optional nickname display
- artifact cards/messages in chat
- routed specialist visibility
- clear relationship between conversation and current workflow phase

### 3. Artifact-first review surfaces
The user should be able to see:
- what analysis exists
- what creative brief exists
- what proposal bundle is current
- what plan/apply state exists

Those should not be hidden only inside raw text, payload previews, or status banners.

### 4. Cleaner separation of:
- workflow UI
- settings/configuration UI
- diagnostics/operator UI

## Recommended Next UI Build Order

### Phase A: Information Architecture
- lock target screen/phase model
- move `Analysis` ahead of `Sequence` in the main workflow
- make `Design` and `Review` distinct phases
- fold `Inspiration` into `Design`

### Phase B: Team Chat Presentation
- turn the current coach panel into a true team-chat panel
- make speaker identity explicit and polished
- show routed delegation and artifact summaries inline

### Phase C: Artifact Surfaces
- analysis artifact summary card
- creative brief card
- proposal bundle card
- handoff/apply summary card

### Phase D: Settings/Diagnostics Cleanup
- separate user-facing preferences from operator diagnostics
- reduce settings-drawer overload

### Phase E: `app.js` UI decomposition
- extract shell rendering
- extract settings/diagnostics rendering
- extract chat rendering
- extract screen-specific event binding

## Recommended Immediate Decision
Before deep visual redesign, lock the target screen/phase model in a UI checklist. That will prevent the next UI work from becoming another local optimization inside `app.js`.
