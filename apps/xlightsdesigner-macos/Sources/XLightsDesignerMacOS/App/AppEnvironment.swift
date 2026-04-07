import Foundation

enum AppEnvironment {
    static let repoRootPath = "/Users/robterry/Projects/xLightsDesigner"
    static let canonicalAppRoot = "/Users/robterry/Documents/Lights/xLightsDesigner"
    static let projectsRootPath = canonicalAppRoot + "/projects"
    static let trackLibraryPath = canonicalAppRoot + "/library/tracks"
    static let xlightsOwnedAPIBaseURL = "http://127.0.0.1:49915/xlightsdesigner/api"
    static let batchAnalyzeFolderScriptPath = repoRootPath + "/scripts/audio-analysis/build-track-library-and-review.mjs"
    static let nativeAnalyzeTrackScriptPath = repoRootPath + "/scripts/audio-analysis/native/analyze-track-to-library.mjs"
    static let nativeUpdateTrackIdentityScriptPath = repoRootPath + "/scripts/audio-analysis/native/update-track-identity.mjs"
}
