import AppKit
import Foundation
import UniformTypeIdentifiers

private final class ProjectRootOpenPanelDelegate: NSObject, NSOpenSavePanelDelegate {
    private let projectsRoot: String

    init(projectsRoot: String) {
        self.projectsRoot = URL(fileURLWithPath: projectsRoot).standardizedFileURL.path
    }

    func panel(_ sender: Any, shouldEnable url: URL) -> Bool {
        let path = url.standardizedFileURL.path
        return path == projectsRoot || path.hasPrefix(projectsRoot + "/")
    }
}

@MainActor
protocol FileSelectionService {
    func chooseAudioFile() -> String?
    func chooseFolder(prompt: String) -> String?
    func chooseProjectFolder() -> String?
}

@MainActor
struct NativeFileSelectionService: FileSelectionService {
    func chooseAudioFile() -> String? {
        let panel = NSOpenPanel()
        configure(panel)
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = []
        panel.prompt = "Choose Audio File"
        return present(panel)
    }

    func chooseFolder(prompt: String = "Choose Folder") -> String? {
        let panel = NSOpenPanel()
        configure(panel)
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = prompt
        return present(panel)
    }

    func chooseProjectFolder() -> String? {
        let panel = NSOpenPanel()
        configure(panel)
        let delegate = ProjectRootOpenPanelDelegate(projectsRoot: AppEnvironment.projectsRootPath)
        panel.delegate = delegate
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Open Project Folder"
        panel.directoryURL = URL(fileURLWithPath: AppEnvironment.projectsRootPath)
        return present(panel)
    }

    private func configure(_ panel: NSOpenPanel) {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.mainWindow?.makeKeyAndOrderFront(nil)
        panel.level = .normal
    }

    private func present(_ panel: NSOpenPanel) -> String? {
        panel.center()
        if let screenFrame = (NSApp.mainWindow?.screen ?? NSScreen.main)?.visibleFrame {
            let frame = panel.frame
            let x = max(screenFrame.minX, min(screenFrame.maxX - frame.width, frame.origin.x))
            let y = max(screenFrame.minY, min(screenFrame.maxY - frame.height, frame.origin.y))
            panel.setFrameOrigin(NSPoint(x: x, y: y))
        }
        return panel.runModal() == .OK ? panel.url?.path : nil
    }
}
