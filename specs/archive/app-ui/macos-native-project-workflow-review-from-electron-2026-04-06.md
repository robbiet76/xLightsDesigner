# macOS Native Project Workflow Review From Electron (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Use the existing Electron `Project` workflow as a reference artifact while defining the native macOS `Project` screen more precisely.

Electron is a workflow reference only.
It is not the target shell.

## What To Keep

### 1. Project identity first
Keep:
- active project shown before downstream details
- create/open/save actions close to project identity

Reason:
- the page correctly begins with project context rather than diagnostics.

### 2. Project lifecycle actions remain obvious
Keep:
- `Create Project`
- `Open Project`
- `Save Project`
- `Save Project As`

Reason:
- these are the core lifecycle actions and should stay prominent.

### 3. Sequence context remains subordinate
Keep:
- active sequence context shown only as supporting project context

Reason:
- it is useful here only as a project readiness hint, not as a competing workflow.

## What To Remove

### 1. Mixed dashboard feeling
Remove:
- multiple banner-like fragments that compete for attention
- any sense that this page is also a sequence control surface

### 2. Overloaded summary language
Remove:
- verbose explanatory copy where a concise readiness summary is enough

## What To Change

### 1. Make the first read surface stricter
Change:
- the page should answer `what project am I in` before anything else

### 2. Make downstream readiness lighter
Change:
- downstream hints should stay compact and non-interactive

### 3. Make referenced paths clearer
Change:
- show folder/media/project paths as durable context, not as editable form sprawl

## Native Project Screen Definition Derived From Review

1. top summary = active project identity
2. action band = project lifecycle only
3. lower detail = referenced paths and readiness
4. downstream workflow hints remain lightweight
