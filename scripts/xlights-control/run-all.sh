#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'MSG'
scripts/xlights-control/run-all.sh has been retired.

The current xLightsDesigner validation path is owned-API only. Use:

  node scripts/xlights/validate-owned-show-folder-flow.mjs --show-dir <show-folder>

Launch the API-enabled xLights 2026.06 build first, or use:

  node scripts/xlights/launch-owned-xlights.mjs --show-dir <show-folder> -o
  node scripts/xlights/wait-owned-xlights.mjs

The retired xlights-control suites target the legacy /xlDoAutomation listener,
system.executePlan, and transaction APIs. They are retained only as historical
fixtures until the remaining specs are archived or rewritten.
MSG

exit 2
