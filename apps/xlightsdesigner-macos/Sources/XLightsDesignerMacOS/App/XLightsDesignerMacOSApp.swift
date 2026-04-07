import AppKit
import SwiftUI

@main
struct XLightsDesignerMacOSApp: App {
    @State private var model = AppModel()

    init() {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    var body: some Scene {
        WindowGroup {
            NavigationSplitView {
                AppSidebar(model: model)
                    .frame(minWidth: 220)
            } detail: {
                switch model.selectedWorkflow {
                case .audio:
                    AudioScreenView(model: model.audioScreenModel)
                default:
                    WorkflowPlaceholderView(workflow: model.selectedWorkflow)
                }
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
