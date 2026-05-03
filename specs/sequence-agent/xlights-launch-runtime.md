# xLights Launch Runtime

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-05-03

## Purpose

Define the reliable launch and readiness contract for the owned xLights runtime used by xLightsDesigner.

## Product Requirement

xLightsDesigner must connect to exactly one known-compatible xLights runtime, prove that the owned API surface is available, and keep show-folder, sequence, render, and modal state observable before app workflows depend on it.

Launch success means more than "a process exists." The runtime is usable only when:

- the expected xLights app identity and version are known
- the owned API listener is reachable on the configured port
- `/health` reports `state=ready`
- modal state is observed and not blocked
- required route probes pass for the workflow being started
- xLights can read and write the selected show folder through its own filesystem access model

## Canonical Launch Path

Production should not discover arbitrary local debug builds. The app should launch a configured, packaged, or explicitly selected xLights binary. Developer scripts may use debug builds, but they must record the exact app path, version, route probe result, and launch evidence.

The app should prefer this sequence:

1. Start xLights in noninteractive Designer mode.
2. Wait for owned API health to become ready.
3. Probe required routes and version/capability data.
4. Switch the show folder through `media.setShowDirectory`.
5. Refresh display and sequence context from the owned API.

Passing a show folder through command-line `-s` should be a fallback for controlled validation only. It happens before the owned API exists, so any prompt, permission failure, or show-folder validation failure cannot be represented by `/health`.

Developer validation may use an accessible bootstrap show folder to satisfy xLights startup before the owned API exists, then switch to the real target show folder through the API:

```bash
node scripts/xlights/launch-owned-xlights.mjs \
  --app <xLights.app> \
  --bootstrap-show-dir auto \
  --api-show-dir <target-show-folder>
```

`--bootstrap-show-dir auto` creates or refreshes a minimal show folder under the xLights container. `--show-dir` remains the direct pre-API startup path for legacy validation cases. New validation should prefer `--bootstrap-show-dir auto` plus `--api-show-dir` when testing real show-folder switching or macOS access failures.

## Show Folder Access

xLightsDesigner may know a show-folder path, but xLights must also have permission to access it. On macOS sandboxed builds, a path supplied by command-line argument or environment variable is not enough to grant filesystem access.

The durable product solution must make xLights show-folder access explicit:

- user selection or a security-scoped bookmark must be obtained by xLights or passed through a supported bridge
- access failure must be reported as a structured runtime/setup issue, not as a generic launch crash
- validation fixtures outside the xLights sandbox should not be treated as proof that production show-folder access is solved
- container-local fixtures are useful for API smoke tests but do not validate real user folder access

## Modal Policy

Automation must fail closed on unknown modals. Safe automatic handling is limited to startup informational dialogs that are explicitly known to be non-destructive. Save/discard choices require either a noninteractive policy supplied by xLightsDesigner or a user-facing recovery step.

Prompts that occur before `InitializeDesignerIntegration` cannot be observed through the owned API. These must be removed from the noninteractive startup path inside xLights, or moved after the API is available and represented in `/health.modalState`.

## Runtime Readiness

`/health` is the runtime gate. Consumers should not mutate xLights until:

- `listenerReachable=true`
- `appReady=true`
- `startupSettled=true`
- `state=ready`
- `modalState.observed !== false`
- `modalState.blocked !== true`

Route-level readiness must be probed separately. A build that exposes `/health` but lacks `layout.getSubmodels`, `layout.getModelNodes`, or `media.setShowDirectory` is not valid for display-understanding workflows.

## Diagnostics

Every launch attempt should capture:

- launched app path and binary path
- xLights version/build date when available
- effective Designer environment flags
- owned API health snapshots
- xLights stdout/stderr log tail
- xLights spdlog tail
- Designer diagnostic log tail
- latest crash report path when one exists after launch start
- required route probe status

Launcher scripts should include this evidence in failure output so failures can be classified without rerunning.

## Current Audit Findings

- Multiple 2026.07 binaries are present locally with different owned API surfaces. DerivedData auto-selection can silently choose a different runtime between runs.
- The App Store `/Applications/xLights.app` reports 2026.07 but does not behave as the patched noninteractive owned API runtime.
- The older runnable debug build can expose `/health` but may lack newer layout routes such as `/layout/submodels` and `/layout/model-nodes`.
- The rebuilt source app suppresses the pre-frame command-line information dialog, but exits when xLights cannot establish the requested show folder. The spdlog evidence indicates show-folder access/validation failure rather than an unexplained crash.
- Command-line `-s` is brittle for real user folders because it runs before API health and before any structured modal reporting.
- Launching with a sandbox-accessible bootstrap show folder and switching to the target show folder through `/media/show-directory` works for bookmarked folders. Unbookmarked folders now fail as structured `SHOW_DIRECTORY_ACCESS_DENIED` responses instead of being misclassified as startup crashes.

## Target Fixes

1. Remove implicit DerivedData runtime selection from production paths.
2. Add a route/version preflight gate before display refresh or sequencing validation.
3. Make show-folder access an explicit xLights-owned setup step, including macOS security-scoped access.
4. Prefer API show-folder switching after readiness over pre-frame `-s`.
5. Keep pre-frame prompts suppressed or converted into structured startup state in noninteractive mode.
6. Treat "legacy listener only" and "partial owned API" as hard incompatibility, not degraded success.
