import Foundation

enum AppEnvironment {
    private static let environment = ProcessInfo.processInfo.environment
    static let repoRootPath = "/Users/robterry/Projects/xLightsDesigner"
    static let canonicalAppRoot = "/Users/robterry/Documents/Lights/xLightsDesigner"
    static let projectsRootPath = canonicalAppRoot + "/projects"
    static let trackLibraryPath = canonicalAppRoot + "/library/tracks"
    static let xlightsOwnedAPIBaseURL = environment["XLD_XLIGHTS_OWNED_API_BASE_URL"] ?? "http://127.0.0.1:49915/xlightsdesigner/api"
    static let nativeAutomationBaseURL = "http://127.0.0.1:49916"
    static let desktopStateRoot = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/xlightsdesigner-desktop", isDirectory: true)
        .path
    static let batchAnalyzeFolderScriptPath = repoRootPath + "/scripts/audio-analysis/build-track-library-and-review.mjs"
    static let nativeAnalyzeTrackScriptPath = repoRootPath + "/scripts/audio-analysis/native/analyze-track-to-library.mjs"
    static let nativeUpdateTrackIdentityScriptPath = repoRootPath + "/scripts/audio-analysis/native/update-track-identity.mjs"
    static let nativeAssistantConversationScriptPath = repoRootPath + "/scripts/assistant/native/run-app-assistant-conversation.mjs"
    static let nativeReviewApplyScriptPath = repoRootPath + "/scripts/sequencing/native/apply-native-review.mjs"
}
