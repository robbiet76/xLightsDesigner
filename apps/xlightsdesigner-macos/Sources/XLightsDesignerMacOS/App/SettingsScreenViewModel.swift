import Foundation
import Observation

@MainActor
@Observable
final class SettingsScreenViewModel {
    private let service: SettingsService

    var screenModel = SettingsScreenModel(
        selectedCategory: .general,
        banner: nil,
        agentConfig: SettingsAgentConfigModel(model: "", baseURL: "https://api.openai.com/v1", apiKey: "", hasStoredAPIKey: false, userIdentity: SettingsChatIdentityModel(roleID: "user", displayName: "You", nickname: "", bubbleColorHex: ""), identities: .default),
        safetyConfig: SettingsSafetyConfigModel(applyConfirmMode: "large-only", largeChangeThreshold: 60, sequenceSwitchUnsavedPolicy: "save-if-needed"),
        xlightsStatus: SettingsXLightsStatusModel(baseURL: AppEnvironment.xlightsOwnedAPIBaseURL, connected: false, summary: "Not checked"),
        pathRows: []
    )

    init(service: SettingsService = LocalSettingsService()) {
        self.service = service
    }

    func load() {
        do {
            let loaded = try service.loadSettings()
            screenModel = loaded
        } catch {
            screenModel.banner = SettingsBannerModel(id: "settings-load", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func selectCategory(_ category: SettingsCategoryID) {
        screenModel.selectedCategory = category
        screenModel.banner = nil
    }

    func saveProviderSettings() {
        do {
            screenModel.agentConfig = try service.saveAgentConfig(screenModel.agentConfig)
            screenModel.banner = SettingsBannerModel(id: "provider-save", level: .success, text: "Provider settings saved.")
        } catch {
            screenModel.banner = SettingsBannerModel(id: "provider-save-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func saveTeamChatSettingsSilently() {
        do {
            screenModel.agentConfig = try service.saveAgentConfig(screenModel.agentConfig)
        } catch {
            screenModel.banner = SettingsBannerModel(id: "team-chat-save-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func saveOperatorSettings() {
        do {
            screenModel.safetyConfig = try service.saveSafetyConfig(screenModel.safetyConfig)
            screenModel.banner = SettingsBannerModel(id: "operator-save", level: .success, text: "Operator safety settings saved.")
        } catch {
            screenModel.banner = SettingsBannerModel(id: "operator-save-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func testXLightsConnection() {
        screenModel.xlightsStatus = service.probeXLights(baseURL: screenModel.xlightsStatus.baseURL)
        screenModel.banner = SettingsBannerModel(
            id: "xlights-probe",
            level: screenModel.xlightsStatus.connected ? .success : .warning,
            text: screenModel.xlightsStatus.summary
        )
    }

    func revealPath(_ path: String) {
        service.revealPath(path)
    }

    func createStateBackup() {
        do {
            let path = try service.createStateBackup()
            screenModel.banner = SettingsBannerModel(id: "backup-created", level: .success, text: "Backup created at \(path)")
        } catch {
            screenModel.banner = SettingsBannerModel(id: "backup-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }
}
