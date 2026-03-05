# Desktop Architecture Implementation Checklist

Status: Active  
Date: 2026-03-05  
Source of truth: `standalone-app-requirements.md` section "Locked Desktop Architecture Decision (2026-03-05)"

## M0) Architecture Freeze + Contract Alignment
- [ ] Decision is reflected in all relevant specs (standalone requirements, interaction contract, backlog).
- [ ] Delivery model is explicitly "single packaged desktop app, no side runtime installs for users".
- [ ] Canonical desktop bridge contract is documented (`openFileDialog`, storage/file APIs as needed).
- [ ] Compatibility gate policy is locked (`xLights 2026.1+`, mutate-block on incompatibility).
- [ ] Rollout policy is locked (macOS first, signed packages, updater required before broad rollout).

Acceptance:
- [ ] No conflicting deployment statements remain in active specs.

## M1) Runtime Host + Packaging Skeleton
- [ ] Desktop host runtime project exists in-repo and launches the UI reliably.
- [ ] Preload/bridge boundary is implemented (no Node access in renderer).
- [ ] Startup health checks run (runtime, endpoint reachability, compatibility status).
- [ ] Dev command starts app with minimal operator steps.
- [ ] Build command produces local distributable artifact (pre-signing phase allowed).

Acceptance:
- [ ] App launches as desktop shell and supports Browse dialog via bridge.

## M2) Persistent Storage + Filesystem Integration
- [ ] App state abstraction supports per-user app config storage (not browser-only localStorage as final path).
- [ ] Sequence sidecar metadata file lifecycle implemented (read/create/update).
- [ ] Sequence-scoped Designer media folder lifecycle implemented.
- [ ] Reference media is physically persisted/copied per policy (not metadata-only).
- [ ] Version checkpoints/backups are persisted per sequence before apply.

Acceptance:
- [ ] Restarting app preserves project/sequence context from disk-backed storage.
- [ ] Sidecar metadata survives across sessions and host restarts.

## M3) Compatibility + Safety Hardening
- [ ] Version/capability checks run at startup and when xLights version changes.
- [ ] Mutating actions are blocked with actionable UX when compatibility fails.
- [ ] Plan-only degraded mode is enforced when xLights is unavailable.
- [ ] Apply flow remains validate-first, with deterministic rollback path.
- [ ] Diagnostics bundle export path is implemented for support cases.

Acceptance:
- [ ] Incompatible xLights never receives mutating commands from Designer.
- [ ] Degraded mode remains usable for planning/chat/metadata drafting.

## M4) Distribution + Rollout Readiness
- [ ] macOS signed distributable pipeline is implemented.
- [ ] Installer/app bundle can be installed and launched by non-dev users.
- [ ] Update channel strategy is implemented/documented.
- [ ] Release runbook includes compatibility matrix validation steps.
- [ ] Smoke suite includes install -> launch -> connect -> open -> apply -> rollback.

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
