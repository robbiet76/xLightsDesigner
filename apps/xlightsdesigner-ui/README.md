# xLightsDesigner Shared JS

Status: Mixed, Native-First

This directory contains shared JS domain/runtime/agent code used by tests, tooling, and native-app integration.

## Active Areas

Still active and shared:
- `agent/`
- much of `runtime/`
- `eval/`
- relevant tests

## Rules

- keep adding current agent/runtime/domain work only where it is genuinely shared
- do not reintroduce a standalone desktop/web product shell here
- before deleting mixed runtime files, confirm they are not still feeding scripts or tests

Primary references:
- `../../specs/app-ui/native-app.md`
- `../../specs/app-ui/platform-and-services.md`
