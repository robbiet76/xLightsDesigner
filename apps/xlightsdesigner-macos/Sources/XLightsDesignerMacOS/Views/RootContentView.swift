import SwiftUI

struct RootContentView: View {
    @Bindable var model: AppModel

    var body: some View {
        HSplitView {
            NavigationSplitView {
                AppSidebar(model: model)
                    .frame(minWidth: 220)
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
                default:
                    WorkflowPlaceholderView(workflow: model.selectedWorkflow)
                }
            }
            .frame(minWidth: 900, minHeight: 780)

            if model.showAssistantPanel {
                AssistantWindowView(appModel: model, model: model.assistantModel)
                    .frame(minWidth: 420, idealWidth: 460, maxWidth: 520)
            }
        }
        .frame(minWidth: 1280, minHeight: 780)
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
