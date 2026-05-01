# Platform Specs

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

Active specifications for platform-neutral boundaries and platform-specific app implementations.

## Current Specs

- `platform-and-services.md`: shared local-first platform and service boundary.
- `macos-app.md`: current macOS SwiftUI app implementation boundary.

## Rule

Keep the app workflow contract platform-neutral. Put OS-specific windowing, packaging, file picker, local process, and automation-hosting details in platform specs so future Windows or Linux implementations can share durable product behavior without copying macOS assumptions.
