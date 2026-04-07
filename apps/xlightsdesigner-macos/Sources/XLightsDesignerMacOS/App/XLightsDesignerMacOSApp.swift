import AppKit
import SwiftUI

@main
struct XLightsDesignerMacOSApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            SettingsPlaceholderView()
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
