import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = AppModel()
    private var window: NSWindow?
    private var automationServer: NativeAutomationServer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.regular)
        model.projectScreenModel.loadInitialProject()
        model.layoutScreenModel.loadLayout()
        model.audioScreenModel.loadLibrary()
        model.designScreenModel.refresh()
        model.sequenceScreenModel.refresh()
        model.reviewScreenModel.refresh()
        model.historyScreenModel.loadHistory()
        model.settingsScreenModel.load()
        model.xlightsSessionModel.refresh()
        let automationServer = NativeAutomationServer(model: model)
        automationServer.start()
        self.automationServer = automationServer

        if window == nil {
            let contentView = RootContentView(model: model)
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 1440, height: 860),
                styleMask: [.titled, .closable, .miniaturizable, .resizable],
                backing: .buffered,
                defer: false
            )
            window.title = "xLightsDesigner"
            window.minSize = NSSize(width: 1180, height: 780)
            window.level = .normal
            window.collectionBehavior = [.managed]
            window.center()
            window.contentView = NSHostingView(rootView: contentView)
            window.makeKeyAndOrderFront(nil)
            self.window = window
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        automationServer?.stop()
        automationServer = nil
    }
}
