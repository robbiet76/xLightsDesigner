import SwiftUI

struct RootContentView: View {
    @Bindable var model: AppModel

    var body: some View {
        HSplitView {
            AppSidebar(model: model)
                .frame(width: model.sidebarCollapsed ? 72 : 250)

            VStack(spacing: 0) {
                workflowPhaseHeader
                workFocusBand

                HSplitView {
                    ZStack(alignment: .topTrailing) {
                        switch model.selectedWorkflow {
                        case .project:
                            ProjectScreenView(
                                model: model.projectScreenModel,
                                xlightsSessionModel: model.xlightsSessionModel
                            )
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
                    .frame(minWidth: 700, minHeight: 780)

                    if model.showAssistantPanel {
                        AssistantWindowView(appModel: model, model: model.assistantModel)
                            .frame(minWidth: 320, idealWidth: 360, maxWidth: 440)
                    }
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
        .onReceive(NotificationCenter.default.publisher(for: .projectArtifactsDidChange)) { _ in
            model.designScreenModel.refresh()
            model.sequenceScreenModel.refresh()
            model.reviewScreenModel.refresh()
            model.historyScreenModel.loadHistory()
            model.xlightsSessionModel.refresh()
        }
    }

    private var workflowPhaseHeader: some View {
        let phase = model.currentWorkflowPhase()
        return HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Current Workflow")
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

    private var workFocusBand: some View {
        let focus = model.currentWorkFocus()
        return HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(focus.label)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(focus.title.isEmpty ? "No active focus" : focus.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(1)
                if !focus.detail.isEmpty {
                    Text(focus.detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 12)

            HStack(spacing: 8) {
                focusStateChip(focus.state.rawValue, state: focus.state)
                ForEach(Array(focus.chips.prefix(4).enumerated()), id: \.offset) { _, chipText in
                    if !chipText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        focusChip(chipText)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .textBackgroundColor))
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    private func focusChip(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .lineLimit(1)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private func focusStateChip(_ text: String, state: PendingWorkState) -> some View {
        let tint: Color
        switch state {
        case .ready:
            tint = .green
        case .blocked:
            tint = .red
        case .partial:
            tint = .orange
        case .none:
            tint = .secondary
        }
        return Text(text)
            .font(.caption)
            .fontWeight(.medium)
            .lineLimit(1)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(tint.opacity(0.14))
            .foregroundStyle(tint)
            .clipShape(RoundedRectangle(cornerRadius: 6))
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
