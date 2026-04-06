# macOS Native Review Workflow Review From Electron (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Use the existing Electron `Review` workflow as a reference artifact while defining the native macOS `Review` screen more precisely.

Electron is a workflow reference only.
It is not the target shell.

## What To Keep

### 1. Pending implementation first
Keep:
- pending change summary as the first read surface

Reason:
- the page is the implementation gate.

### 2. Design and sequence as supporting summaries
Keep:
- design and sequence shown as supporting inputs rather than full dashboards

Reason:
- they inform the decision without taking over the page.

### 3. Approval/apply region remains dominant
Keep:
- approve/defer/apply controls grouped in one clear action region

Reason:
- decision ownership belongs here.

## What To Remove

### 1. Dashboard sprawl
Remove:
- too many simultaneous fragments that dilute the decision surface

### 2. History-style content
Remove:
- retrospective audit detail that belongs in `History`

## What To Change

### 1. Tighten readiness and impact language
Change:
- blockers, impact, and backup state should read as one coherent decision summary

### 2. Make post-apply confirmation distinct
Change:
- after apply, the page should clearly transition from pending decision to completed result

## Native Review Screen Definition Derived From Review

1. top band = pending implementation summary
2. lower left = design + sequence supporting summaries
3. lower right = readiness, impact, backup, decision actions
4. apply decision remains dominant
