import Foundation

struct PendingWorkReadModel: Sendable {
    let projectName: String
    let activeSequenceName: String
    let activeSequencePath: String
    let recentSequenceCount: Int
    let briefSummary: String
    let briefSections: [String]
    let proposalSummary: String
    let proposalLines: [String]
    let proposalLifecycleStatus: String
    let estimatedImpact: Int
    let intentGoal: String
    let intentTargetIDs: [String]
    let directorSummary: String
    let designSceneSummary: String
    let musicSectionLabels: [String]
    let musicHoldMoments: [String]
    let artifactTimestampSummary: String
}

protocol PendingWorkService: Sendable {
    func loadPendingWork(for project: ActiveProjectModel?) throws -> PendingWorkReadModel?
}

struct LocalPendingWorkService: PendingWorkService {
    func loadPendingWork(for project: ActiveProjectModel?) throws -> PendingWorkReadModel? {
        guard let project else { return nil }
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        let artifactsDir = projectDir.appendingPathComponent("artifacts", isDirectory: true)
        guard FileManager.default.fileExists(atPath: artifactsDir.path) else { return nil }

        let latestBrief = try readLatestArtifact(in: artifactsDir.appendingPathComponent("briefs", isDirectory: true))
        let latestProposal = try readLatestArtifact(in: artifactsDir.appendingPathComponent("proposals", isDirectory: true))
        let latestIntent = try readLatestArtifact(in: artifactsDir.appendingPathComponent("intent-handoffs", isDirectory: true))
        let latestDirector = try readLatestArtifact(in: artifactsDir.appendingPathComponent("director-profiles", isDirectory: true))
        let latestScene = try readLatestArtifact(in: artifactsDir.appendingPathComponent("design-scene", isDirectory: true))
        let latestMusic = try readLatestArtifact(in: artifactsDir.appendingPathComponent("music-context", isDirectory: true))

        let snapshot = project.snapshot.mapValues(\.value)
        let activeSequenceName = string(snapshot["activeSequence"])
        let recentSequences = arrayOfStrings(snapshot["recentSequences"])
        let projectSequences = snapshot["projectSequences"] as? [[String: Any]] ?? []
        let activeProjectSequence = projectSequences.first(where: { bool($0["isActive"]) })
        let preferredSequencePath = string(activeProjectSequence?["sequencePath"])
        let activeSequencePath = preferredSequencePath.isEmpty ? (recentSequences.first ?? "") : preferredSequencePath

        let briefSections = arrayOfStrings(latestBrief?["sections"])
        let proposalLines = arrayOfStrings(latestProposal?["proposalLines"])
        let intentTargets = (latestIntent?["scope"] as? [String: Any]).flatMap { arrayOfStrings($0["targetIds"]) } ?? []
        let lifecycle = latestProposal?["lifecycle"] as? [String: Any]
        let impact = latestProposal?["impact"] as? [String: Any]
        let metadata = latestScene?["metadata"] as? [String: Any]
        let holdMoments = ((latestMusic?["designCues"] as? [String: Any]).flatMap { arrayOfStrings($0["holdMoments"]) }) ?? []
        let sectionArc = ((latestMusic?["sectionArc"] as? [[String: Any]]) ?? []).compactMap { string($0["label"]) }.filter { !$0.isEmpty }

        let timestamps = [
            string(latestBrief?["createdAt"]),
            string(latestProposal?["createdAt"]),
            string(latestIntent?["createdAt"]),
            string(latestDirector?["createdAt"]),
            string(latestScene?["createdAt"]),
            string(latestMusic?["createdAt"])
        ].filter { !$0.isEmpty }.sorted()

        return PendingWorkReadModel(
            projectName: project.projectName,
            activeSequenceName: activeSequenceName.isEmpty ? "No active sequence" : activeSequenceName,
            activeSequencePath: activeSequencePath.isEmpty ? "No active sequence path" : activeSequencePath,
            recentSequenceCount: recentSequences.count,
            briefSummary: string(latestBrief?["summary"], fallback: "No creative brief available."),
            briefSections: briefSections,
            proposalSummary: string(latestProposal?["summary"], fallback: "No proposal bundle available."),
            proposalLines: proposalLines,
            proposalLifecycleStatus: string(lifecycle?["status"], fallback: "unknown"),
            estimatedImpact: int(impact?["estimatedImpact"]),
            intentGoal: string(latestIntent?["goal"], fallback: "No intent handoff available."),
            intentTargetIDs: intentTargets,
            directorSummary: string(latestDirector?["summary"], fallback: "No director profile available."),
            designSceneSummary: buildSceneSummary(metadata: metadata),
            musicSectionLabels: sectionArc,
            musicHoldMoments: holdMoments,
            artifactTimestampSummary: timestamps.last ?? project.updatedAt
        )
    }

    private func readLatestArtifact(in directory: URL) throws -> [String: Any]? {
        guard FileManager.default.fileExists(atPath: directory.path) else { return nil }
        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles])
            .filter { $0.pathExtension == "json" }
        guard let latest = try files.max(by: { lhs, rhs in
            let l = try lhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? .distantPast
            let r = try rhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? .distantPast
            return l < r
        }) else { return nil }
        let data = try Data(contentsOf: latest)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    private func buildSceneSummary(metadata: [String: Any]?) -> String {
        guard let metadata else { return "No design-scene context available." }
        let modelCount = int(metadata["modelCount"])
        let groupCount = int(metadata["groupCount"])
        let submodelCount = int(metadata["submodelCount"])
        let layoutMode = string(metadata["layoutMode"], fallback: "unknown")
        return "\(modelCount) models, \(groupCount) groups, \(submodelCount) submodels, \(layoutMode.uppercased()) scene"
    }

    private func string(_ value: Any?, fallback: String = "") -> String {
        let text = String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? fallback : text
    }

    private func int(_ value: Any?) -> Int {
        if let n = value as? NSNumber { return n.intValue }
        return Int(String(describing: value ?? "")) ?? 0
    }

    private func bool(_ value: Any?) -> Bool {
        if let b = value as? Bool { return b }
        return String(describing: value ?? "").lowercased() == "true"
    }

    private func arrayOfStrings(_ value: Any?) -> [String] {
        if let rows = value as? [String] { return rows }
        if let rows = value as? [Any] {
            return rows.map { String(describing: $0).trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        }
        return []
    }
}
