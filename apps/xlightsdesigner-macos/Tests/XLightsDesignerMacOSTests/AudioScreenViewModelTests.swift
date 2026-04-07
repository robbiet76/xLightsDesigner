import Testing
@testable import XLightsDesignerMacOS

private final class StubTrackLibraryService: TrackLibraryService, @unchecked Sendable {
    var rows: [AudioLibraryRowModel]

    init(rows: [AudioLibraryRowModel]) {
        self.rows = rows
    }

    func loadLibraryRows() throws -> [AudioLibraryRowModel] {
        rows
    }
}

@MainActor
private struct StubFileSelectionService: FileSelectionService {
    func chooseAudioFile() -> String? { nil }
    func chooseFolder(prompt: String) -> String? { nil }
    func chooseProjectFile() -> String? { nil }
}

private struct StubAudioExecutionService: AudioExecutionService, Sendable {
    let onConfirm: @Sendable (String, String, String) async throws -> Void

    func analyzeTrack(filePath: String, appRootPath: String, mode: String) async throws -> AudioTrackExecutionResult {
        AudioTrackExecutionResult(contentFingerprint: "", displayName: "", artist: "", status: "", summary: "")
    }

    func analyzeFolder(folderPath: String, appRootPath: String, recursive: Bool, mode: String) async throws -> AudioFolderExecutionResult {
        AudioFolderExecutionResult(batchLabel: "", processedCount: 0, completeCount: 0, partialCount: 0, needsReviewCount: 0, failedCount: 0, topIssueCategories: "", followUpActionText: "")
    }

    func confirmTrackIdentity(contentFingerprint: String, title: String, artist: String, appRootPath: String) async throws {
        try await onConfirm(contentFingerprint, title, artist)
    }
}

@MainActor
@Test func sampleAudioViewModelStartsWithNeedsReviewSelection() {
    let model = AudioScreenViewModel.sample()

    #expect(model.selectedRowID == "carol-bells")
    guard case let .track(track) = model.currentResult else {
        Issue.record("Expected selected track result")
        return
    }

    #expect(track.displayName == "Carol Of The Bells")
    #expect(track.canConfirmIdentity)
}

@MainActor
@Test func confirmingIdentityUpdatesSelectedRowAndResult() async throws {
    let initialRows = AudioScreenViewModel.sample().allRows
    let library = StubTrackLibraryService(rows: initialRows)
    let exec = StubAudioExecutionService { fingerprint, title, artist in
        if let index = library.rows.firstIndex(where: { $0.id == fingerprint }) {
            library.rows[index].displayName = title
            library.rows[index].artist = artist
            library.rows[index].status = .complete
            library.rows[index].identitySummary = "Verified"
            library.rows[index].identityState = .verified
            library.rows[index].actionSummaryText = "No action needed"
            library.rows[index].reason = "Identity confirmed and core timing layers are available."
            library.rows[index].canConfirmIdentity = false
            library.rows[index].missingIssuesSummary = "None"
        }
    }
    let model = AudioScreenViewModel(
        rows: initialRows,
        selectedRowID: "carol-bells",
        trackLibraryService: library,
        fileSelectionService: StubFileSelectionService(),
        audioExecutionService: exec
    )

    model.updateDraftTitle("Carol Of The Bells")
    model.updateDraftArtist("Trans-Siberian Orchestra")
    model.confirmTrackInfo()
    try await Task.sleep(for: .milliseconds(50))

    guard case let .track(track) = model.currentResult else {
        Issue.record("Expected selected track result")
        return
    }

    #expect(track.identityState == .verified)
    #expect(track.status == .complete)
    #expect(track.canConfirmIdentity == false)
    #expect(model.filteredRows.first(where: { $0.id == "carol-bells" })?.artist == "Trans-Siberian Orchestra")
}
