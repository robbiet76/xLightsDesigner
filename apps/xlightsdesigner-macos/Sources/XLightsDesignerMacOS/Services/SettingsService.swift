import AppKit
import Foundation

protocol SettingsService {
    func loadSettings() throws -> SettingsScreenModel
    func saveAgentConfig(_ config: SettingsAgentConfigModel) throws -> SettingsAgentConfigModel
    func saveSafetyConfig(_ config: SettingsSafetyConfigModel) throws -> SettingsSafetyConfigModel
    func probeXLights(baseURL: String) -> SettingsXLightsStatusModel
    func revealPath(_ path: String)
    func createStateBackup() throws -> String
}

struct LocalSettingsService: SettingsService {
    private let fileManager = FileManager.default

    func loadSettings() throws -> SettingsScreenModel {
        let agent = loadAgentConfig()
        let safety = loadSafetyConfig()
        let xlights = probeXLights(baseURL: AppEnvironment.xlightsOwnedAPIBaseURL)
        return SettingsScreenModel(
            selectedCategory: .general,
            banner: nil,
            agentConfig: agent,
            safetyConfig: safety,
            xlightsStatus: xlights,
            pathRows: buildPathRows()
        )
    }

    func saveAgentConfig(_ config: SettingsAgentConfigModel) throws -> SettingsAgentConfigModel {
        let fileURL = URL(fileURLWithPath: agentConfigPath)
        try fileManager.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let payload = AgentConfigFile(
            apiKey: config.apiKey.trimmingCharacters(in: .whitespacesAndNewlines),
            model: config.model.trimmingCharacters(in: .whitespacesAndNewlines),
            baseURL: config.baseURL.trimmingCharacters(in: .whitespacesAndNewlines),
            user: AgentConfigIdentity(
                nickname: config.userIdentity.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                bubbleColor: config.userIdentity.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
            ),
            identities: AgentConfigTeamChatIdentities(
                appAssistant: AgentConfigIdentity(
                    nickname: config.identities.appAssistant.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                    bubbleColor: config.identities.appAssistant.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
                ),
                audioAnalyst: AgentConfigIdentity(
                    nickname: config.identities.audioAnalyst.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                    bubbleColor: config.identities.audioAnalyst.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
                ),
                designer: AgentConfigIdentity(
                    nickname: config.identities.designer.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                    bubbleColor: config.identities.designer.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
                ),
                sequencer: AgentConfigIdentity(
                    nickname: config.identities.sequencer.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                    bubbleColor: config.identities.sequencer.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
        )
        let data = try JSONEncoder.pretty.encode(payload)
        try data.write(to: fileURL, options: .atomic)
        return loadAgentConfig()
    }

    func saveSafetyConfig(_ config: SettingsSafetyConfigModel) throws -> SettingsSafetyConfigModel {
        let url = URL(fileURLWithPath: stateFilePath)
        guard fileManager.fileExists(atPath: url.path) else {
            throw SettingsServiceError.missingStateFile
        }
        let data = try Data(contentsOf: url)
        var state = try JSONDecoder().decode(DesktopStateFile.self, from: data)
        let localStateData = Data(state.localStateRaw.utf8)
        var localState = try JSONDecoder().decode(LocalStatePayload.self, from: localStateData)
        localState.safety = SafetyConfigFile(
            applyConfirmMode: config.applyConfirmMode,
            largeChangeThreshold: config.largeChangeThreshold,
            sequenceSwitchUnsavedPolicy: config.sequenceSwitchUnsavedPolicy
        )
        state.localStateRaw = String(decoding: try JSONEncoder().encode(localState), as: UTF8.self)
        try JSONEncoder.pretty.encode(state).write(to: url, options: .atomic)
        return loadSafetyConfig()
    }

    func probeXLights(baseURL: String) -> SettingsXLightsStatusModel {
        guard let url = URL(string: "\(baseURL)/health") else {
            return SettingsXLightsStatusModel(baseURL: baseURL, connected: false, summary: "Invalid base URL")
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 2
        let semaphore = DispatchSemaphore(value: 0)
        let state = LockedProbeResult()
        URLSession.shared.dataTask(with: request) { data, response, error in
            defer { semaphore.signal() }
            if let error {
                state.value = SettingsXLightsStatusModel(baseURL: baseURL, connected: false, summary: error.localizedDescription)
                return
            }
            guard
                let http = response as? HTTPURLResponse,
                let data,
                http.statusCode == 200
            else {
                state.value = SettingsXLightsStatusModel(baseURL: baseURL, connected: false, summary: "No health response")
                return
            }
            let status = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let healthState = (status?["data"] as? [String: Any])?["state"] as? String ?? "unknown"
            state.value = SettingsXLightsStatusModel(baseURL: baseURL, connected: true, summary: "Connected (\(healthState))")
        }.resume()
        _ = semaphore.wait(timeout: .now() + 2.5)
        return state.value ?? SettingsXLightsStatusModel(baseURL: baseURL, connected: false, summary: "Timed out")
    }

    func revealPath(_ path: String) {
        guard !path.isEmpty else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }

    func createStateBackup() throws -> String {
        let stateURL = URL(fileURLWithPath: stateFilePath)
        guard fileManager.fileExists(atPath: stateURL.path) else {
            throw SettingsServiceError.missingStateFile
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let backupURL = URL(fileURLWithPath: AppEnvironment.desktopStateRoot)
            .appendingPathComponent("backups", isDirectory: true)
            .appendingPathComponent("native-settings-backup-\(formatter.string(from: Date()).replacingOccurrences(of: ":", with: "-")).json")
        try fileManager.createDirectory(at: backupURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fileManager.copyItem(at: stateURL, to: backupURL)
        return backupURL.path
    }

    private var agentConfigPath: String {
        URL(fileURLWithPath: AppEnvironment.desktopStateRoot)
            .appendingPathComponent("xlightsdesigner-agent-config.json")
            .path
    }

    private var stateFilePath: String {
        URL(fileURLWithPath: AppEnvironment.desktopStateRoot)
            .appendingPathComponent("xlightsdesigner-state.json")
            .path
    }

    private func loadAgentConfig() -> SettingsAgentConfigModel {
        guard
            let data = try? Data(contentsOf: URL(fileURLWithPath: agentConfigPath)),
            let config = try? JSONDecoder().decode(AgentConfigFile.self, from: data)
        else {
            return SettingsAgentConfigModel(
                model: "",
                baseURL: "https://api.openai.com/v1",
                apiKey: "",
                hasStoredAPIKey: false,
                userIdentity: SettingsChatIdentityModel(roleID: "user", displayName: "You", nickname: "", bubbleColorHex: ""),
                identities: .default
            )
        }
        return SettingsAgentConfigModel(
            model: config.model,
            baseURL: config.baseURL,
            apiKey: "",
            hasStoredAPIKey: !config.apiKey.isEmpty,
            userIdentity: SettingsChatIdentityModel(
                roleID: "user",
                displayName: "You",
                nickname: config.user?.nickname ?? "",
                bubbleColorHex: config.user?.bubbleColor ?? ""
            ),
            identities: SettingsTeamChatIdentitiesModel(
                appAssistant: SettingsAgentIdentityModel(
                    roleID: "app_assistant",
                    displayName: "App Assistant",
                    nickname: config.identities?.appAssistant?.nickname ?? SettingsTeamChatIdentitiesModel.default.appAssistant.nickname,
                    bubbleColorHex: config.identities?.appAssistant?.bubbleColor ?? ""
                ),
                audioAnalyst: SettingsAgentIdentityModel(
                    roleID: "audio_analyst",
                    displayName: "Audio Analyst",
                    nickname: config.identities?.audioAnalyst?.nickname ?? SettingsTeamChatIdentitiesModel.default.audioAnalyst.nickname,
                    bubbleColorHex: config.identities?.audioAnalyst?.bubbleColor ?? ""
                ),
                designer: SettingsAgentIdentityModel(
                    roleID: "designer_dialog",
                    displayName: "Designer",
                    nickname: config.identities?.designer?.nickname ?? SettingsTeamChatIdentitiesModel.default.designer.nickname,
                    bubbleColorHex: config.identities?.designer?.bubbleColor ?? ""
                ),
                sequencer: SettingsAgentIdentityModel(
                    roleID: "sequence_agent",
                    displayName: "Sequencer",
                    nickname: config.identities?.sequencer?.nickname ?? SettingsTeamChatIdentitiesModel.default.sequencer.nickname,
                    bubbleColorHex: config.identities?.sequencer?.bubbleColor ?? ""
                )
            )
        )
    }

    private func loadSafetyConfig() -> SettingsSafetyConfigModel {
        guard
            let data = try? Data(contentsOf: URL(fileURLWithPath: stateFilePath)),
            let state = try? JSONDecoder().decode(DesktopStateFile.self, from: data),
            let localStateData = state.localStateRaw.data(using: .utf8),
            let localState = try? JSONDecoder().decode(LocalStatePayload.self, from: localStateData),
            let safety = localState.safety
        else {
            return SettingsSafetyConfigModel(
                applyConfirmMode: "large-only",
                largeChangeThreshold: 60,
                sequenceSwitchUnsavedPolicy: "save-if-needed"
            )
        }
        return SettingsSafetyConfigModel(
            applyConfirmMode: safety.applyConfirmMode,
            largeChangeThreshold: safety.largeChangeThreshold,
            sequenceSwitchUnsavedPolicy: safety.sequenceSwitchUnsavedPolicy
        )
    }

    private func buildPathRows() -> [SettingsPathRowModel] {
        [
            SettingsPathRowModel(id: "app-root", label: "Canonical App Root", value: AppEnvironment.canonicalAppRoot),
            SettingsPathRowModel(id: "desktop-state", label: "Desktop State Root", value: AppEnvironment.desktopStateRoot),
            SettingsPathRowModel(id: "projects-root", label: "Projects Root", value: AppEnvironment.projectsRootPath),
            SettingsPathRowModel(id: "track-library", label: "Track Library", value: AppEnvironment.trackLibraryPath),
            SettingsPathRowModel(id: "repo-root", label: "Repo Root", value: AppEnvironment.repoRootPath)
        ]
    }
}

enum SettingsServiceError: LocalizedError {
    case missingStateFile

    var errorDescription: String? {
        switch self {
        case .missingStateFile:
            return "Desktop state file is missing."
        }
    }
}

private struct AgentConfigFile: Codable {
    var apiKey: String
    var model: String
    var baseURL: String
    var user: AgentConfigIdentity?
    var identities: AgentConfigTeamChatIdentities?

    enum CodingKeys: String, CodingKey {
        case apiKey
        case model
        case baseURL = "baseUrl"
        case user
        case identities
    }
}

private struct AgentConfigTeamChatIdentities: Codable {
    var appAssistant: AgentConfigIdentity?
    var audioAnalyst: AgentConfigIdentity?
    var designer: AgentConfigIdentity?
    var sequencer: AgentConfigIdentity?

    enum CodingKeys: String, CodingKey {
        case appAssistant = "app_assistant"
        case audioAnalyst = "audio_analyst"
        case designer = "designer_dialog"
        case sequencer = "sequence_agent"
    }
}

private struct AgentConfigIdentity: Codable {
    var nickname: String
    var bubbleColor: String?
}

private struct DesktopStateFile: Codable {
    var localStateRaw: String
}

private struct LocalStatePayload: Codable {
    var safety: SafetyConfigFile?
}

private struct SafetyConfigFile: Codable {
    var applyConfirmMode: String
    var largeChangeThreshold: Int
    var sequenceSwitchUnsavedPolicy: String
}

private final class LockedProbeResult: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: SettingsXLightsStatusModel?

    var value: SettingsXLightsStatusModel? {
        get {
            lock.lock()
            defer { lock.unlock() }
            return storage
        }
        set {
            lock.lock()
            storage = newValue
            lock.unlock()
        }
    }
}

private extension JSONEncoder {
    static var pretty: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
