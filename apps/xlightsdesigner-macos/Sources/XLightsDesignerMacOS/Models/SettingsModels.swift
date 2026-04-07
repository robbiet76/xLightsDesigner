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
