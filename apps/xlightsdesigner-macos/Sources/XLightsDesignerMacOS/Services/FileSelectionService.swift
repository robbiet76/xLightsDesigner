import AppKit
import Foundation
import UniformTypeIdentifiers

@MainActor
protocol FileSelectionService {
    func chooseAudioFile() -> String?
    func chooseFolder(prompt: String) -> String?
    func chooseProjectFile() -> String?
}

@MainActor
struct NativeFileSelectionService: FileSelectionService {
    func chooseAudioFile() -> String? {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = []
        panel.prompt = "Choose Audio File"
        return panel.runModal() == .OK ? panel.url?.path : nil
    }

    func chooseFolder(prompt: String = "Choose Folder") -> String? {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = prompt
        return panel.runModal() == .OK ? panel.url?.path : nil
    }

    func chooseProjectFile() -> String? {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [UTType(filenameExtension: "xdproj")].compactMap { $0 }
        panel.prompt = "Open Project"
        panel.directoryURL = URL(fileURLWithPath: AppEnvironment.projectsRootPath)
        return panel.runModal() == .OK ? panel.url?.path : nil
    }
}
