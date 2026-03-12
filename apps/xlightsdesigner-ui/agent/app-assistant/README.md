# App Assistant Domain

The `app-assistant` domain is the unified conversational shell for xLightsDesigner.

It will sit above specialist agents:
- `audio-analyst`
- `designer-dialog`
- `sequence-agent`

Its job is to preserve one coherent chat experience across setup, analysis, design, and sequencing while delegating specialist work through explicit contracts.

The initial runtime slice now exists:
- session/result contracts
- chat orchestration over the desktop conversation bridge
- specialist route inference
- main chat ownership in the UI

Still open:
- bounded action contracts
- explicit shell session state
- training/eval assets
- richer artifact surfacing across delegated specialist work
