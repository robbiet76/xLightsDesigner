import SwiftUI

@main
struct XLightsDesignerMacOSApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            NavigationSplitView {
                AppSidebar(model: model)
                    .frame(minWidth: 220)
            } detail: {
                WorkflowPlaceholderView(workflow: model.selectedWorkflow)
            }
            .frame(minWidth: 1100, minHeight: 760)
        }
        .commands {
            CommandGroup(after: .appInfo) {
                Button("Settings…") {
                    model.showSettings = true
                }
                .keyboardShortcut(",")
            }
        }

        Settings {
            SettingsPlaceholderView()
        }
    }
}
