import Foundation

protocol TrackLibraryService {
    func loadLibraryRows() throws -> [AudioLibraryRowModel]
}

struct LocalTrackLibraryService: TrackLibraryService {
    let fileManager: FileManager
    let libraryDirectory: URL

    init(
        fileManager: FileManager = .default,
        libraryDirectory: URL = URL(fileURLWithPath: AppEnvironment.trackLibraryPath, isDirectory: true)
    ) {
        self.fileManager = fileManager
        self.libraryDirectory = libraryDirectory
    }

    func loadLibraryRows() throws -> [AudioLibraryRowModel] {
        guard fileManager.fileExists(atPath: libraryDirectory.path) else {
            return []
        }

        let urls = try fileManager.contentsOfDirectory(
            at: libraryDirectory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        )
        .filter { $0.pathExtension.lowercased() == "json" }
        .sorted { $0.lastPathComponent.localizedCaseInsensitiveCompare($1.lastPathComponent) == .orderedAscending }

        return try urls.compactMap { url in
            let data = try Data(contentsOf: url)
            let object = try JSONSerialization.jsonObject(with: data)
            guard let json = object as? [String: Any] else { return nil }
            return makeRow(from: json, recordURL: url)
        }
    }

    private func makeRow(from json: [String: Any], recordURL: URL) -> AudioLibraryRowModel {
        let track = json["track"] as? [String: Any] ?? [:]
        let verification = track["verification"] as? [String: Any] ?? [:]
        let sourceMedia = track["sourceMedia"] as? [String: Any] ?? [:]
        let naming = track["naming"] as? [String: Any] ?? [:]
        let analysis = json["analysis"] as? [String: Any] ?? [:]
        let timingTracks = json["timingTracks"] as? [[String: Any]] ?? []
        let identity = track["identity"] as? [String: Any] ?? [:]

        let title = string(track["title"])
        let artist = string(track["artist"])
        let displayName = string(track["displayName"]).isEmpty ? title : string(track["displayName"])
        let verificationStatus = string(verification["status"])
        let titlePresent = bool(verification["titlePresent"])
        let artistPresent = bool(verification["artistPresent"])
        let contentFingerprint = string(identity["contentFingerprint"])
        let availableProfiles = strings(analysis["availableProfiles"])
        let availableTimingNames = timingTracks.compactMap { string($0["name"]) }.filter { !$0.isEmpty }
        let recommendedFileName = string(naming["recommendedFileName"])
        let shouldRename = bool(naming["shouldRename"])
        let shouldRetag = bool(naming["shouldRetag"])
        let sourceMediaPath = string(sourceMedia["path"])
        let updatedAt = modificationText(for: recordURL)

        let status = classifyStatus(
            title: title,
            artist: artist,
            verificationStatus: verificationStatus,
            titlePresent: titlePresent,
            artistPresent: artistPresent,
            availableProfiles: availableProfiles,
            availableTimingNames: availableTimingNames
        )

        return AudioLibraryRowModel(
            id: contentFingerprint.isEmpty ? recordURL.lastPathComponent : contentFingerprint,
            displayName: displayName.isEmpty ? recordURL.deletingPathExtension().lastPathComponent : displayName,
            artist: artist.isEmpty ? "Unverified" : artist,
            status: status.status,
            availableTimingsSummary: status.availableSummary,
            missingIssuesSummary: status.reason,
            identitySummary: status.identityText,
            identityState: status.identityState,
            lastAnalyzedSummary: updatedAt,
            actionSummaryText: status.actionText,
            reason: status.reason,
            canConfirmIdentity: status.actionKind == .verifyIdentity,
            sourceMediaPath: sourceMediaPath,
            suggestedTitle: title,
            suggestedArtist: artist,
            availableProfiles: availableProfiles,
            verificationStatus: verificationStatus,
            recommendedFileName: recommendedFileName,
            shouldRename: shouldRename,
            shouldRetag: shouldRetag,
            availableTimingNames: availableTimingNames
        )
    }

    private func classifyStatus(
        title: String,
        artist: String,
        verificationStatus: String,
        titlePresent: Bool,
        artistPresent: Bool,
        availableProfiles: [String],
        availableTimingNames: [String]
    ) -> DerivedAudioRowStatus {
        let timing = summarizeTimingAvailability(availableTimingNames)
        let tempName = isTempTrackName(title)
        let needsIdentityReview = tempName || verificationStatus == "unverified" || !titlePresent || !artistPresent || title.isEmpty || artist.isEmpty

        if availableProfiles.isEmpty {
            return DerivedAudioRowStatus(
                status: .failed,
                reason: "Analysis record is missing a usable profile.",
                actionKind: .rerunAnalysis,
                actionText: "Re-run analysis",
                availableSummary: timing.summaryText,
                identityText: "Verified",
                identityState: .verified
            )
        }
        if needsIdentityReview {
            return DerivedAudioRowStatus(
                status: .needsReview,
                reason: "Track title and artist still need confirmation.",
                actionKind: .verifyIdentity,
                actionText: "Verify track info",
                availableSummary: timing.summaryText,
                identityText: "Needs Review",
                identityState: .needsReview
            )
        }
        if !timing.missing.isEmpty {
            let missingPhraseOnly = timing.missing.count == 1 && timing.missing[0] == "XD: Phrase Cues"
            return DerivedAudioRowStatus(
                status: .partial,
                reason: "Missing \(timing.missingText).",
                actionKind: missingPhraseOnly ? .none : .reviewDetails,
                actionText: missingPhraseOnly ? "No action needed" : "Review details",
                availableSummary: timing.summaryText,
                identityText: "Verified",
                identityState: .verified
            )
        }
        return DerivedAudioRowStatus(
            status: .complete,
            reason: "Required timing layers are available.",
            actionKind: .none,
            actionText: "No action needed",
            availableSummary: timing.summaryText,
            identityText: "Verified",
            identityState: .verified
        )
    }

    private func summarizeTimingAvailability(_ names: [String]) -> (summaryText: String, missingText: String, missing: [String]) {
        let availableSet = Set(names)
        let required = ["XD: Song Structure", "XD: Phrase Cues", "XD: Beats", "XD: Bars"]
        let available = required.filter { availableSet.contains($0) }
        let missing = required.filter { !availableSet.contains($0) }
        let availableSummary = available.isEmpty ? "None yet" : available.map { $0.replacingOccurrences(of: "XD: ", with: "") }.joined(separator: ", ")
        let missingSummary = missing.isEmpty ? "None" : missing.map { $0.replacingOccurrences(of: "XD: ", with: "") }.joined(separator: ", ")
        return (availableSummary, missingSummary, missing)
    }

    private func isTempTrackName(_ title: String) -> Bool {
        let pattern = /^track-[a-f0-9]{8}$/
        return title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().wholeMatch(of: pattern) != nil
    }

    private func string(_ value: Any?) -> String {
        String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func bool(_ value: Any?) -> Bool {
        value as? Bool ?? false
    }

    private func strings(_ value: Any?) -> [String] {
        (value as? [Any] ?? []).map { string($0) }.filter { !$0.isEmpty }
    }

    private func modificationText(for url: URL) -> String {
        guard
            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey]),
            let date = values.contentModificationDate
        else {
            return "unknown"
        }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}

private struct DerivedAudioRowStatus {
    let status: AudioTrackStatus
    let reason: String
    let actionKind: AudioRowActionKind
    let actionText: String
    let availableSummary: String
    let identityText: String
    let identityState: AudioIdentityState
}
