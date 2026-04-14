# xLightsDesigner Shared JS

Status: Mixed, Native-First

This directory is not one thing.
It contains both:
- active shared JS domain/runtime/agent code
- retired renderer shell residue from the Electron app

## Active Areas

Still active and shared:
- `agent/`
- much of `runtime/`
- `eval/`
- relevant tests

## Legacy Areas

Retirement targets:
- `app-ui/`
- `app.js`
- `index.html`
- `dev_server.py`

These are retired renderer shell surfaces from the Electron app.
Do not deepen product-shell investment there or add new Electron compatibility fallback.

## Rules

- keep adding current agent/runtime/domain work only where it is genuinely shared
- do not treat legacy renderer shell files as the active app shell
- before deleting mixed runtime files, confirm they are not still feeding scripts or tests

Primary references:
- `../../specs/app-ui/native-cutover-audit-2026-04-10.md`
- `../../specs/app-ui/electron-legacy-removal-manifest-2026-04-06.md`
