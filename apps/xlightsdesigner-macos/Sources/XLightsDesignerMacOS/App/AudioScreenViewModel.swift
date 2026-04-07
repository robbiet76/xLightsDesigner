import Foundation
import Observation

@MainActor
@Observable
final class AudioScreenViewModel {
    private let trackLibraryService: TrackLibraryService
    private let fileSelectionService: FileSelectionService

    var mode: AudioMode = .singleTrack
    var singleTrackPath = ""
    var folderPath = ""
    var recursiveEnabled = true
    var selectedRowID: AudioLibraryRowModel.ID?
    var searchQuery = ""
    var currentResult: AudioCurrentResultModel = .empty

    private(set) var allRows: [AudioLibraryRowModel]

    init(
        rows: [AudioLibraryRowModel],
        selectedRowID: AudioLibraryRowModel.ID? = nil,
        trackLibraryService: TrackLibraryService = LocalTrackLibraryService(),
        fileSelectionService: FileSelectionService = NativeFileSelectionService()
    ) {
        self.trackLibraryService = trackLibraryService
        self.fileSelectionService = fileSelectionService
        self.allRows = rows
        self.selectedRowID = selectedRowID
        if let selectedRowID {
            selectRow(id: selectedRowID)
        }
    }

    var header: AudioHeaderModel {
        let completeCount = allRows.filter { $0.status == .complete }.count
        let partialCount = allRows.filter { $0.status == .partial }.count
        let needsReviewCount = allRows.filter { $0.status == .needsReview }.count
        let failedCount = allRows.filter { $0.status == .failed }.count
        return AudioHeaderModel(
            title: "Audio Analysis",
            subtitle: "Analyze one track or a folder batch, then browse the shared track library.",
            totalCount: allRows.count,
            completeCount: completeCount,
            partialCount: partialCount,
            needsReviewCount: needsReviewCount,
            failedCount: failedCount
        )
    }

    var filteredRows: [AudioLibraryRowModel] {
        guard !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return allRows
        }
        let q = searchQuery.lowercased()
        return allRows.filter {
            $0.displayName.lowercased().contains(q) ||
            $0.artist.lowercased().contains(q) ||
            $0.status.rawValue.lowercased().contains(q) ||
            $0.identitySummary.lowercased().contains(q)
        }
    }

    func loadLibrary() {
        do {
            let rows = try trackLibraryService.loadLibraryRows()
            allRows = rows
            let preferredSelection = selectedRowID.flatMap { id in rows.contains(where: { $0.id == id }) ? id : nil }
            let fallbackSelection = preferredSelection
                ?? rows.first(where: { $0.status == .needsReview })?.id
                ?? rows.first?.id
            selectRow(id: fallbackSelection)
        } catch {
            currentResult = .error(AudioErrorModel(
                title: "Unable to load track library",
                explanation: String(error.localizedDescription),
                canRetry: true
            ))
        }
    }

    func browseForTrack() {
        guard let path = fileSelectionService.chooseAudioFile() else { return }
        singleTrackPath = path
    }

    func browseForFolder() {
        guard let path = fileSelectionService.chooseFolder() else { return }
        folderPath = path
    }

    func selectRow(id: AudioLibraryRowModel.ID?) {
        selectedRowID = id
        guard let id, let row = allRows.first(where: { $0.id == id }) else {
            currentResult = .empty
            return
        }
        currentResult = .track(trackResult(from: row))
    }

    func analyzeTrack() {
        let trimmed = singleTrackPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            currentResult = .error(AudioErrorModel(
                title: "No audio file selected",
                explanation: "Choose a file before starting single-track analysis.",
                canRetry: false
            ))
            return
        }

        let name = URL(fileURLWithPath: trimmed).deletingPathExtension().lastPathComponent
        currentResult = .track(AudioTrackResultModel(
            rowID: "ad-hoc-track",
            displayName: name,
            artist: "Unverified",
            lastAnalyzedSummary: "Just now",
            status: .needsReview,
            identityState: .needsReview,
            availableTimingsSummary: "Song Structure, Beats, Bars",
            missingIssuesSummary: "Phrase Cues missing",
            reason: "Identity is unresolved and phrase cues are not yet available.",
            recommendedActionText: "Verify track info",
            editableTitleDraft: name,
            editableArtistDraft: "",
            canConfirmIdentity: true
        ))
    }

    func analyzeFolder() {
        let trimmed = folderPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            currentResult = .error(AudioErrorModel(
                title: "No folder selected",
                explanation: "Choose a folder before starting batch analysis.",
                canRetry: false
            ))
            return
        }

        currentResult = .batchComplete(AudioBatchCompleteModel(
            batchLabel: URL(fileURLWithPath: trimmed).lastPathComponent,
            processedCount: 12,
            completeCount: 7,
            partialCount: 3,
            needsReviewCount: 1,
            failedCount: 1,
            topIssueCategories: recursiveEnabled ? "Missing phrase cues, unresolved identity" : "Unresolved identity",
            followUpActionText: "Review batch results"
        ))
    }

    func retryCurrentResult() {
        switch currentResult {
        case .error:
            currentResult = .empty
        default:
            break
        }
    }

    func updateDraftTitle(_ value: String) {
        guard case let .track(track) = currentResult else { return }
        currentResult = .track(AudioTrackResultModel(
            rowID: track.rowID,
            displayName: track.displayName,
            artist: track.artist,
            lastAnalyzedSummary: track.lastAnalyzedSummary,
            status: track.status,
            identityState: track.identityState,
            availableTimingsSummary: track.availableTimingsSummary,
            missingIssuesSummary: track.missingIssuesSummary,
            reason: track.reason,
            recommendedActionText: track.recommendedActionText,
            editableTitleDraft: value,
            editableArtistDraft: track.editableArtistDraft,
            canConfirmIdentity: track.canConfirmIdentity
        ))
    }

    func updateDraftArtist(_ value: String) {
        guard case let .track(track) = currentResult else { return }
        currentResult = .track(AudioTrackResultModel(
            rowID: track.rowID,
            displayName: track.displayName,
            artist: track.artist,
            lastAnalyzedSummary: track.lastAnalyzedSummary,
            status: track.status,
            identityState: track.identityState,
            availableTimingsSummary: track.availableTimingsSummary,
            missingIssuesSummary: track.missingIssuesSummary,
            reason: track.reason,
            recommendedActionText: track.recommendedActionText,
            editableTitleDraft: track.editableTitleDraft,
            editableArtistDraft: value,
            canConfirmIdentity: track.canConfirmIdentity
        ))
    }

    func confirmTrackInfo() {
        guard case let .track(track) = currentResult, track.canConfirmIdentity else { return }
        let title = track.editableTitleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let artist = track.editableArtistDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !artist.isEmpty else { return }

        if let index = allRows.firstIndex(where: { $0.id == track.rowID }) {
            allRows[index].displayName = title
            allRows[index].artist = artist
            allRows[index].status = .complete
            allRows[index].identitySummary = AudioIdentityState.verified.rawValue
            allRows[index].identityState = .verified
            allRows[index].actionSummaryText = "No action needed"
            allRows[index].reason = "Identity confirmed and core timing layers are available."
            allRows[index].canConfirmIdentity = false
            allRows[index].missingIssuesSummary = "None"
            allRows[index].suggestedTitle = title
            allRows[index].suggestedArtist = artist
            currentResult = .track(trackResult(from: allRows[index]))
        } else {
            currentResult = .track(AudioTrackResultModel(
                rowID: track.rowID,
                displayName: title,
                artist: artist,
                lastAnalyzedSummary: track.lastAnalyzedSummary,
                status: .complete,
                identityState: .verified,
                availableTimingsSummary: track.availableTimingsSummary,
                missingIssuesSummary: "None",
                reason: "Identity confirmed locally in the scaffold.",
                recommendedActionText: "No action needed",
                editableTitleDraft: title,
                editableArtistDraft: artist,
                canConfirmIdentity: false
            ))
        }
    }

    private func trackResult(from row: AudioLibraryRowModel) -> AudioTrackResultModel {
        AudioTrackResultModel(
            rowID: row.id,
            displayName: row.displayName,
            artist: row.artist,
            lastAnalyzedSummary: row.lastAnalyzedSummary,
            status: row.status,
            identityState: row.identityState,
            availableTimingsSummary: row.availableTimingsSummary,
            missingIssuesSummary: row.missingIssuesSummary,
            reason: row.reason,
            recommendedActionText: row.actionSummaryText,
            editableTitleDraft: row.displayName,
            editableArtistDraft: row.artist == "Unverified" ? "" : row.artist,
            canConfirmIdentity: row.canConfirmIdentity
        )
    }
}

extension AudioScreenViewModel {
    static func sample() -> AudioScreenViewModel {
        AudioScreenViewModel(rows: [
            AudioLibraryRowModel(
                id: "candy-cane-lane",
                displayName: "Candy Cane Lane",
                artist: "Sia",
                status: .complete,
                availableTimingsSummary: "Song Structure, Phrase Cues, Beats, Bars",
                missingIssuesSummary: "None",
                identitySummary: "Verified",
                identityState: .verified,
                lastAnalyzedSummary: "Today 10:42 AM",
                actionSummaryText: "No action needed",
                reason: "Required timing layers are present.",
                canConfirmIdentity: false,
                sourceMediaPath: "",
                suggestedTitle: "Candy Cane Lane",
                suggestedArtist: "Sia",
                availableProfiles: ["deep"],
                verificationStatus: "claimed_identity_only",
                recommendedFileName: "",
                shouldRename: false,
                shouldRetag: false,
                availableTimingNames: ["XD: Song Structure", "XD: Phrase Cues", "XD: Beats", "XD: Bars"]
            ),
            AudioLibraryRowModel(
                id: "carol-bells",
                displayName: "Carol Of The Bells",
                artist: "Unverified",
                status: .needsReview,
                availableTimingsSummary: "Song Structure, Beats, Bars",
                missingIssuesSummary: "Phrase Cues missing",
                identitySummary: "Needs Review",
                identityState: .needsReview,
                lastAnalyzedSummary: "Today 11:03 AM",
                actionSummaryText: "Verify track info",
                reason: "Track identity is unresolved.",
                canConfirmIdentity: true,
                sourceMediaPath: "",
                suggestedTitle: "Carol Of The Bells",
                suggestedArtist: "",
                availableProfiles: ["deep"],
                verificationStatus: "unverified",
                recommendedFileName: "",
                shouldRename: false,
                shouldRetag: false,
                availableTimingNames: ["XD: Song Structure", "XD: Beats", "XD: Bars"]
            ),
            AudioLibraryRowModel(
                id: "christmas-sarajevo",
                displayName: "Christmas Sarajevo 12/24",
                artist: "Trans-Siberian Orchestra",
                status: .partial,
                availableTimingsSummary: "Song Structure, Beats, Bars",
                missingIssuesSummary: "Phrase Cues missing",
                identitySummary: "Verified",
                identityState: .verified,
                lastAnalyzedSummary: "Yesterday",
                actionSummaryText: "No action needed",
                reason: "Phrase cues are unavailable for this instrumental track.",
                canConfirmIdentity: false,
                sourceMediaPath: "",
                suggestedTitle: "Christmas Sarajevo 12/24",
                suggestedArtist: "Trans-Siberian Orchestra",
                availableProfiles: ["deep"],
                verificationStatus: "claimed_identity_only",
                recommendedFileName: "",
                shouldRename: false,
                shouldRetag: false,
                availableTimingNames: ["XD: Song Structure", "XD: Beats", "XD: Bars"]
            ),
            AudioLibraryRowModel(
                id: "grinch-failed",
                displayName: "You’re A Mean One, Mr. Grinch",
                artist: "Thurl Ravenscroft",
                status: .failed,
                availableTimingsSummary: "None",
                missingIssuesSummary: "Analysis failed",
                identitySummary: "Verified",
                identityState: .verified,
                lastAnalyzedSummary: "Today 9:14 AM",
                actionSummaryText: "Re-run analysis",
                reason: "The last analysis run failed before timing layers were produced.",
                canConfirmIdentity: false,
                sourceMediaPath: "",
                suggestedTitle: "You’re A Mean One, Mr. Grinch",
                suggestedArtist: "Thurl Ravenscroft",
                availableProfiles: [],
                verificationStatus: "claimed_identity_only",
                recommendedFileName: "",
                shouldRename: false,
                shouldRetag: false,
                availableTimingNames: []
            )
        ], selectedRowID: "carol-bells")
    }
}
