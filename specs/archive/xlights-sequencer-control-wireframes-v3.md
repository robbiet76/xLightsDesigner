# xLightsDesigner Wireframes v3

Status: Draft  
Date: 2026-03-04  
Purpose: Updated low-fidelity wireframes with explicit screen structure and interaction behavior.

## 1) Core UX Decisions Applied
- Project screen includes project-level settings.
- Design screen includes chat plus live proposed-changes summary.
- Global status/message/help bar is visible on all screens.
- Use low-noise impact indicators (approx change size), not heavy risk language.
- No duplicate timeline/sequencer UI.

## 2) Terminology
- `Show`: xLights show folder and assets.
- `Project`: xLightsDesigner workspace bound to one show.
- Working pattern: one project per show; one active sequence at a time.

## 3) Global Shell

```text
+----------------------------------------------------------------------------------+
| Header: Project | Active Sequence | xLights Status | Revision | Refresh | Review |
+----------------------------------------------------------------------------------+
| Global Status Bar: one-line warning/info/help + [View Details]                  |
+--------------+-------------------------------------------------------------------+
| Left Nav      | Main Content                                                      |
| - Project     |                                                                   |
| - Design      |                                                                   |
| - History     |                                                                   |
| - Metadata    |                                                                   |
+--------------+-------------------------------------------------------------------+
| Footer: last sync | background jobs | diagnostics                                 |
+----------------------------------------------------------------------------------+
```

## 4) Project Screen (Home + Settings)

```text
+------------------------------------+---------------------------------------------+
| Project Summary                    | Sequence Workspace                          |
| - Project Name                     | [Open Sequence] [Recent] [New Session]     |
| - Show Folder                      | Active: CarolOfTheBells.xsq                |
| - xLights Version                  | Sidecar: CarolOfTheBells.xdmeta            |
| - Compatibility                    | Last edited: 2026-03-04 11:30              |
+------------------------------------+---------------------------------------------+
| Project-Level Settings             | Session Actions                             |
| - Discovery: auto + manual fallback| [Resume Last] [Plan Only] [Open in xLights]|
| - Multi-instance: latest running   |                                             |
| - Retry: 1,2,5,10,15 then 30s      |                                             |
| - Backups: before apply, keep 20   |                                             |
+------------------------------------+---------------------------------------------+
```

## 5) Design Screen (Primary Workspace)

```text
+--------------------------------------+--------------------------------------------+
| Chat Thread                           | Intent + Proposed Changes                   |
| User/Agent turns                      | Scope: [Entire] [Models] [Range]           |
|                                       | Range: [time] [timing label]               |
|                                       | Mood [ ] Energy [ ] Priority [ ]           |
|                                       | Color constraints [ ]                      |
|                                       |                                            |
|                                       | Proposed Next Write (live):                |
|                                       | 1. Chorus 2 / CandyCanes / reduce twinkle |
|                                       | 2. Verse 1 / MegaTree / warm lift         |
|                                       | 3. XD:Mood labels update                   |
+--------------------------------------+--------------------------------------------+
| Input: [Type request...] [Generate/Refresh] [Apply to xLights] [Open Details]   |
+-----------------------------------------------------------------------------------+
```

Interaction notes:
- Agent asks minimal clarifying questions.
- Missing detail implies artistic license.
- Proposed list updates as conversation/intent changes.
- `Apply to xLights` writes the currently visible proposal set.

## 6) Proposal Detail Drawer (Optional)

```text
+----------------------------------------------------------------------------------+
| Proposal Detail (on-demand)                                                     |
| Impact summary: approx effects impacted, models touched, labels touched         |
| Revision base token: rev-12345                                                  |
| Sections: [Chorus 2] [Verse 1] [Bridge]                                         |
| Expanded detail: effect-level changes (optional drill-down)                     |
| Actions: [Apply] [Back to Design] [Split by Section] [Discard Draft]            |
+----------------------------------------------------------------------------------+
```

## 7) History Screen (Versioned Iteration)

```text
+----------------------------------------------------------------------------------+
| Version List (latest first)                                                     |
| v18  Reduce chorus 2 twinkle | applied | approx 34 effects | 11:05              |
| v17  Boost verse 1 energy    | applied | approx 22 effects | 10:53              |
| v16  Initial pass            | applied | approx 120 effects| 10:22              |
+----------------------------------------------------------------------------------+
| Selected Version                                                                |
| Scope summary, affected models, timing labels                                   |
| [Rollback to This Version] [Compare] [Reapply as Variant]                       |
+----------------------------------------------------------------------------------+
```

Interaction notes:
- Each approved update creates one version.
- Rollback selects target version and re-renders sequence.

## 8) Metadata Screen (Intent-Focused)

```text
+--------------------------------------+--------------------------------------------+
| Tag Library                           | Context Assignment                          |
| - curated + user extensible           | Target: [model/group]                       |
| - focal, rhythm-driver, ambient-fill  | Role: [focal/support/accent]                |
|                                        | Behavior: [steady/pulse/swell]              |
|                                        | Notes: [free text]                          |
|                                        | [Apply] [Bulk Apply]                        |
+--------------------------------------+--------------------------------------------+
| Orphaned Metadata: 3 entries [View Details]                                     |
+----------------------------------------------------------------------------------+
```

## 9) Compact Layout Rules
- Left nav collapses to icon rail/drawer.
- Design screen uses tabs: `Chat`, `Intent`, `Proposed`.
- Proposal detail opens as full-height sheet.
- History actions move to bottom action bar.

## 10) Global Status Bar Behavior
- Always visible.
- One-line message only.
- Levels: info, warning, action-required.
- Details open in Metadata/Diagnostics views (not inline).

## 11) Remaining UX Decisions
- Max visible proposed-change rows before `Show More` (suggest default `5`).
- Whether `Apply to xLights` needs a final confirmation step every time or only for large impacts.
