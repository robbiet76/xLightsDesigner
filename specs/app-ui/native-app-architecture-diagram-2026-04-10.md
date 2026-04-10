# Native App Architecture Diagram (2026-04-10)

Status: Active
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Give a concrete view of how the current native app is structured across:
- SwiftUI shell and read models
- native services and stores
- shared JS agent/runtime layer
- external systems

This is the current practical architecture, not a future-state concept sketch.

## High-Level Diagram

```text
+--------------------------------------------------------------------------------------------------+
|                                     xLightsDesigner macOS App                                    |
|                         apps/xlightsdesigner-macos (active product shell)                        |
+--------------------------------------------------------------------------------------------------+
| Root Shell                                                                                        |
| AppModel | RootContentView | AppSidebar | Phase Header | AssistantWindowViewModel                |
+--------------------------------------------------------------------------------------------------+
        |                              |                               |
        |                              |                               |
        v                              v                               v
+-----------------------+   +------------------------------+   +-------------------------------+
| Workflow Screens      |   | Native State / Read Models  |   | Team Chat / Phase Control    |
| Project               |   | ProjectScreenViewModel       |   | AssistantConversationService |
| Display               |   | DisplayScreenViewModel       |   | AssistantExecutionService    |
| Audio                 |   | AudioScreenViewModel         |   | workflowPhase runtime state  |
| Design                |   | DesignScreenViewModel        |   | artifact cards               |
| Sequence              |   | SequenceScreenViewModel      |   | action requests              |
| Review                |   | ReviewScreenViewModel        |   +-------------------------------+
| History               |   | HistoryScreenViewModel       |
| Settings              |   | SettingsScreenViewModel      |
+-----------------------+   +------------------------------+
        |                              |
        +---------------+--------------+
                        |
                        v
+--------------------------------------------------------------------------------------------------+
|                                      Native Service Layer                                         |
| ProjectService | SettingsService | DisplayService | TrackLibraryService | XLightsSessionService  |
| AudioExecutionService | ReviewExecutionService | DisplayDiscoveryStateStore                      |
| ProjectDisplayMetadataStore | ProjectSessionStore | HistoryService | PendingWorkService         |
+--------------------------------------------------------------------------------------------------+
                        |
                        | invokes / reads / writes
                        v
+--------------------------------------------------------------------------------------------------+
|                                   Shared JS Agent / Runtime Layer                                 |
|                         apps/xlightsdesigner-ui (shared domain/runtime logic)                     |
+--------------------------------------------------------------------------------------------------+
| agent/                                                                                           |
| - app-assistant orchestrator                                                                     |
| - audio-analyst runtime                                                                          |
| - designer-dialog runtime                                                                        |
| - sequence-agent runtime                                                                         |
| runtime/                                                                                         |
| - orchestration helpers                                                                          |
| - project/history/review runtime modules                                                         |
| - metadata/timing helpers                                                                        |
| storage/                                                                                         |
| - analysis-artifact-store.mjs                                                                    |
| - project-artifact-store.mjs                                                                     |
+--------------------------------------------------------------------------------------------------+
                        |
                        | script bridge / subprocess / file contracts
                        v
+-------------------------------+    +--------------------------------+    +----------------------+
| Analysis Service             |    | xLights / Show Folder          |    | Durable Project Data |
| apps/xlightsdesigner-        |    | XLightsSessionService          |    | project file         |
| analysis-service             |    | sequence sidecars              |    | artifacts            |
| /analyze                     |    | backups / renders / metadata   |    | display metadata     |
+-------------------------------+    +--------------------------------+    | track library        |
                                                                             | agent config/state   |
                                                                             +----------------------+
```

## Ownership Rules

### 1. Native shell owns product UX

SwiftUI owns:
- page navigation
- phase header
- chat presentation
- view/view-model state
- app-level action execution

### 2. Native services own app-level storage and orchestration

Native services should:
- read and write durable project state
- coordinate xLights sessions
- invoke the shared JS assistant/runtime layer

Native services should not:
- duplicate specialist logic in Swift
- fork artifact schemas from the shared JS layer

### 3. Shared JS owns specialist logic and some shared storage contracts

Shared JS owns:
- assistant orchestration
- specialist runtime logic
- some cross-shell storage modules
- eval and simulation harnesses

Shared JS should not:
- act like the active app shell
- re-grow the legacy renderer UI as a product surface

### 4. Electron is no longer part of the active backend path

Electron is now:
- legacy reference shell
- legacy bridge host
- maintenance-only

It is not the architectural center anymore.

## Current Backend Shape In Plain Terms

The native app is not talking directly to the models for all logic.

The current stack is:
1. SwiftUI app manages the operator experience
2. native services gather context and persist native app state
3. when specialist reasoning is needed, native calls into shared JS orchestration
4. shared JS uses agent-specific contracts and runtime helpers
5. results come back to native for:
   - UI updates
   - phase state changes
   - artifact cards
   - durable writes

## Cleanup Implication

Because this is the current architecture:
- deleting Electron shell code is now realistic
- deleting shared JS is not realistic

The next cleanup target is old Electron shell ownership, not the shared JS domain/runtime layer.
