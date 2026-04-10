import SwiftUI

struct RootContentView: View {
    @Bindable var model: AppModel

    var body: some View {
        VStack(spacing: 0) {
            workflowPhaseHeader

            HSplitView {
                NavigationSplitView {
                    AppSidebar(model: model)
                        .frame(minWidth: 230, idealWidth: 240, maxWidth: 280)
                } detail: {
                    ZStack(alignment: .topTrailing) {
                        switch model.selectedWorkflow {
                        case .project:
                            ProjectScreenView(model: model.projectScreenModel)
                        case .display:
                            DisplayScreenView(model: model.displayScreenModel)
                        case .audio:
                            AudioScreenView(model: model.audioScreenModel)
                        case .design:
                            DesignScreenView(model: model.designScreenModel)
                        case .sequence:
                            SequenceScreenView(
                                model: model.sequenceScreenModel,
                                xlightsSessionModel: model.xlightsSessionModel,
                                sequenceSwitchUnsavedPolicy: model.settingsScreenModel.screenModel.safetyConfig.sequenceSwitchUnsavedPolicy
                            )
                        case .review:
                            ReviewScreenView(model: model.reviewScreenModel)
                        case .history:
                            HistoryScreenView(model: model.historyScreenModel)
                        }

                        if !model.showAssistantPanel {
                            Button {
                                model.showAssistantPanel = true
                            } label: {
                                Label("Show Team Chat", systemImage: "bubble.left.and.bubble.right")
                            }
                            .padding(.top, 24)
                            .padding(.trailing, 24)
                        }
                    }
                }
                .frame(minWidth: 700, minHeight: 780)

                if model.showAssistantPanel {
                    AssistantWindowView(appModel: model, model: model.assistantModel)
                        .frame(minWidth: 320, idealWidth: 360, maxWidth: 440)
                }
            }
        }
        .safeAreaPadding(.top, 8)
        .safeAreaPadding(.bottom, 12)
        .frame(minWidth: 1180, minHeight: 780)
        .sheet(isPresented: $model.showSettings) {
            SettingsScreenView(model: model.settingsScreenModel)
        }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.xlightsSessionModel.refresh()
        }
    }

    private var workflowPhaseHeader: some View {
        let phase = model.currentWorkflowPhase()
        return HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Current Phase")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("\(phase.phaseID.title) • \(phaseOwnerTitle(for: phase.ownerRole))")
                    .font(.caption)
                    .fontWeight(.semibold)
            }

            WorkflowPhaseChevronStrip(currentPhase: phase.phaseID)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(nsColor: .windowBackgroundColor))
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    private func phaseOwnerTitle(for roleID: String) -> String {
        switch roleID {
        case "app_assistant":
            return "App Assistant"
        case "designer_dialog":
            return "Designer"
        case "audio_analyst":
            return "Audio Analyst"
        case "sequence_agent":
            return "Sequencer"
        default:
            return "Team"
        }
    }
}

private struct WorkflowPhaseChevronStrip: View {
    let currentPhase: WorkflowPhaseID

    var body: some View {
        let currentIndex = WorkflowPhaseID.allCases.firstIndex(of: currentPhase) ?? 0
        return HStack(spacing: 0) {
            ForEach(Array(WorkflowPhaseID.allCases.enumerated()), id: \.element.rawValue) { index, phase in
                Text(phase.title)
                    .font(.caption2)
                    .fontWeight(index == currentIndex ? .semibold : .regular)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.leading, index == 0 ? 10 : 16)
                    .padding(.trailing, 16)
                    .padding(.vertical, 7)
                    .background(
                        WorkflowChevronShape(
                            isLeadingEdge: index == 0,
                            isTrailingEdge: index == WorkflowPhaseID.allCases.count - 1
                        )
                        .fill(background(for: phase, currentIndex: currentIndex, index: index))
                    )
                    .overlay(
                        WorkflowChevronShape(
                            isLeadingEdge: index == 0,
                            isTrailingEdge: index == WorkflowPhaseID.allCases.count - 1
                        )
                        .stroke(stroke(for: phase, currentIndex: currentIndex, index: index), lineWidth: 1)
                    )
                    .foregroundStyle(foreground(for: phase, currentIndex: currentIndex, index: index))
                    .zIndex(index == currentIndex ? 2 : 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private func background(for phase: WorkflowPhaseID, currentIndex: Int, index: Int) -> Color {
        if phase == currentPhase {
            return Color.accentColor.opacity(0.28)
        }
        if index < currentIndex {
            return Color.green.opacity(0.20)
        }
        return Color(nsColor: .controlBackgroundColor).opacity(0.95)
    }

    private func foreground(for phase: WorkflowPhaseID, currentIndex: Int, index: Int) -> Color {
        if phase == currentPhase {
            return .primary
        }
        if index < currentIndex {
            return .green
        }
        return .secondary
    }

    private func stroke(for phase: WorkflowPhaseID, currentIndex: Int, index: Int) -> Color {
        if phase == currentPhase {
            return Color.accentColor.opacity(0.6)
        }
        if index < currentIndex {
            return Color.green.opacity(0.45)
        }
        return Color(nsColor: .separatorColor)
    }
}

private struct WorkflowChevronShape: Shape {
    let isLeadingEdge: Bool
    let isTrailingEdge: Bool

    func path(in rect: CGRect) -> Path {
        let tip = min(rect.width * 0.12, 14)
        let inset = isLeadingEdge ? 0 : tip

        var path = Path()
        path.move(to: CGPoint(x: inset, y: rect.minY))
        if !isTrailingEdge {
            path.addLine(to: CGPoint(x: rect.maxX - tip, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX - tip, y: rect.maxY))
        } else {
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        }
        path.addLine(to: CGPoint(x: inset, y: rect.maxY))
        if !isLeadingEdge {
            path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        }
        path.closeSubpath()
        return path
    }
}
