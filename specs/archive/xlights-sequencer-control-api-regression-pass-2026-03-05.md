# API Regression Pass: Harness Suites 01..11

Date: 2026-03-05
Result: PASS
Runner: `scripts/xlights-control/run-all.sh`

## Execution
- Command:
  - `cd /Users/robterry/Projects/xLightsDesigner/scripts/xlights-control && ./run-all.sh`
- Report output directory:
  - `/tmp/xlights-control-reports/20260305-143733`
- Summary JSON:
  - `/tmp/xlights-control-reports/20260305-143733/run-all-summary.json`

## Outcome
- `passed: true`
- Suites passing:
  - `01-discovery-smoke`
  - `02-sequence-lifecycle-smoke`
  - `03-sequencer-mutation-smoke`
  - `04-validation-gate-smoke`
  - `05-legacy-regression-smoke`
  - `06-effects-definition-smoke`
  - `07-transactions-smoke`
  - `08-plan-execution-smoke`
  - `09-async-jobs-smoke`
  - `10-revision-conflict-smoke`
  - `11-diagnostics-smoke`

## Notes
- Initial non-escalated shell runs could not reach localhost xLights endpoint due environment/sandbox restrictions.
- Final PASS was obtained by running the same harness command with elevated local execution context.
