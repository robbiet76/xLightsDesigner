import AppKit
import SwiftUI

@main
struct XLightsDesignerMacOSApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            SettingsScreenView(model: appDelegate.model.settingsScreenModel)
        }
        .commands {
            CommandGroup(after: .appInfo) {
                Button("Settings…") {
                    appDelegate.model.showSettings = true
                }
                .keyboardShortcut(",")
            }
        }
    }
}
