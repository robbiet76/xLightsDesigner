# macOS Native Layout Workflow Review From Electron (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Use the existing Electron `Layout` workflow as a reference artifact while defining the native macOS `Layout` screen more precisely.

Electron is a workflow reference only.
It is not the target shell.

## What To Keep

### 1. Target-focused browsing
Keep:
- a target-oriented browse surface
- readiness and support state visible per target

Reason:
- the workflow needs a structural browse surface, not cards.

### 2. Selected-target correction surface
Keep:
- one selected-target detail/correction region rather than inline row actions

Reason:
- corrections should happen in one explicit place.

## What To Remove

### 1. Metadata framing
Remove:
- any old metadata-admin feel
- raw structural detail as the first read surface

### 2. Cross-workflow noise
Remove:
- design, sequence, or review context competing with target readiness

## What To Change

### 1. Make readiness the first summary
Change:
- show overall layout readiness before the full target list

### 2. Make assignment/remapping issues more explicit
Change:
- unresolved orphan/remapping issues should read as the primary blocker class

## Native Layout Screen Definition Derived From Review

1. top summary = overall layout readiness
2. main grid = target browse and compare surface
3. selected-target band = inspect and correct one target at a time
4. no generic metadata-management framing
