import Foundation

enum AppEnvironment {
    private static let environment = ProcessInfo.processInfo.environment
    static let repoRootPath = "/Users/robterry/Projects/xLightsDesigner"
    static let canonicalAppRoot = "/Users/robterry/Documents/Lights/xLightsDesigner"
    static let projectsRootPath = canonicalAppRoot + "/projects"
    static let trackLibraryPath = canonicalAppRoot + "/library/tracks"
    static let xlightsOwnedAPIBaseURL = environment["XLD_XLIGHTS_OWNED_API_BASE_URL"] ?? "http://127.0.0.1:49915/xlightsdesigner/api"
    static let appAutomationBaseURL = "http://127.0.0.1:49916"
    static let appStateRoot = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/xLightsDesigner", isDirectory: true)
        .path
    static let batchAnalyzeFolderScriptPath = repoRootPath + "/scripts/audio-analysis/build-track-library-and-review.mjs"
    static let appAnalyzeTrackScriptPath = repoRootPath + "/scripts/audio-analysis/app/analyze-track-to-library.mjs"
    static let appUpdateTrackIdentityScriptPath = repoRootPath + "/scripts/audio-analysis/app/update-track-identity.mjs"
    static let appAssistantConversationScriptPath = repoRootPath + "/scripts/assistant/app/run-app-assistant-conversation.mjs"
    static let appVisualDesignAssetPackScriptPath = repoRootPath + "/scripts/designer/app/generate-visual-design-asset-pack.mjs"
    static let appDirectProposalScriptPath = repoRootPath + "/scripts/sequencing/app/generate-app-direct-proposal.mjs"
    static let appReviewApplyScriptPath = repoRootPath + "/scripts/sequencing/app/apply-app-review.mjs"
}
