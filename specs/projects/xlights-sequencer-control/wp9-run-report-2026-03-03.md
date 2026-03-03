# WP-9 Run Report (2026-03-03)

## Command
- `cd scripts/xlights-control && ./run-all.sh`

## Result
- Overall: `passed=true`
- Bootstrap: `enabled=false`, `passed=true`
- Suites: all green
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
- Harness now auto-launches xLights and opens the test sequence before running suites.
- Placeholder fixture-path defaults in the example env no longer block harness execution.
