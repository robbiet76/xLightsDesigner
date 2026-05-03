import Foundation
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
    func chooseProjectFolder() -> String? { nil }
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
    try await xldWaitUntil {
        if case let .track(track) = model.currentResult {
            return track.identityState == .verified
        }
        return false
    }

    guard case let .track(track) = model.currentResult else {
        Issue.record("Expected selected track result")
        return
    }

    #expect(track.identityState == .verified)
    #expect(track.status == .complete)
    #expect(track.canConfirmIdentity == false)
    #expect(model.filteredRows.first(where: { $0.id == "carol-bells" })?.artist == "Trans-Siberian Orchestra")
}

@MainActor
@Test func selectingAudioTargetUpdatesActiveSequenceMediaRecord() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-audio-sequence-\(UUID().uuidString)", isDirectory: true)
    let showFolder = root.appendingPathComponent("show", isDirectory: true)
    let sequencePath = showFolder.appendingPathComponent("HolidayRoad/HolidayRoad.xsq")
    let previousAudioPath = showFolder.appendingPathComponent("Audio/Old.mp3")
    let newAudioPath = showFolder.appendingPathComponent("Audio/New.mp3")
    try FileManager.default.createDirectory(at: sequencePath.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: newAudioPath.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data("<sequence/>".utf8).write(to: sequencePath)
    try Data("old".utf8).write(to: previousAudioPath)
    try Data("new".utf8).write(to: newAudioPath)

    let projectService = LocalProjectService(projectsRootPath: root.appendingPathComponent("projects", isDirectory: true).path)
    var project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Audio Sequence \(UUID().uuidString.prefix(6))",
            showFolder: showFolder.path,
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let sequenceStore = LocalProjectSequenceStore()
    try sequenceStore.upsertActiveSequence(project: &project, sequencePath: sequencePath.path, audioPath: previousAudioPath.path)
    project.snapshot["sequencePathInput"] = AnyCodable(sequencePath.path)
    project.snapshot["activeSequence"] = AnyCodable("HolidayRoad")
    project.snapshot["audioPathInput"] = AnyCodable(previousAudioPath.path)
    project = try projectService.saveProject(project)

    let workspace = ProjectWorkspace()
    workspace.setProject(project)
    let model = AudioScreenViewModel(
        rows: [audioRow(id: "new-audio", sourceMediaPath: newAudioPath.path)],
        workspace: workspace,
        projectService: projectService,
        projectSequenceStore: sequenceStore
    )

    model.selectRow(id: "new-audio")

    let saved = try #require(workspace.activeProject)
    let loadedActiveRecord = try sequenceStore.loadActiveSequence(project: saved)
    let activeRecord = try #require(loadedActiveRecord)
    #expect(ProjectTargetContext.normalizedPath(activeRecord.mediaPath ?? "") == ProjectTargetContext.normalizedPath(newAudioPath.path))
    #expect(ProjectTargetContext.normalizedPath((saved.snapshot["audioPathInput"]?.value as? String) ?? "") == ProjectTargetContext.normalizedPath(newAudioPath.path))
}

private func audioRow(id: String, sourceMediaPath: String) -> AudioLibraryRowModel {
    AudioLibraryRowModel(
        id: id,
        displayName: "New Audio",
        artist: "Verified",
        status: .complete,
        availableTimingsSummary: "Song Structure",
        missingIssuesSummary: "None",
        identitySummary: "Verified",
        identityState: .verified,
        lastAnalyzedSummary: "Now",
        actionSummaryText: "No action needed",
        reason: "Ready.",
        canConfirmIdentity: false,
        sourceMediaPath: sourceMediaPath,
        suggestedTitle: "New Audio",
        suggestedArtist: "Verified",
        availableProfiles: ["deep"],
        verificationStatus: "verified",
        recommendedFileName: "",
        shouldRename: false,
        shouldRetag: false,
        availableTimingNames: ["XD: Song Structure"]
    )
}
