import Foundation
import SwiftUI

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
    var bubbleColorHex: String

    var hasCustomBubbleColor: Bool {
        !bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

struct SettingsTeamChatIdentitiesModel: Equatable {
    var appAssistant: SettingsAgentIdentityModel
    var audioAnalyst: SettingsAgentIdentityModel
    var designer: SettingsAgentIdentityModel
    var sequencer: SettingsAgentIdentityModel

    static let `default` = SettingsTeamChatIdentitiesModel(
        appAssistant: SettingsAgentIdentityModel(roleID: "app_assistant", displayName: "App Assistant", nickname: "Clover", bubbleColorHex: ""),
        audioAnalyst: SettingsAgentIdentityModel(roleID: "audio_analyst", displayName: "Audio Analyst", nickname: "Lyric", bubbleColorHex: ""),
        designer: SettingsAgentIdentityModel(roleID: "designer_dialog", displayName: "Designer", nickname: "Mira", bubbleColorHex: ""),
        sequencer: SettingsAgentIdentityModel(roleID: "sequence_agent", displayName: "Sequencer", nickname: "Patch", bubbleColorHex: "")
    )

    func asPayload() -> [String: [String: String]] {
        [
            appAssistant.roleID: [
                "roleId": appAssistant.roleID,
                "displayName": appAssistant.displayName,
                "nickname": appAssistant.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                "bubbleColor": appAssistant.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
            ],
            audioAnalyst.roleID: [
                "roleId": audioAnalyst.roleID,
                "displayName": audioAnalyst.displayName,
                "nickname": audioAnalyst.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                "bubbleColor": audioAnalyst.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
            ],
            designer.roleID: [
                "roleId": designer.roleID,
                "displayName": designer.displayName,
                "nickname": designer.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                "bubbleColor": designer.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
            ],
            sequencer.roleID: [
                "roleId": sequencer.roleID,
                "displayName": sequencer.displayName,
                "nickname": sequencer.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
                "bubbleColor": sequencer.bubbleColorHex.trimmingCharacters(in: .whitespacesAndNewlines)
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

extension SettingsAgentIdentityModel {
    var bubbleColor: Color? {
        Color(hex: bubbleColorHex)
    }
}

extension Color {
    init?(hex: String) {
        let trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let normalized = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
        guard normalized.count == 8, let value = UInt64(normalized, radix: 16) else { return nil }
        let red = Double((value >> 24) & 0xFF) / 255.0
        let green = Double((value >> 16) & 0xFF) / 255.0
        let blue = Double((value >> 8) & 0xFF) / 255.0
        let alpha = Double(value & 0xFF) / 255.0
        self = Color(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
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
