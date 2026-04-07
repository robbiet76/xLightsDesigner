import AppKit
import Foundation

@MainActor
protocol FileSelectionService {
    func chooseAudioFile() -> String?
    func chooseFolder() -> String?
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

    func chooseFolder() -> String? {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Choose Folder"
        return panel.runModal() == .OK ? panel.url?.path : nil
    }
}
