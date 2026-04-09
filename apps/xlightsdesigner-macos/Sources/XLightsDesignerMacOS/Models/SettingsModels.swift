import Foundation

enum SettingsCategoryID: String, CaseIterable, Identifiable {
    case general
    case providers
    case xlights
    case operators
    case pathsStorage
    case diagnosticsMaintenance

    var id: String { rawValue }

    var title: String {
        switch self {
        case .general: return "General"
        case .providers: return "Providers"
        case .xlights: return "xLights"
        case .operators: return "Operators"
        case .pathsStorage: return "Paths & Storage"
        case .diagnosticsMaintenance: return "Diagnostics & Maintenance"
        }
    }

    var subtitle: String {
        switch self {
        case .general: return "App-wide environment and canonical roots."
        case .providers: return "Cloud provider credentials and defaults."
        case .xlights: return "Owned xLights API connection."
        case .operators: return "Apply and sequence switching safety defaults."
        case .pathsStorage: return "Canonical data and support folders."
        case .diagnosticsMaintenance: return "Health checks, logs, backups, and resets."
        }
    }
}

struct SettingsBannerModel: Identifiable, Equatable {
    enum Level {
        case info
        case success
        case warning
        case blocked
    }

    let id: String
    let level: Level
    let text: String
}

struct SettingsAgentConfigModel: Equatable {
    var model: String
    var baseURL: String
    var apiKey: String
    var hasStoredAPIKey: Bool
    var identities: SettingsTeamChatIdentitiesModel
}

struct SettingsAgentIdentityModel: Equatable {
    let roleID: String
    let displayName: String
    var nickname: String
}

struct SettingsTeamChatIdentitiesModel: Equatable {
    var appAssistant: SettingsAgentIdentityModel
    var audioAnalyst: SettingsAgentIdentityModel
    var designer: SettingsAgentIdentityModel
    var sequencer: SettingsAgentIdentityModel

    static let `default` = SettingsTeamChatIdentitiesModel(
        appAssistant: SettingsAgentIdentityModel(roleID: "app_assistant", displayName: "App Assistant", nickname: "Clover"),
        audioAnalyst: SettingsAgentIdentityModel(roleID: "audio_analyst", displayName: "Audio Analyst", nickname: "Lyric"),
        designer: SettingsAgentIdentityModel(roleID: "designer_dialog", displayName: "Designer", nickname: "Mira"),
        sequencer: SettingsAgentIdentityModel(roleID: "sequence_agent", displayName: "Sequencer", nickname: "Patch")
    )

    func asPayload() -> [String: [String: String]] {
        [
            appAssistant.roleID: [
                "roleId": appAssistant.roleID,
                "displayName": appAssistant.displayName,
                "nickname": appAssistant.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
            ],
            audioAnalyst.roleID: [
                "roleId": audioAnalyst.roleID,
                "displayName": audioAnalyst.displayName,
                "nickname": audioAnalyst.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
            ],
            designer.roleID: [
                "roleId": designer.roleID,
                "displayName": designer.displayName,
                "nickname": designer.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
            ],
            sequencer.roleID: [
                "roleId": sequencer.roleID,
                "displayName": sequencer.displayName,
                "nickname": sequencer.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
            ]
        ]
    }

    func identity(for handledBy: String) -> SettingsAgentIdentityModel {
        switch handledBy {
        case appAssistant.roleID:
            return appAssistant
        case audioAnalyst.roleID:
            return audioAnalyst
        case designer.roleID:
            return designer
        case sequencer.roleID:
            return sequencer
        default:
            return appAssistant
        }
    }
}

struct SettingsSafetyConfigModel: Equatable {
    var applyConfirmMode: String
    var largeChangeThreshold: Int
    var sequenceSwitchUnsavedPolicy: String
}

struct SettingsXLightsStatusModel: Equatable {
    var baseURL: String
    var connected: Bool
    var summary: String
}

struct SettingsPathRowModel: Identifiable, Equatable {
    let id: String
    let label: String
    let value: String
}

struct SettingsScreenModel: Equatable {
    var selectedCategory: SettingsCategoryID
    var banner: SettingsBannerModel?
    var agentConfig: SettingsAgentConfigModel
    var safetyConfig: SettingsSafetyConfigModel
    var xlightsStatus: SettingsXLightsStatusModel
    var pathRows: [SettingsPathRowModel]
}
