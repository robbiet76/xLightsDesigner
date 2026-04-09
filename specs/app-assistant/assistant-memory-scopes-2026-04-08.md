# Assistant Memory Scopes

Date: 2026-04-08  
Status: Locked for native implementation

## Purpose

Define the memory model for the native assistant so the system can preserve continuity without leaking the wrong assumptions across unrelated projects.

The core requirement is:

- preserve the feeling of an ongoing relationship with the agents
- keep memory useful and bounded
- avoid contaminating a new project with irrelevant prior creative assumptions

## Problem

A single global memory bucket is too coarse.

Examples:

- a cheerful Christmas show
- a scary Halloween show

These may share the same user and the same working style, but they should not automatically share the same creative assumptions, visual tone, or design language.

If memory is not separated cleanly, the assistant will:

- over-transfer style assumptions
- reapply project-specific conclusions too broadly
- make the user feel misread instead of understood

## Locked Memory Model

The assistant memory model is split into three scopes.

### 1. Conversation Memory

Purpose:

- preserve short-term continuity in the active thread

Examples:

- recent questions and replies
- current unresolved topics
- current turn-by-turn conversational context

Storage:

- desktop runtime conversation store

Notes:

- raw conversation is not the long-term source of truth
- it should be bounded and compacted over time

### 2. User Workflow Memory

Purpose:

- preserve stable information about how the user likes to work

Examples:

- prefers broad metadata first
- wants the chat to guide the workflow
- wants pages to act as confirmation rather than the primary control surface
- prefers concise guidance
- prefers fewer questions at once

Storage:

- desktop runtime user profile store

Transfer rule:

- this memory persists across projects

Restriction:

- this scope is for workflow/process preferences only
- it must not silently absorb creative/style preferences as though they are universally true

### 3. Project Memory

Purpose:

- preserve what the system has learned about a specific project/display/show

Examples:

- display-discovery transcript
- display-discovery candidate props
- confirmed layout/tagging conclusions
- project-specific design conventions
- project-specific sequencing conventions

Storage:

- project-owned files inside the project folder

Transfer rule:

- blank project: start clean
- migrated project: carry forward only the relevant project memory

## Explicit Non-Rule

The system must not treat all user “preferences” as globally reusable.

Examples of memory that should NOT automatically become global:

- prefers nostalgic Christmas warmth
- wants Halloween to feel aggressive and scary
- likes this project’s palette to stay red/white
- wants this show to be sparse and elegant

These are either:

- project-scoped creative preferences
- theme/show-family preferences
- sequence-local decisions

They should not be promoted into global workflow memory by default.

## Near-Term Implementation Rule

Until scoped creative memory exists as a separate layer:

- global memory must remain conservative
- only workflow/process preferences should be promoted there
- creative/style preferences should remain in project context or active conversation context

## Migration Rules

### Blank Project

- retain user workflow memory
- create empty project memory
- do not carry display-discovery or project-specific design memory forward

### Migrated Project

- retain user workflow memory
- migrate the relevant project memory
- do not migrate ephemeral session chatter

## Future Scoped Memory

Later versions may add a fourth scope:

### 4. Scoped Creative Memory

Purpose:

- preserve style/tone preferences that are reusable within a family of related work but not universal

Examples:

- Christmas style baseline
- Halloween style baseline
- house-show family conventions

Status:

- deferred

Until this exists, creative/style preferences should not be promoted into global workflow memory by default.

## Compaction Direction

Raw conversation should not grow forever.

Target model:

- short-term raw thread memory
- rolling conversation summary
- durable promoted memories in the correct scope

This document locks the scope boundaries first. Compaction strategy should conform to those boundaries.
