# xLightsDesigner Shared JS Runtime

Status: Active Shared Runtime

This directory contains shared JS domain, runtime, agent, page-state, eval, and storage modules used by tests, tooling, and app-app integration.

## Active Areas

Active shared surfaces:
- `agent/`
- `runtime/`
- `app-ui/`
- `storage/`
- `eval/`
- `tests/`

## Rules

- keep adding current agent/runtime/domain work only where it is genuinely shared
- treat `app-ui/` as reusable page-state and screen-composition modules for the app, not as a standalone app surface
- do not reintroduce a standalone product surface here
- before deleting runtime files, confirm they are not still feeding scripts, tests, training packages, or app integration

Primary references:
- `../../specs/app-ui/app-workspace.md`
- `../../specs/platforms/platform-and-services.md`
