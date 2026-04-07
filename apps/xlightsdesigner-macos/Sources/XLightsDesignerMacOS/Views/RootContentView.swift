import SwiftUI

struct RootContentView: View {
    @Bindable var model: AppModel

    var body: some View {
        HSplitView {
            NavigationSplitView {
                AppSidebar(model: model)
                    .frame(minWidth: 230, idealWidth: 240, maxWidth: 280)
            } detail: {
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
                default:
                    WorkflowPlaceholderView(workflow: model.selectedWorkflow)
                }
            }
            .frame(minWidth: 700, minHeight: 780)

            if model.showAssistantPanel {
                AssistantWindowView(appModel: model, model: model.assistantModel)
                    .frame(minWidth: 320, idealWidth: 360, maxWidth: 440)
            }
        }
        .frame(minWidth: 1180, minHeight: 780)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button {
                    model.showAssistantPanel.toggle()
                } label: {
                    Label(model.showAssistantPanel ? "Hide Assistant" : "Show Assistant", systemImage: "bubble.left.and.bubble.right")
                }
            }
        }
        .sheet(isPresented: $model.showSettings) {
            SettingsPlaceholderView()
                .padding(24)
                .frame(width: 520, height: 320)
        }
    }
}
