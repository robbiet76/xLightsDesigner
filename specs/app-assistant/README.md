# App Assistant Specs

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-05

Active specifications for the unified conversational shell that spans project setup, audio analysis guidance, metadata setup, designer collaboration, and sequencing workflow routing.

The intended UX is a team chat:
- one shared conversation thread
- `app_assistant` as the coordinating shell
- visible specialist speaker identity when work is delegated
- optional user-defined nicknames for specialists
- routing based on workflow context, not only on who the user addressed by name

## Active Entry Points
- `app-assistant-role-and-boundary.md`
- `agent-model-selection-policy-2026-04-26.md`
- `implementation-checklist.md`


Current role in the app plan:
- coordinate the unified chat shell
- route to specialists without absorbing specialist domain logic
- preserve clean boundaries between audio, design, sequencing, and app coordination
