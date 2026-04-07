import Foundation

protocol ProjectSessionStore: Sendable {
    func loadLastProjectPath() -> String?
    func saveLastProjectPath(_ path: String?)
}

struct LocalProjectSessionStore: ProjectSessionStore {
    private var stateFileURL: URL {
        URL(fileURLWithPath: AppEnvironment.desktopStateRoot, isDirectory: true)
            .appendingPathComponent("native-project-session.json")
    }

    func loadLastProjectPath() -> String? {
        guard let data = try? Data(contentsOf: stateFileURL),
              let payload = try? JSONDecoder().decode(ProjectSessionPayload.self, from: data) else {
            return nil
        }
        let path = payload.lastProjectPath.trimmingCharacters(in: .whitespacesAndNewlines)
        return path.isEmpty ? nil : path
    }

    func saveLastProjectPath(_ path: String?) {
        let payload = ProjectSessionPayload(lastProjectPath: path ?? "")
        do {
            try FileManager.default.createDirectory(at: stateFileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(payload)
            try data.write(to: stateFileURL, options: .atomic)
        } catch {
            // Non-fatal: startup will fall back to normal project discovery.
        }
    }
}

private struct ProjectSessionPayload: Codable {
    let lastProjectPath: String
}
