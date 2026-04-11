# Hybrid Cloud Learning And Billing

Status: Draft
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Define the recommended hybrid architecture for:
- local app execution
- centralized shared learning
- per-user preferences
- billing and cost ownership

This spec exists to prevent the product from drifting into a fully local silo or an over-centralized cloud architecture too early.

## Product Goal

The product should improve across users over time.

That means:
- sequence-learning artifacts should not live only inside one local app install
- global design/sequencing knowledge should be centrally accumulated
- individual user preferences should be account-scoped
- local app performance should still remain strong and not depend on constant cloud round-trips

## Core Decision

Use a hybrid architecture.

### Local app owns
- xLights integration
- project workspace
- current sequence state
- local editing and sequencing actions
- temporary render outputs
- temporary preview reconstruction caches
- offline-first operational responsiveness

### Cloud owns
- user accounts
- user preference profiles
- shared learning corpus
- training/evaluation records
- centralized artifact metadata
- global retrieval bundles and model packs
- versioned learning outputs for distribution back to clients

## Why This Split Is Correct

A fully local architecture fails because:
- improvements do not compound across users
- training corpora become fragmented
- model iteration becomes hard to manage
- every machine becomes a separate silo

A fully cloud-driven architecture fails early because:
- xLights is local and stateful
- latency would hurt the user workflow
- sequencing and preview workflows need local responsiveness
- the product would become operationally heavy too soon

The hybrid split is the practical middle ground.

## Knowledge Categories

There are four different knowledge/storage domains.

### 1. Global product knowledge
Shared across the product.

Examples:
- design-language retrieval packs
- sequencer effect/use recommendations
- critique heuristics
- surrogate render models
- canonical evaluation bundles

Recommended home:
- cloud

### 2. Global structured corpora
Used to improve the product over time.

Examples:
- render observations
- prediction-vs-truth comparisons
- critique labels
- design handoffs
- sequence-learning records

Recommended home:
- cloud

### 3. User preference knowledge
Specific to one user or account.

Examples:
- taste profile
- preferred pacing and density
- favorite focal strategies
- preferred palette tendencies
- restraint vs spectacle bias

Recommended home:
- cloud account storage with local cache

### 4. Project-local working state
Operational state for the current job.

Examples:
- project mission
- display metadata
- sequence work in progress
- current local preview caches
- unsynced artifacts

Recommended home:
- local first
- optional selective sync later

## Billing Principle

Users should pay for their own model usage.

The product should not initially absorb open-ended LLM inference costs on behalf of users.

That means the recommended early billing model is:
- bring your own model key for LLM/API usage
- hosted subscription for cloud learning/sync/account features

## Recommended Initial Billing Model

### 1. Bring your own LLM key
User provides their own provider key.

Pros:
- model cost belongs directly to the user
- avoids cash-flow risk
- avoids uncertain AI margin calculations
- simplifies product launch economics

Cons:
- slightly more setup friction
- less turnkey than fully managed AI billing

This is acceptable and preferable early.

### 2. Hosted subscription for cloud value
Charge users for the hosted product value you operate.

Examples of hosted value:
- account sync
- cloud preference storage
- centralized shared learning
- access to improved retrieval/model packs
- evaluation history and review bundles

This is the correct place for recurring product revenue early.

## Future Billing Options

### Option A: Stay BYO key long term
Pros:
- lowest financial risk
- easiest to operate

Cons:
- more setup friction
- less bundled experience

### Option B: Prepaid credits
Pros:
- lets you manage usage without open-ended exposure
- easier than month-end overage for early SaaS

Cons:
- more billing/product complexity

### Option C: Subscription plus metered overage
Pros:
- best polished SaaS experience
- aligns cost and usage more directly

Cons:
- requires strong metering and abuse controls
- higher financial exposure if usage estimates are wrong

Recommended order:
1. BYO key
2. optionally add credits
3. only later consider managed overage billing

## Hosting Recommendation

Use a simple cloud stack early.

### Recommended MVP stack

#### Auth + metadata database
- Supabase

Use for:
- authentication
- account records
- user preference tables
- project metadata
- artifact metadata
- sync status

#### Artifact object storage
- Cloudflare R2

Use for:
- learning records
- critique bundles
- preview scene tensors
- render observation artifacts
- model/retrieval pack files

#### Worker/API layer
- Railway or similar simple hosted worker platform

Use for:
- upload processing
- artifact normalization
- pack generation jobs
- sync APIs
- future lightweight evaluation jobs

### Why this stack
It is simple enough for MVP and does not force early infrastructure overbuild.

## Cost Ownership

### Costs you pay initially
- auth/database hosting
- object storage
- worker/API hosting
- monitoring/backups
- internal evaluation/training pipeline costs

### Costs users pay initially
- LLM provider usage through their own API keys

This is the safest launch model.

## Data Flow Model

### Local to cloud
The app should upload structured learning artifacts, not blindly mirror entire projects.

Examples of uploadable artifacts:
- sequence learning records
- prediction-vs-truth comparisons
- render observations
- critique bundles
- user preference updates

### Cloud to local
The cloud should distribute:
- updated retrieval packs
- updated surrogate models
- updated evaluation bundles
- user profile snapshots

This keeps the app fast while still benefiting from centralized learning.

## Privacy And Consent

Do not assume that all project data should be uploaded.

Recommended policy:
- private project files stay local by default
- structured learning uploads are explicit and policy-driven
- user preference storage is tied to account consent
- training/evaluation uploads should be versioned and attributable

This matters because show assets and sequence work may be private.

## Local Cache Policy

Even with cloud knowledge, the app should cache locally:
- current user profile snapshot
- current retrieval pack versions
- active surrogate model pack
- recent project-scoped learning artifacts

This keeps the app responsive and resilient.

## Product Evolution Path

### Phase 1
- local app execution
- BYO LLM key
- cloud auth + metadata + artifact storage
- upload/download of versioned learning artifacts

### Phase 2
- central retrieval pack generation
- user preference-aware personalization
- shared model/retrieval updates distributed back to clients

### Phase 3
- optional managed credits or metered usage
- centralized training pipelines
- stronger cloud-side evaluation services

## Recommendation

Adopt the hybrid model now as the target architecture.

Specifically:
- keep execution local
- keep xLights integration local
- move durable learning to the cloud
- store user preferences in cloud accounts with local cache
- use BYO model keys initially so users pay for their own usage
- charge hosted subscription for the cloud product value

This is the most practical structure for:
- compounding improvement across users
- manageable costs
- future SaaS growth
- preserving local responsiveness
