import SwiftUI

struct AppSidebar: View {
    @Bindable var model: AppModel

    var body: some View {
        List(selection: $model.selectedWorkflow) {
            Section("Workflows") {
                ForEach(WorkflowID.allCases) { workflow in
                    workflowRow(for: workflow)
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

    @ViewBuilder
    private func workflowRow(for workflow: WorkflowID) -> some View {
        let recommended = WorkflowID.preferredWorkflow(for: model.currentWorkflowPhase().phaseID)
        let isRecommended = workflow == recommended
        let isSelected = workflow == model.selectedWorkflow

        HStack(spacing: 10) {
            Label(workflow.rawValue, systemImage: iconName(for: workflow))
            Spacer(minLength: 8)
            if isRecommended && !isSelected {
                Text("Current Phase")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.18))
                    .clipShape(Capsule())
            }
        }
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
