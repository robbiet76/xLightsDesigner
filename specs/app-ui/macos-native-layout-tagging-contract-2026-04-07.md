# macOS Native Layout Tagging Contract (2026-04-07)

Status: Active
Date: 2026-04-07
Owner: xLightsDesigner Team

## Purpose

Lock the real product purpose of the native `Layout` workflow before deeper implementation.

`Layout` is not a passive mirror of xLights.
It is the project-owned metadata workspace over the xLights layout.

## Core Rule

xLights owns layout structure.
xLightsDesigner owns supplemental layout metadata.

That means:
- xLights remains the source of models, groups, submodels, and layout-group structure
- xLightsDesigner stores flexible semantic tags that help design and sequencing
- the native `Layout` screen must let the user or designer agent create, edit, remove, and review that metadata at scale

## Product Need

The `Layout` workflow exists so either the user or the designer agent can:
- create semantic tags on xLights targets
- maintain those tags over time
- reuse those tags across project migration
- filter and target downstream design/sequencing work more effectively

Without editable tagging, the page has little product value because the base layout already exists in xLights.

## Target Scope

The workflow must scale to:
- models
- groups
- submodels

The workflow must remain usable when the project contains hundreds or thousands of targets.

## Tag Rules

Tags are:
- flexible
- project-owned
- zero-to-many per target
- not limited to a fixed enum

Examples of valid use:
- spatial meaning
- narrative use
- visual role
- motion suitability
- sequencing constraints
- semantic grouping that xLights itself does not model directly

## Tag Definition Model

The system must distinguish between:
1. tag definitions
2. tag assignments

### Tag Definition

A tag definition contains:
- stable internal id
- tag name
- optional description

Behavior:
- create tag definition
- rename tag definition globally
- edit description
- delete tag definition globally

A rename must update all impacted assignments.
A delete must remove the tag from all impacted targets.

## Tag Assignment Model

A tag assignment connects:
- target id
- tag definition id

Each target may have any number of tag assignments.

## Native Interaction Rule

The native `Layout` screen should use macOS table-and-inspector patterns rather than button-heavy dashboard UI.

Preferred structure:
1. compact page summary
2. native multi-select target table
3. selected-target / multi-selection inspector
4. separate `Manage Tags…` sheet for tag-definition editing

## Bulk Editing Rule

Bulk tag editing is mandatory.

The workflow must support:
- multi-select targets
- add one tag to many targets
- remove one tag from many targets

Bulk editing should use native contextual patterns:
- toolbar actions
- context menu actions
- lightweight sheets when needed

It should not rely on per-row buttons.

## Tag Manager Rule

Tag-definition editing belongs in a separate management surface, not permanently in the main page body.

The native-first pattern is:
- `Manage Tags…` opens a sheet
- left side = tag list
- right side = name/description editor
- destructive delete requires confirmation

The main `Layout` page should remain focused on target-level assignment, not tag-definition administration.

## Persistence Rule

Layout tag metadata is project-owned durable data.

Initial native storage contract:
- `<project-folder>/layout/layout-metadata.json`

This file owns:
- tag definitions
- target-to-tag assignments

Reason:
- it keeps the metadata inside the project workspace
- it allows project creation with migration to carry metadata forward naturally when the project folder is copied
- it keeps xLightsDesigner metadata separate from xLights layout structure

## Migration Rule

When a new project is created with metadata migration from an existing project:
- the migrated project should inherit the layout metadata file
- the new `Layout` screen should then expose any targets that no longer match the new show as review work

The first native tagging slice does not need full mismatch reconciliation logic yet.
It does need the metadata to be project-owned so that later reconciliation is possible.

## Agent Rule

The native workflow must support both:
- user-authored tags
- agent-authored tags

The first native slice may expose only user-driven controls.
The storage and screen model must not prevent later agent-driven tagging proposals or apply actions.

## First Implementation Slice

The first real native `Layout` tagging slice must include:
1. project-owned tag store
2. target table with tag summary column
3. multi-selection support
4. `Add Tag…` action for selected targets
5. `Remove Tag…` action for selected targets
6. `Manage Tags…` sheet
7. selected-target inspector showing assigned tags clearly

The first slice does not need:
- advanced assignment editing
- tag suggestions from the agent
- mismatch reconciliation automation
- complex bulk rules beyond add/remove tag

## Non-Goals

Do not make `Layout` into:
- a read-only xLights viewer
- a busy metadata console
- a global settings page
- a sequence/design dashboard

## Acceptance Criteria

The native `Layout` screen is on the right path when:
1. a user can select one or many targets
2. a user can add one existing or new tag across the selection
3. a user can remove a tag across the selection
4. a user can rename a tag once and see that reflected everywhere
5. a user can store an optional description on a tag
6. the page remains readable without excessive inline buttons or repeated panels
