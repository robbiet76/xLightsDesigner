import SwiftUI

struct AppSidebar: View {
    @Bindable var model: AppModel

    var body: some View {
        let isCollapsed = model.sidebarCollapsed
        VStack(spacing: 0) {
            sidebarHeader(isCollapsed: isCollapsed)

            List(selection: $model.selectedWorkflow) {
                Section(isCollapsed ? "" : "Workflows") {
                    ForEach(WorkflowID.allCases) { workflow in
                        workflowRow(for: workflow, isCollapsed: isCollapsed)
                            .tag(workflow)
                    }
                }

                Section(isCollapsed ? "" : "App") {
                    Button {
                        model.showSettings = true
                    } label: {
                        if isCollapsed {
                            Image(systemName: "gearshape")
                                .font(.system(size: 18, weight: .regular))
                                .foregroundStyle(Color.accentColor)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 6)
                        } else {
                            Label("Settings", systemImage: "gearshape")
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .listStyle(.sidebar)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func sidebarHeader(isCollapsed: Bool) -> some View {
        HStack(spacing: 8) {
            if isCollapsed {
                Button {
                    model.sidebarCollapsed = false
                } label: {
                    Image(systemName: "sidebar.left")
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .center)
            } else {
                Text("xLightsDesigner")
                    .font(.headline)
                Spacer()
                Button {
                    model.sidebarCollapsed = true
                } label: {
                    Image(systemName: "sidebar.left")
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, isCollapsed ? 8 : 12)
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private func workflowRow(for workflow: WorkflowID, isCollapsed: Bool) -> some View {
        let recommended = WorkflowID.preferredWorkflow(for: model.currentWorkflowPhase().phaseID)
        let isRecommended = workflow == recommended
        let isSelected = workflow == model.selectedWorkflow

        HStack(spacing: 10) {
            if isCollapsed {
                Image(systemName: iconName(for: workflow))
                    .font(.system(size: 18, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Color.white : Color.accentColor)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .overlay(alignment: .topTrailing) {
                        if isRecommended && !isSelected {
                            Circle()
                                .fill(Color.accentColor)
                                .frame(width: 8, height: 8)
                                .offset(x: 4, y: -4)
                            }
                    }
                    .padding(.vertical, 6)
            } else {
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
        .help(isCollapsed ? workflow.rawValue : "")
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
