# xLightsDesigner Wireframes v2

Status: Draft  
Date: 2026-03-04  
Purpose: Low-fidelity UX wireframes for standalone xLightsDesigner aligned to current requirements.

## 1) Guardrails
- No timeline grid or sequencer-lane editor in Designer.
- xLights remains the detailed sequence editing/rendering tool.
- Designer provides intent capture, proposal review, approvals, history, and metadata.
- Left-rail navigation (confirmed).
- UI should stay minimal/noise-light, with detail-on-demand.

## 1.1 Terminology
- `Project`: xLightsDesigner container for one show context, preferences, and Designer-level history/settings.
- `Show`: user's xLights show folder and assets structure used by one or more sequences.
- Working default: one project maps to one show; each session/edit pass still operates on one sequence at a time.

## 2) Global Frame

```text
+----------------------------------------------------------------------------------+
| Top Bar: Project/Sequence | xLights Status | Revision Badge | Refresh | Review  |
+----------------------------------------------------------------------------------+
| Global Status/Message/Help Bar (all screens, one-line warnings + quick actions) |
+-------------+--------------------------------------------------------------------+
| Left Rail   | Active Screen Content                                             |
| - Project   |                                                                    |
| - Design    |                                                                    |
| - History   |                                                                    |
| - Metadata  |                                                                    |
+-------------+--------------------------------------------------------------------+
| Footer: last sync time | diagnostics | background jobs                           |
+----------------------------------------------------------------------------------+
```

## 3) Screen 1: Project/Home

Goal: choose sequence, bind show folder, and configure project-level settings.

```text
+------------------------------------+---------------------------------------------+
| Project Summary                    | Sequence Workspace                          |
| - Project Name                     | [Open Sequence] [Recent] [New Session]     |
| - Show Folder                      |                                             |
| - xLights Version                  | Current: CarolOfTheBells.xsq               |
| - Compatibility Status             | Designer metadata: CarolOfTheBells.xdmeta  |
|                                    | Last edited: 2026-03-04 10:41              |
+------------------------------------+---------------------------------------------+
| Project-Level Settings             | Session Actions                             |
| - Discovery policy                 | [Resume Last Session] [Plan Only Mode]     |
| - Retry policy                     | [Open in xLights]                           |
| - Backup policy                    |                                             |
| - Metadata storage path            |                                             |
+------------------------------------+---------------------------------------------+
```

Key interactions:
- Project/show folder setup.
- Open one sequence at a time.
- Enter plan-only mode when xLights unavailable.
- Project-level settings live here (no separate Settings destination).

## 4) Screen 2: Design Chat + Intent Tags

Goal: collaborative director-designer conversation with structured intent capture.

```text
+--------------------------------------+--------------------------------------------+
| Chat Thread                           | Intent + Proposed Changes Summary            |
| User/Agent turns                      | Scope: [Entire] [Selected Models] [Range]   |
|                                       | Range: [start-end] [timing label]           |
|                                       | Mood: [ ] Energy: [ ] Priority: [ ]         |
|                                       | Color Constraints: [ ]                      |
|                                       | Proposed next-write changes (live list):    |
|                                       | 1. Chorus 2 / CandyCanes / reduce twinkle   |
|                                       | 2. Verse 1 / MegaTree / color warm-up        |
|                                       | [Generate/Refresh Proposal] [Apply to xL]    |
+--------------------------------------+--------------------------------------------+
| Quick Commands: "Change chorus 2 candy canes twinkle amount"                     |
+-----------------------------------------------------------------------------------+
```

Key interactions:
- Agent asks minimal clarifying questions.
- Missing detail implies artistic license.
- User can reference semantic labels (for example `chorus-2`).
- Proposed-change list updates in real time from chat context and is the main "next write" preview.

## 5) Screen 3: Optional Detail View (Proposal Drill-Down)

Goal: inspect deeper details when user wants them (not required in primary flow).

```text
+-------------------------------------+---------------------------------------------+
| Proposal Summary                    | Diff Detail (expandable)                    |
| - Scope touched                     | Section: Chorus 2                           |
| - Impact size (rough)               | - Model: CandyCanes                         |
| - Approx effects impacted           | - Effect updates: 4                         |
| - Revision base token               | - Layer impacts: 1                          |
|                                     | - Timing labels touched: XD:Mood/chorus-2   |
+-------------------------------------+---------------------------------------------+
| Actions                                                                     |
| [Approve + Apply] [Revise Request] [Split by Section] [Cancel]             |
+------------------------------------------------------------------------------+
```

Key interactions:
- Mixed granularity diff: summary first, effect-level drill-down.
- Batch approval for large/high-impact proposals.
- Emphasis on impact size, not heavy risk language.

## 6) Screen 4: History + Rollback

Goal: versioned change history per sequence.

```text
+----------------------------------------------------------------------------------+
| Version Timeline (latest first)                                                  |
| v18  "Reduce chorus 2 twinkle"  | applied | risk: medium | 2026-03-04 11:05     |
| v17  "Boost verse 1 energy"     | applied | risk: low    | 2026-03-04 10:53     |
| v16  "Initial agent pass"       | applied | risk: high   | 2026-03-04 10:22     |
+----------------------------------------------------------------------------------+
| Selected Version Detail                                                         |
| Scope, models touched, labels touched, diff summary                             |
| [Rollback to This Version] [Compare to Current] [Reapply as Variant]            |
+----------------------------------------------------------------------------------+
```

Key interactions:
- Each approved update is a version checkpoint.
- Rollback targets a chosen version and triggers re-render.

## 7) Screen 5: Model Metadata (Intent-Focused)

Goal: manage semantic context without recreating xLights model management UI.

```text
+--------------------------------------+--------------------------------------------+
| Semantic Tags Library                | Context Assignment                          |
| Curated + user-extensible tags       | Target: [Model Group/Model Selector]       |
| - focal                              | Role: [focal/support/accent]               |
| - rhythm-driver                      | Energy behavior: [steady/pulse/swell]      |
| - ambient-fill                        | Style notes: [freeform]                    |
|                                      | [Apply Tags] [Bulk by Group]               |
+--------------------------------------+--------------------------------------------+
| Orphaned Metadata: 3 items (missing model IDs) [Review Mapping]                |
+----------------------------------------------------------------------------------+
```

Key interactions:
- Curated tags with user extensions.
- Orphan handling when model identity disappears.
- Keep panel intent-centric; no full layout editor replication.

## 8) Settings Placement
- No dedicated Settings screen in v2.
- Project-level settings and connectivity controls are embedded in Project/Home.
- Advanced detail remains available in Metadata and diagnostics views.

## 9) Mobile/Compact Behavior
- Left rail collapses to icon bar + drawer.
- Proposed-changes summary remains on Design screen; deep diff opens as optional drill-down sheet.
- Chat and Intent panels become tabbed segments within Design screen.
- History list remains accessible with version actions in bottom sheet.

## 10) Primary Flow Map
1. Open Project/Home.
2. Select sequence (or plan-only mode).
3. Enter request in Design Chat and adjust intent tags.
4. Watch proposed-changes summary update live.
5. Optionally open proposal drill-down for details.
6. Approve apply or request revision from Design screen.
7. Validate outcome in xLights via `Review in xLights`.
8. Continue iteratively; each approved apply creates next version in History.

## 11) Open Wireframe Questions
- Should the global status/message/help bar be dismissible per message type or always pinned?
- For proposed-changes summary, do we cap at top N items with "show more", and what is N?
- Should apply action always require opening the summary list footer confirmation first?
