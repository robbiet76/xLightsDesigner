# Temporary Testing Changes Register

Purpose: Track temporary changes made only to support debugging/validation so they are visible and easy to revert.

Hard rule: Permanent xLights changes remain limited to `xLightsAutomations.cpp` and `xLights/automation/api/*`.
Risk note: Non-API xLights source edits can break unrelated production workflows. Full xLights regression is not available in this project, so every exception must be explicitly risk-assessed and reverted unless approved.

## Entry Format
- Date:
- Owner:
- Work package / task:
- Reason:
- Files touched:
- Temporary change summary:
- Potential side effects / blast radius:
- Validation performed:
- Regression evidence available:
- Revert plan:
- Revert deadline:
- Status: `OPEN` | `REVERTED`

## Entries
None currently.
