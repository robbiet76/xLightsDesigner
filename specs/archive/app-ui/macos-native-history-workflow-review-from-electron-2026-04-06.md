# macOS Native History Workflow Review From Electron (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Use the existing Electron `History` workflow as a reference artifact while defining the native macOS `History` screen more precisely.

Electron is a workflow reference only.
It is not the target shell.

## What To Keep

### 1. Historical list-first structure
Keep:
- revision/event list as the primary browse surface
- selected event detail as a secondary read surface

Reason:
- history is best understood through chronological browsing.

### 2. Read-only posture
Keep:
- retrospective, non-approval framing

Reason:
- `History` must remain distinct from `Review`.

## What To Remove

### 1. Any sense of pending work ownership
Remove:
- language or affordances that blur `History` with active review/apply work

### 2. Placeholder-heavy empty state noise
Remove:
- overly apologetic or temporary framing when history is empty or unavailable

## What To Change

### 1. Make temporal order and evidence clearer
Change:
- selected history detail should emphasize what happened, when, and what evidence exists

### 2. Keep follow-up context secondary
Change:
- any pointer back to current state must remain non-actionable and clearly secondary

## Native History Screen Definition Derived From Review

1. top summary = concise historical overview
2. main list = newest-first event/revision browse surface
3. selected detail = event summary and evidence
4. no approval/apply ownership
