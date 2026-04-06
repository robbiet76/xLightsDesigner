# macOS Native Sequence Workflow Review From Electron (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Use the existing Electron `Sequence` workflow as a reference artifact while defining the native macOS `Sequence` screen more precisely.

Electron is a workflow reference only.
It is not the target shell.

## What To Keep

### 1. Active sequence identity first
Keep:
- active sequence name/path and revision as the first read surface

Reason:
- the page must establish which sequence is being discussed immediately.

### 2. Translation readiness as the main technical summary
Keep:
- technical readiness and blocker summary as the main page payload

Reason:
- this is the real purpose of the screen.

### 3. Grid/list for translated rows
Keep:
- dense translated-change surface rather than cards

Reason:
- technical comparison needs a table-like browse surface.

## What To Remove

### 1. Global context leakage
Remove:
- anything that makes sequence identity feel app-global rather than local to this page

### 2. Review/apply ownership
Remove:
- approval/apply ownership from this page

## What To Change

### 1. Make binding and timing substrate clearer
Change:
- the bound track metadata and timing readiness should be grouped into one clear supporting detail area

### 2. Make technical blockers more concise
Change:
- blocker language should be actionable, not log-like

## Native Sequence Screen Definition Derived From Review

1. top band = active sequence identity and revision
2. left lower panel = translation readiness and blockers
3. right lower panel = binding, settings, timing substrate detail
4. no apply gate here
