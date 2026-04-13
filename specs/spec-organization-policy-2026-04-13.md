# Spec Organization Policy

Status: Active
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define the current operating policy for spec cleanup without derailing sequencing work or creating a second active layer of overlapping documents.

## Current Decision

Spec organization is a bounded side track.

Primary track remains:
- sequencing quality
- sequencing feedback loop
- designer and sequencer handoff quality

We will improve spec organization now only enough to:
- keep active specs navigable
- reduce ambiguity about which docs are current
- avoid additive junk-drawer growth

We will not run a broad archive or full directory reorganization until the full spec corpus has been read and classified.

## Required Order

1. read the full spec corpus
2. classify each spec by domain, purpose, and lifecycle state
3. propose the target organization model from that full read
4. replace or consolidate specs only with explicit supersession
5. archive or remove old specs only after they are no longer referenced by active indexes

## Non-Negotiable Rules

1. do not create a new active spec on top of an old active spec for the same problem
2. every replacement must name what it supersedes
3. superseded specs must leave active indexes in the same pass
4. sequencing remains the main development line while the corpus audit is in progress
5. reorganization must be replacement-based, not additive

## Lifecycle States

- `Draft`
- `Active`
- `Superseded`
- `Archived`

Only `Active` specs belong in active indexes.

## Immediate Operating Model

For now:
- keep domain READMEs as the active entry points
- keep recent sequencing specs as the canonical sequencing operating set
- continue a bounded audit/classification pass before any large archival move

## Outcome

This policy keeps the spec set usable now without risking a broad rewrite that loses important context.
