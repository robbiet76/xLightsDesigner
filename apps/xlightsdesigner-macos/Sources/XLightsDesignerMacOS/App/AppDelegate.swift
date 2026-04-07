import AppKit
import SwiftUI

extension Notification.Name {
    static let xldOpenAssistantWindow = Notification.Name("xldOpenAssistantWindow")
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = AppModel()
    private var window: NSWindow?
    private var assistantWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NotificationCenter.default.addObserver(
            forName: .xldOpenAssistantWindow,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.openAssistantWindow()
            }
        }

        if window == nil {
            let contentView = RootContentView(model: model)
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
                styleMask: [.titled, .closable, .miniaturizable, .resizable],
                backing: .buffered,
                defer: false
            )
            window.title = "xLightsDesigner"
            window.center()
            window.contentView = NSHostingView(rootView: contentView)
            window.makeKeyAndOrderFront(nil)
            self.window = window
        }

        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    func openAssistantWindow() {
        if assistantWindow == nil {
            let contentView = AssistantWindowView(appModel: model, model: model.assistantModel)
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 560, height: 700),
                styleMask: [.titled, .closable, .miniaturizable, .resizable],
                backing: .buffered,
                defer: false
            )
            window.title = "Assistant"
            window.center()
            window.contentView = NSHostingView(rootView: contentView)
            assistantWindow = window
        }

        assistantWindow?.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
}
