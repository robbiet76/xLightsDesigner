# Desktop Architecture Implementation Checklist

Status: Active  
Date: 2026-03-05  
Source of truth: `standalone-app-requirements.md` section "Locked Desktop Architecture Decision (2026-03-05)"

## M0) Architecture Freeze + Contract Alignment
- [x] Decision is reflected in all relevant specs (standalone requirements, interaction contract, backlog).
- [x] Delivery model is explicitly "single packaged desktop app, no side runtime installs for users".
- [x] Canonical desktop bridge contract is documented (`openFileDialog`, storage/file APIs as needed).
- [x] Compatibility gate policy is locked (`xLights 2026.1+`, mutate-block on incompatibility).
- [x] Rollout policy is locked (macOS first, signed packages, updater required before broad rollout).

Acceptance:
- [x] No conflicting deployment statements remain in active specs.

## M1) Runtime Host + Packaging Skeleton
- [x] Desktop host runtime project exists in-repo and launches the UI reliably.
- [x] Preload/bridge boundary is implemented (no Node access in renderer).
- [x] Startup health checks run (runtime, endpoint reachability, compatibility status).
- [x] Dev command starts app with minimal operator steps.
- [x] Build command produces local distributable artifact (pre-signing phase allowed).

Acceptance:
- [x] App launches as desktop shell and supports Browse dialog via bridge.

## M2) Persistent Storage + Filesystem Integration
- [x] App state abstraction supports per-user app config storage (not browser-only localStorage as final path).
- [x] Sequence sidecar metadata file lifecycle implemented (read/create/update).
- [x] Sequence-scoped Designer media folder lifecycle implemented.
- [x] Reference media is physically persisted/copied per policy (not metadata-only).
- [x] Version checkpoints/backups are persisted per sequence before apply.

Acceptance:
- [x] Restarting app preserves project/sequence context from disk-backed storage.
- [x] Sidecar metadata survives across sessions and host restarts.

## M3) Compatibility + Safety Hardening
- [x] Version/capability checks run at startup and when xLights version changes.
- [x] Mutating actions are blocked with actionable UX when compatibility fails.
- [x] Plan-only degraded mode is enforced when xLights is unavailable.
- [x] Apply flow remains validate-first, with deterministic rollback path.
- [x] Diagnostics bundle export path is implemented for support cases.

Acceptance:
- [x] Incompatible xLights never receives mutating commands from Designer.
- [x] Degraded mode remains usable for planning/chat/metadata drafting.

## M4) Distribution + Rollout Readiness
- [x] macOS signed distributable pipeline is implemented.
- [ ] Installer/app bundle can be installed and launched by non-dev users.
- [x] Update channel strategy is implemented/documented.
- [x] Release runbook includes compatibility matrix validation steps.
- [x] Smoke suite includes install -> launch -> connect -> open -> apply -> rollback.

Acceptance:
- [ ] User can install one app and complete core flow without side runtime/tool installs.

## Cross-Cut Quality Gates
- [ ] UI regressions: no loss of approved wireframe-v5 behavior.
- [ ] API regressions: existing harness suites remain passing.
- [ ] Temp debug/testing hooks are tracked and removed before release candidate.
- [ ] Docs remain synchronized (`README`, requirements, backlog, checklist statuses).

## Deferred (Explicitly Not In Initial Lock)
- [ ] Embedded-in-xLights plugin distribution path.
- [ ] Cross-machine collaborative editing/storage.
- [ ] Full cloud sync of learning profiles.
