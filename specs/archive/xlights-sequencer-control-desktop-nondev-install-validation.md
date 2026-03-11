# Desktop Non-Dev Install Validation (macOS)

Status: Pending execution
Date: 2026-03-05

## Goal
Validate that a non-developer user can install and launch xLightsDesigner desktop app without local dev tooling.

## Preconditions
- Candidate artifact from desktop build pipeline (`.zip` containing `.app`).
- Target machine/user account without repository checkout and without Node/Electron setup.
- xLights installed in `/Applications`.

## Validation Steps
1. Download artifact from release/channel distribution point.
2. Unzip artifact.
3. Drag `xLightsDesigner.app` to `/Applications`.
4. Launch app from Applications.
5. Confirm app starts without developer terminal commands.
6. In app, set endpoint and run `Test Connection`.
7. Open a known `.xsq` sequence.
8. Generate proposal and apply one safe change.
9. Restore from last backup.
10. Quit and relaunch app; verify persisted app state loads.

## Pass/Fail Criteria
- PASS when all steps succeed without requiring Node/npm/electron commands.
- FAIL if launch/install requires developer intervention or critical flow breaks.

## Evidence Template
- Build SHA:
- Artifact name:
- Test machine/macOS version:
- xLights version:
- Result:
- Notes:
- Diagnostics bundle path (if failed):
