# High-Level Architecture: xLights + Local Agent + LLM

Status: Draft  
Date: 2026-02-26

## 1) Purpose
Define a deployment and responsibility model that keeps sequencing automation local, avoids centralized hosting requirements, and makes user billing ownership explicit.

## 2) Core Principle
`xLights` is the execution engine.  
The `local agent application` is the orchestration layer.  
The `LLM` is an optional external reasoning service chosen and paid for by the user.

## 3) System Components

### A) User
- Owns sequencing intent and approvals.
- Owns LLM account, API key, usage, and billing.
- Runs both xLights and agent app locally.

### B) xLights Application
- Source of truth for sequence data.
- Executes automation commands via local automation API.
- Performs rendering, timing/lyric track creation, and project mutations.

### C) Local Agent Application (xLightsDesigner)
- Runs on user machine (desktop app/CLI/local service).
- Handles planning, prompt construction, workflow orchestration, retries, and validation.
- Calls xLights automation API on localhost.
- Optionally calls user-selected LLM provider with user credentials.

### D) LLM Provider (Optional)
- External API used for analysis/reasoning.
- Receives requests directly from user’s local agent app.
- Billing relationship is between user and provider.

## 4) Runtime Relationship

1. User starts xLights locally.
2. User starts local agent app.
3. Agent app checks xLights capabilities.
4. Agent app may call LLM for analysis/planning.
5. Agent app sends structured commands to xLights (`apiVersion: 2`).
6. xLights applies changes and returns machine-readable results.
7. User reviews/edits in xLights.

## 5) Data Flow Boundaries

### Local Boundary
- Sequence files, media references, track edits, and automation command execution stay local.
- Local app state, logs, and non-cloud settings remain on device.

### External Boundary (Only if user enables LLM)
- Prompt payloads/results sent to chosen LLM provider.
- No mandatory project backend owned by product maintainer.

## 6) Responsibility Matrix

### User Responsibilities
- Provide and manage API credentials.
- Pay provider usage charges.
- Approve sequence changes.

### Product/Maintainer Responsibilities
- Ship local software and local API client behavior.
- Provide clear UX around external calls and token usage.
- Do not proxy or resell model usage by default.

### xLights Responsibilities
- Expose stable automation contract for sequence operations.
- Preserve backward compatibility for legacy automation users.

## 7) Billing and Usage Policy

- Default model: **BYO key (Bring Your Own API Key)**.
- Agent app stores user key locally (OS keychain/credential store).
- Requests are sent directly from local app to provider.
- Maintainer does not run centralized inference for end users.

## 8) Security and Privacy Expectations

- Credentials stored in secure local credential storage.
- No required cloud persistence of sequence data.
- Provide explicit “LLM enabled/disabled” toggle.
- Provide user-visible logs of outbound provider calls.

## 9) Deployment Model

- Primary: local desktop app (or local CLI + optional lightweight UI).
- Supported platforms: macOS/Windows/Linux.
- No required hosted control plane.

## 10) Extensibility

- Keep provider abstraction layer in local app (`OpenAI`, `Anthropic`, local model runtime, etc.).
- Keep xLights integration behind typed command client.
- Future plugin/embed options are optional packaging choices, not core architecture.

## 11) Non-Goals

- Building a shared multi-tenant SaaS for sequence generation.
- Centralized storage of user shows/media.
- Centralized billing aggregation.

## 12) Summary
This architecture keeps xLights automation practical and scalable:
- local execution for reliability and privacy,
- external LLM optional and user-owned,
- no obligation for maintainer-hosted inference or user billing operations.
