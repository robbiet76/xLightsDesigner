import SwiftUI

struct RootContentView: View {
    @Bindable var model: AppModel

    var body: some View {
        HSplitView {
            NavigationSplitView {
                AppSidebar(model: model)
                    .frame(minWidth: 230, idealWidth: 240, maxWidth: 280)
            } detail: {
                VStack(spacing: 0) {
                    if !model.showAssistantPanel {
                        HStack {
                            Spacer()
                            Button {
                                model.showAssistantPanel = true
                            } label: {
                                Label("Show Assistant", systemImage: "bubble.left.and.bubble.right")
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 12)
                        .padding(.bottom, 8)
                    }

                    switch model.selectedWorkflow {
                    case .project:
                        ProjectScreenView(model: model.projectScreenModel)
                    case .layout:
                        LayoutScreenView(model: model.layoutScreenModel)
                    case .audio:
                        AudioScreenView(model: model.audioScreenModel)
                    case .design:
                        DesignScreenView(model: model.designScreenModel)
                    case .sequence:
                        SequenceScreenView(model: model.sequenceScreenModel)
                    case .review:
                        ReviewScreenView(model: model.reviewScreenModel)
                    case .history:
                        HistoryScreenView(model: model.historyScreenModel)
                    }
                }
            }
            .frame(minWidth: 700, minHeight: 780)

            if model.showAssistantPanel {
                AssistantWindowView(appModel: model, model: model.assistantModel)
                    .frame(minWidth: 320, idealWidth: 360, maxWidth: 440)
            }
        }
        .frame(minWidth: 1180, minHeight: 780)
        .sheet(isPresented: $model.showSettings) {
            SettingsScreenView(model: model.settingsScreenModel)
        }
    }
}
