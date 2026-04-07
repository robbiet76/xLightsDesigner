# macOS Native Assistant Surface (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native role and placement of the unified team chat / assistant surface in the macOS product.

This document exists to prevent the Electron chat shell from being copied forward without reconsidering its role in the native application.

Primary parent sources:
- `../app-assistant/app-assistant-role-and-boundary.md`
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`

## Rule

The native assistant surface is a shared support workspace.
It is not a primary workflow tab.

Working rules:
1. assistant/chat must remain outside the main workflow sidebar
2. assistant/chat must be available from anywhere in the app
3. assistant/chat must not displace screen-local summary and action regions
4. assistant/chat must preserve one coherent conversation across workflows

## Native Placement

The assistant should be implemented as a secondary utility surface.

Preferred order:
1. detachable utility window
2. dockable right-side assistant panel
3. sheet-based assistant only for limited focused tasks

Disallowed default:
- top-level workflow tab
- always-visible full-height global chat pane
- bottom bar that dominates the app shell

## Why It Is Not A Workflow Tab

The main workflow navigation is reserved for product phases:
- `Project`
- `Layout`
- `Audio`
- `Design`
- `Sequence`
- `Review`
- `History`

Team chat is cross-cutting help and coordination across those workflows.
Putting it in the main workflow navigation would blur the IA we just cleaned up.

## Functional Role

The native assistant surface owns:
- one shared app-wide conversation thread
- app-assistant routing and specialist visibility
- conversational guidance across workflows
- structured artifact summaries surfaced in conversational context

The native assistant surface does not own:
- the primary UI of any workflow screen
- workflow-local action bars
- screen-local summary/detail regions
- durable truth for project, audio, layout, sequence, review, or history data

## Context Rules

The assistant may display:
- active project name
- current workflow name
- selected item summary when explicitly relevant
- structured artifact references

The assistant must not replace:
- the local selected-item pane on `Audio`
- the local selected-target pane on `Layout`
- the pending implementation summary on `Review`

## First Native Implementation Recommendation

First native implementation should be:
1. a utility window opened from the app menu and toolbar
2. one persistent shared conversation thread
3. one compact context header:
   - active project
   - current workflow
   - optional focused item reference
4. one message thread
5. one composer

Do not build multi-pane specialist consoles in the first native slice.

## Interaction Rules

- opening the assistant must not navigate away from the current workflow
- closing the assistant must not discard the active conversation
- workflow changes may update assistant context hints, but must not reset the conversation
- messages may reference workflow state, but workflow screens remain authoritative for operational detail

## Persistence Rule

Conversation persistence remains an app-level state concern, not a workflow-screen concern.

The conversation thread should be durable across launches, but it must remain isolated from volatile screen state so that screen resets cannot erase chat history.

## Build Timing

The assistant surface should be built after the early native workflow slices are stable enough to provide useful context:
1. `Audio`
2. `Project + Layout`

It should not block the current native workflow cutover, but it should be designed now so it lands cleanly later.
