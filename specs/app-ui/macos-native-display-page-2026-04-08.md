# macOS Native Display Page (2026-04-08)

Status: Active
Date: 2026-04-08
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Display` page as the semantic metadata workspace for the display.

This page is not a raw xLights model browser.
It is the place where the application captures, reviews, edits, and applies learned display understanding derived from:
- agent conversation
- user confirmation
- xLights layout grounding
- project-owned display memory

The xLights layout remains the grounding layer, but the primary working dataset on this page is display metadata, not individual model rows.

## Core Role

The `Display` page answers:
- what the system currently understands about the display
- which display semantics are confirmed versus proposed
- what open questions still matter
- how that learned understanding maps back to actual models and families

## Primary Dataset

The record level for this page is a `display metadata entry`, not a model element.

Examples:
- `CandyCane` -> `repeating pathway accents`
- `Snowflake_Large` -> `separate feature props near center`
- `HiddenTreeStar` -> `not focal point`
- `Flood_House` -> `supporting structural backdrop` (proposed or confirmed)

Each metadata entry should be able to show:
- subject
- subject type
- category
- value
- rationale
- status
- linked targets
- source

## Source Of Truth

The page must be backed by structured project-owned metadata.

Primary stores:
- `layout/display-discovery.json`
- `layout/layout-metadata.json`

Rules:
- structured display understanding is the richer machine-readable source of truth
- tags remain an important user-facing review/edit surface
- sequencing should use structured metadata plus applied tags plus live xLights context
- tags alone must not become the only semantic source

## Page Grammar

The page follows the same overall grammar already used successfully:
1. `Header`
2. `Summary`
3. `Controls`
4. `Current Selection`
5. `Grid`

## Region Specifications

### 1. Header
Required:
- `Display`
- concise explanation
- active project name

Purpose:
- establish that this page manages learned display understanding, not low-level layout inspection

### 2. Summary
Use compact summary cards or chips for:
- confirmed metadata entries
- proposed metadata entries
- open questions
- linked target coverage
- unresolved discovery state

This area should capture the essence of the current understanding.

### 3. Controls
Primary actions:
- refresh display state
- review proposed metadata
- apply accepted proposals
- manage tags
- add metadata entry manually

Rules:
- chat remains the preferred creation path
- manual creation/edit must still be available
- this page must support both agent-led and direct-edit workflows

### 4. Current Selection
Shows one selected metadata entry.

Required content:
- subject
- category
- value
- rationale
- source
- status
- linked models/families
- related tags
- edit/apply actions where appropriate

The selection pane is for inspection and refinement of one metadata entry, not a dump of raw model details.

### 5. Grid
Primary grid rows are metadata entries.

Required columns:
- `Subject`
- `Type`
- `Category`
- `Value`
- `Status`
- `Source`
- `Linked Targets`

Optional secondary columns:
- rationale preview
- last updated

Rules:
- the grid is the primary metadata inventory
- xLights model rows are not the primary semantic dataset here
- model-level mapping should remain available through drill-through or detail view

## Status Model
Metadata entries should distinguish between:
- `Confirmed`
- `Proposed`
- `Needs Review`
- `Applied`

Source should distinguish between:
- `User`
- `Agent`
- `Derived`
- `User + Agent`

## Relationship To xLights Layout
The xLights layout is still required for grounding and mapping.

The page must still allow the user to understand:
- which actual models a metadata entry refers to
- whether the mapping is broad family-level or specific model-level

But the layout model list becomes secondary supporting context, not the main grid.

## Creation And Editing Model
Preferred path:
- chat-driven discovery and refinement

Also required:
- manual add/edit/delete of metadata entries
- manual review of agent proposals
- explicit apply path for proposals before they become active tags/assignments

## Long-Term Direction
This page should become the clearest visible audit surface for what the agents have learned about the display.

It should let the user see:
- the direction of the conversation
- the current semantic understanding
- what remains unresolved
- what will influence design and sequencing next

This page is therefore the semantic display workspace, not merely a tagging page.
