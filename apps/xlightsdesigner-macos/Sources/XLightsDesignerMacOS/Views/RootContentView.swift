import SwiftUI

struct RootContentView: View {
    @Bindable var model: AppModel

    var body: some View {
        HSplitView {
            AppSidebar(model: model)
                .frame(width: model.sidebarCollapsed ? 72 : 250)

            VStack(spacing: 0) {
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
        .onReceive(NotificationCenter.default.publisher(for: .projectShowFolderDidRelink)) { _ in
            model.refreshAll()
        }
        .onReceive(NotificationCenter.default.publisher(for: .projectArtifactsDidChange)) { _ in
            model.designScreenModel.refresh()
            model.sequenceScreenModel.refresh()
            model.reviewScreenModel.refresh()
            model.historyScreenModel.loadHistory()
            model.xlightsSessionModel.refresh()
        }
    }
}
