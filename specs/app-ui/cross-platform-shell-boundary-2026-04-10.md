# Cross-Platform Shell Boundary (2026-04-10)

Status: Active
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Define the intended long-term boundary between:
- platform-native shells
- shared agent/domain/runtime logic
- platform bridge contracts

This is the target architecture that should guide cleanup and future Windows work.

## Core Decision

The app should converge on this structure:

1. native platform shells own operator UX
2. shared JS owns agent training, orchestration, and shell-neutral domain logic
3. platform bridges expose the same contracts to the shared layer
4. legacy Electron code should be removed only after its remaining useful logic is either:
   - extracted into the shared layer, or
   - reimplemented natively behind the same contract

## Target Topology

```text
+-----------------------------------------------------------------------------------+
|                         Platform-Native Shells                                    |
+-----------------------------------------------------------------------------------+
| macOS shell                         | future Windows shell                        |
| apps/xlightsdesigner-macos          | apps/xlightsdesigner-windows               |
| SwiftUI                             | native Windows UI stack                    |
+-----------------------------------------------------------------------------------+
| UI / navigation / page state / chat rendering / app-level actions / local stores |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | same bridge contract
                                          v
+-----------------------------------------------------------------------------------+
|                    Shared Agent / Domain / Runtime Layer                          |
|                          apps/xlightsdesigner-ui                                  |
+-----------------------------------------------------------------------------------+
| agent/      -> agent prompts, orchestration, training, contracts                 |
| runtime/    -> shared domain/runtime logic, helpers, evaluators                  |
| storage/    -> shell-neutral file/artifact/workspace helpers                     |
| eval/       -> scenario suites and validation harnesses                          |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     External services and durable data                            |
+-----------------------------------------------------------------------------------+
| xLights show folder | analysis service | project files | artifacts | renders     |
+-----------------------------------------------------------------------------------+
```

## What Must Stay Shared

These areas should remain outside any single native shell because they are expensive to duplicate and should behave the same on macOS and Windows.

### 1. Agent training and specialist logic

Keep in shared JS:
- `apps/xlightsdesigner-ui/agent/app-assistant`
- `apps/xlightsdesigner-ui/agent/audio-analyst`
- `apps/xlightsdesigner-ui/agent/designer-dialog`
- `apps/xlightsdesigner-ui/agent/sequence-agent`

This includes:
- prompt contracts
- routing/orchestration logic
- specialist output schemas
- phase-aware conversation behavior
- validation/eval scenarios

### 2. Shell-neutral domain runtime logic

Keep in shared JS when the logic is not UI-framework-specific:
- runtime evaluators
- sequence/design helper logic
- metadata/timing helpers
- shared domain transforms
- artifact shaping and shared output formatting

### 3. Shell-neutral storage helpers

Keep in shared JS when the storage logic can be used by multiple shells and tools:
- `analysis-artifact-store.mjs`
- `project-artifact-store.mjs`
- `project-workspace-store.mjs`

## What Must Stay Native

These areas are host-shell responsibilities and should not move into the shared JS layer.

### 1. Operator-facing UI

Each native shell owns:
- windowing
- navigation
- page layout
- phase header rendering
- chat rendering
- local interaction controls
- native settings surfaces

### 2. App-level state and action execution

Each native shell owns:
- selected page/workflow
- local view state
- native action execution
- bounded assistant action application
- app lifecycle and restart concerns

### 3. Platform integration

Each native shell owns:
- local file dialogs
- platform settings UI
- platform process launching
- platform-specific xLights/session hooks
- OS-specific persistence conveniences

## Bridge Contract Principle

The shared JS layer should not know or care whether the host shell is macOS or Windows.

The shell should provide a stable contract for:
- current app context
- current workflow phase
- selected workflow/page
- project/session state
- durable file access
- external operation requests
- bounded app action execution results

That means the long-term goal is not:
- “port the macOS app to Windows”

It is:
- “build a second native shell that speaks the same shared agent/domain contract”

## Practical Rule For Cleanup

When deciding whether code belongs in native or shared, use this test:

Move code to shared JS if:
- it is domain logic rather than UI logic
- it should behave identically on macOS and Windows
- it is useful to scripts/tests/evals outside the native shell
- it is not meaningfully tied to SwiftUI or AppKit

Keep code native if:
- it directly controls product UI
- it executes native app actions
- it is tied to local shell state or platform integration
- it is only meaningful inside the host app process

## Windows Readiness Assessment

Current position is good enough to proceed deliberately.

### Good signs

- native shell already separated from most agent logic
- shared JS already contains the specialist intelligence
- the current cleanup work is moving shell-neutral storage/domain logic out of Electron ownership
- phase/orchestration behavior is no longer macOS-UI-specific

### Remaining work before a Windows shell would be easy

- continue shrinking Electron-only bridge glue
- make remaining native-to-JS bridge contracts more explicit
- avoid duplicating shared orchestration in Swift
- keep durable file and artifact schemas stable across shells

## Recommended Direction

1. continue removing legacy Electron shell ownership
2. keep agent logic and shell-neutral runtime logic in shared JS
3. keep the macOS shell focused on host UX and host actions
4. design future Windows work as a second host implementation, not a second agent stack

## Non-Goals

Do not:
- rewrite specialist training logic into Swift
- move prompt/orchestration logic into platform-specific shells
- keep legacy Electron code alive just because it still works
- treat Windows support as blocked on deleting all legacy Electron code first

## Immediate Implication

The current cleanup program should continue targeting:
- Electron shell ownership
- not the shared agent/domain/runtime layer

That is the path that improves the macOS app now and preserves the best future path to Windows.
