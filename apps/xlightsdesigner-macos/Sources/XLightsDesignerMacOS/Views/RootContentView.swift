import SwiftUI

struct RootContentView: View {
    @Bindable var model: AppModel

    var body: some View {
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
            default:
                WorkflowPlaceholderView(workflow: model.selectedWorkflow)
            }
        }
        .frame(minWidth: 1180, minHeight: 780)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button {
                    NotificationCenter.default.post(name: .xldOpenAssistantWindow, object: nil)
                } label: {
                    Label("Assistant", systemImage: "bubble.left.and.bubble.right")
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
