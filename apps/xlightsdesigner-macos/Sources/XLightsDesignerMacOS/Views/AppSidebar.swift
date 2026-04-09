import SwiftUI

struct AppSidebar: View {
    @Bindable var model: AppModel

    var body: some View {
        List(selection: $model.selectedWorkflow) {
            Section("Workflows") {
                ForEach(WorkflowID.allCases) { workflow in
                    Label(workflow.rawValue, systemImage: iconName(for: workflow))
                        .tag(workflow)
                }
            }

            Section("App") {
                Button {
                    model.showSettings = true
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
                .buttonStyle(.plain)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("xLightsDesigner")
    }

    private func iconName(for workflow: WorkflowID) -> String {
        switch workflow {
        case .project:
            return "folder"
        case .display:
            return "square.grid.3x3"
        case .audio:
            return "waveform"
        case .design:
            return "paintbrush"
        case .sequence:
            return "slider.horizontal.3"
        case .review:
            return "checkmark.circle"
        case .history:
            return "clock.arrow.circlepath"
        }
    }
}
