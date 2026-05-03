import Foundation

struct PendingEffectPlacement: Sendable {
    let designId: String
    let designRevision: Int
    let designAuthor: String
    let targetId: String
    let layerIndex: Int
    let effectName: String
    let trackName: String
    let sectionLabel: String
    let startMs: Int
    let endMs: Int
}

struct PendingWorkReadModel: Sendable {
    let projectName: String
    let activeSequenceName: String
    let activeSequencePath: String
    let recentSequenceCount: Int
    let audioPath: String
    let briefSummary: String
    let briefGoalsSummary: String
    let briefInspirationSummary: String
    let briefSections: [String]
    let moodEnergyArc: String
    let narrativeCues: String
    let visualCues: String
    let proposalSummary: String
    let proposalLines: [String]
    let guidedQuestions: [String]
    let riskNotes: [String]
    let proposalLifecycleStatus: String
    let estimatedImpact: Int
    let executionModeSummary: String
    let constraintsSummary: String
    let intentGoal: String
    let intentTargetIDs: [String]
    let intentSectionCount: Int
    let appDesignGoal: String
    let appDesignMood: String
    let appDesignConstraints: String
    let appDesignTargetScope: String
    let appDesignReferences: String
    let appDesignApprovalNotes: String
    let appDesignUpdatedAt: String
    let directorPreferenceSummary: String
    let directorSummary: String
    let designSceneSummary: String
    let layoutModelCount: Int
    let layoutGroupCount: Int
    let musicSectionLabels: [String]
    let musicHoldMoments: [String]
    let artifactTimestampSummary: String
    let translationSource: String
    let proposalSectionCount: Int
    let proposalTargetCount: Int
    let proposalCommandCount: Int
    let proposalShouldUseFullSongStructureTrack: Bool
    let proposalEffectPlacements: [PendingEffectPlacement]
}

protocol PendingWorkService: Sendable {
    func loadPendingWork(for project: ActiveProjectModel?) throws -> PendingWorkReadModel?
}

struct LocalPendingWorkService: PendingWorkService {
    func loadPendingWork(for project: ActiveProjectModel?) throws -> PendingWorkReadModel? {
        guard let project else { return nil }
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        let artifactsDir = projectDir.appendingPathComponent("artifacts", isDirectory: true)
        let snapshot = project.snapshot.mapValues(\.value)

        let artifactBrief = try readLatestArtifact(in: artifactsDir.appendingPathComponent("briefs", isDirectory: true))
        let artifactProposal = try readLatestArtifact(in: artifactsDir.appendingPathComponent("proposals", isDirectory: true))
        let artifactIntent = try readLatestArtifact(in: artifactsDir.appendingPathComponent("intent-handoffs", isDirectory: true))
        let artifactDirector = try readLatestArtifact(in: artifactsDir.appendingPathComponent("director-profiles", isDirectory: true))
        let artifactScene = try readLatestArtifact(in: artifactsDir.appendingPathComponent("design-scene", isDirectory: true))
        let artifactMusic = try readLatestArtifact(in: artifactsDir.appendingPathComponent("music-context", isDirectory: true))

        let latestBrief = artifactBrief
        let latestProposal = artifactProposal
        let latestIntent = artifactIntent
        let latestDirector = artifactDirector
        let latestScene = artifactScene
        let latestMusic = artifactMusic
        let runtime: [String: Any]? = nil

        let activeSequenceRecord = try? LocalProjectSequenceStore().loadActiveSequence(project: project)
        let activeSequenceName = firstNonEmpty([
            string(activeSequenceRecord?.displayName),
            string(snapshot["activeSequence"])
        ])
        let recentSequences = arrayOfStrings(snapshot["recentSequences"])
        let audioPath = firstNonEmpty([
            string(activeSequenceRecord?.mediaPath),
            string(snapshot["audioPathInput"])
        ])
        let projectSequences = (snapshot["projectSequences"] as? [[String: Any]]) ?? []
        let activeProjectSequence = projectSequences.first(where: { bool($0["isActive"]) })
        let preferredSequencePath = string(activeProjectSequence?["sequencePath"])
        let liveSequencePath = string(snapshot["sequencePathInput"])
        let activeSequencePath = firstNonEmpty([
            string(activeSequenceRecord?.sequencePath),
            liveSequencePath,
            preferredSequencePath,
            recentSequences.first ?? ""
        ])
        let appDesignIntent = snapshot["appDesignIntent"] as? [String: Any] ?? [:]
        let appDesignGoal = string(appDesignIntent["goal"])
        let appDesignMood = string(appDesignIntent["mood"])
        let appDesignConstraints = string(appDesignIntent["constraints"])
        let appDesignTargetScope = string(appDesignIntent["targetScope"])
        let appDesignReferences = string(appDesignIntent["references"])
        let appDesignApprovalNotes = string(appDesignIntent["approvalNotes"])
        let appDesignUpdatedAt = string(appDesignIntent["updatedAt"])

        let briefSections = arrayOfStrings(latestBrief?["sections"])
        let proposalLines = arrayOfStrings(latestProposal?["proposalLines"])
        let intentTargets = (latestIntent?["scope"] as? [String: Any]).flatMap { arrayOfStrings($0["targetIds"]) } ?? []
        let lifecycle = latestProposal?["lifecycle"] as? [String: Any]
        let impact = latestProposal?["impact"] as? [String: Any]
        let metadata = latestScene?["metadata"] as? [String: Any]
        let holdMoments = ((latestMusic?["designCues"] as? [String: Any]).flatMap { arrayOfStrings($0["holdMoments"]) }) ?? []
        let sectionArc = ((latestMusic?["sectionArc"] as? [[String: Any]]) ?? []).compactMap { string($0["label"]) }.filter { !$0.isEmpty }
        let executionPlan = latestProposal?["executionPlan"] as? [String: Any]
        let constraints = latestIntent?["constraints"] as? [String: Any] ?? latestProposal?["constraints"] as? [String: Any]
        let directorPreferences = latestIntent?["directorPreferences"] as? [String: Any]
        let layoutModelCount = int(metadata?["modelCount"])
        let layoutGroupCount = int(metadata?["groupCount"])
        let effectPlacements = buildEffectPlacements(executionPlan?["effectPlacements"])
        let proposalScope = latestProposal?["scope"] as? [String: Any]
        let proposalScopeSections = arrayOfStrings(proposalScope?["sections"])
        let proposalScopeTargets = arrayOfStrings(proposalScope?["targetIds"])
        let runtimeDiagnostics = runtime?["diagnostics"] as? [String: Any]
        let runtimeExecutionPlan = runtimeDiagnostics?["proposalExecutionPlan"] as? [String: Any]
        let effectiveExecutionPlan = executionPlan ?? runtimeExecutionPlan
        let effectiveEffectPlacements = effectPlacements.isEmpty ? buildEffectPlacements(effectiveExecutionPlan?["effectPlacements"]) : effectPlacements
        let effectiveSectionCount = proposalScopeSections.isEmpty ? int(effectiveExecutionPlan?["sectionCount"]) : proposalScopeSections.count
        let effectiveTargetCount = proposalScopeTargets.isEmpty ? int(effectiveExecutionPlan?["targetCount"]) : proposalScopeTargets.count
        let effectiveSectionPlans = (effectiveExecutionPlan?["sectionPlans"] as? [[String: Any]]) ?? []
        let sectionPlanCommandEstimate = effectiveSectionPlans.reduce(0) { total, row in
            let targets = arrayOfStrings(row["targetIds"])
            return total + max(1, targets.count)
        }
        let proposedRows = snapshot["proposed"] as? [Any]
        let effectiveCommandCount = max(
            effectiveEffectPlacements.count,
            sectionPlanCommandEstimate,
            proposalLines.count,
            proposedRows?.count ?? 0
        )

        let timestamps = [
            string(latestBrief?["createdAt"]),
            string(latestProposal?["createdAt"]),
            string(latestIntent?["createdAt"]),
            string(latestDirector?["createdAt"]),
            string(latestScene?["createdAt"]),
            string(latestMusic?["createdAt"]),
            string(runtime?["updatedAt"])
        ].filter { !$0.isEmpty }.sorted()

        return PendingWorkReadModel(
            projectName: project.projectName,
            activeSequenceName: activeSequenceName.isEmpty ? "No active sequence" : activeSequenceName,
            activeSequencePath: activeSequencePath.isEmpty ? "No active sequence path" : activeSequencePath,
            recentSequenceCount: recentSequences.count,
            audioPath: audioPath.isEmpty ? "No audio path selected" : audioPath,
            briefSummary: string(latestBrief?["summary"], fallback: appDesignGoal.isEmpty ? "No creative brief available." : appDesignGoal),
            briefGoalsSummary: string(latestBrief?["goalsSummary"], fallback: appDesignGoal.isEmpty ? "No explicit goals captured." : appDesignGoal),
            briefInspirationSummary: string(latestBrief?["inspirationSummary"], fallback: appDesignReferences.isEmpty ? "No explicit inspiration captured." : appDesignReferences),
            briefSections: briefSections,
            moodEnergyArc: string(latestBrief?["moodEnergyArc"], fallback: appDesignMood.isEmpty ? "No mood/energy arc available." : appDesignMood),
            narrativeCues: string(latestBrief?["narrativeCues"], fallback: appDesignApprovalNotes.isEmpty ? "No narrative cues available." : appDesignApprovalNotes),
            visualCues: string(latestBrief?["visualCues"], fallback: appDesignReferences.isEmpty ? "No visual cues available." : appDesignReferences),
            proposalSummary: string(latestProposal?["summary"], fallback: appDesignGoal.isEmpty ? "No proposal bundle available." : appDesignGoal),
            proposalLines: proposalLines,
            guidedQuestions: arrayOfStrings(latestProposal?["guidedQuestions"]),
            riskNotes: arrayOfStrings(latestProposal?["riskNotes"]),
            proposalLifecycleStatus: string(lifecycle?["status"], fallback: "unknown"),
            estimatedImpact: int(impact?["estimatedImpact"]),
            executionModeSummary: buildExecutionModeSummary(executionPlan: effectiveExecutionPlan),
            constraintsSummary: buildConstraintsSummary(constraints: constraints, appFallback: appDesignConstraints),
            intentGoal: string(latestIntent?["goal"], fallback: appDesignGoal.isEmpty ? "No intent handoff available." : appDesignGoal),
            intentTargetIDs: intentTargets,
            intentSectionCount: (latestIntent?["scope"] as? [String: Any]).map { arrayOfStrings($0["sections"]).count } ?? 0,
            appDesignGoal: appDesignGoal,
            appDesignMood: appDesignMood,
            appDesignConstraints: appDesignConstraints,
            appDesignTargetScope: appDesignTargetScope,
            appDesignReferences: appDesignReferences,
            appDesignApprovalNotes: appDesignApprovalNotes,
            appDesignUpdatedAt: appDesignUpdatedAt,
            directorPreferenceSummary: buildDirectorPreferenceSummary(intentPreferences: directorPreferences, learnedPreferences: latestDirector?["preferences"] as? [String: Any]),
            directorSummary: string(latestDirector?["summary"], fallback: "No director profile available."),
            designSceneSummary: buildSceneSummary(metadata: metadata),
            layoutModelCount: layoutModelCount,
            layoutGroupCount: layoutGroupCount,
            musicSectionLabels: sectionArc,
            musicHoldMoments: holdMoments,
            artifactTimestampSummary: timestamps.last ?? (appDesignUpdatedAt.isEmpty ? project.updatedAt : appDesignUpdatedAt),
            translationSource: latestProposal == nil ? (appDesignGoal.isEmpty ? "Pending" : "App Design Intent") : "Canonical Plan",
            proposalSectionCount: effectiveSectionCount,
            proposalTargetCount: effectiveTargetCount,
            proposalCommandCount: effectiveCommandCount,
            proposalShouldUseFullSongStructureTrack: bool(effectiveExecutionPlan?["shouldUseFullSongStructureTrack"]),
            proposalEffectPlacements: effectiveEffectPlacements
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

    private func buildExecutionModeSummary(executionPlan: [String: Any]?) -> String {
        guard let executionPlan else { return "No execution plan available." }
        let mode = string(executionPlan["implementationMode"], fallback: "unknown mode")
        let passScope = string(executionPlan["passScope"], fallback: "unknown scope")
        let targetCount = int(executionPlan["targetCount"])
        let sectionCount = int(executionPlan["sectionCount"])
        return "\(mode), \(passScope), \(targetCount) targets, \(sectionCount) sections"
    }

    private func buildConstraintsSummary(constraints: [String: Any]?, appFallback: String = "") -> String {
        guard let constraints else {
            let fallback = appFallback.trimmingCharacters(in: .whitespacesAndNewlines)
            return fallback.isEmpty ? "No sequencing constraints recorded." : fallback
        }
        let tolerance = string(constraints["changeTolerance"], fallback: "unspecified")
        let preserveTiming = bool(constraints["preserveTimingTracks"]) ? "preserve timing tracks" : "timing tracks may change"
        let globalRewrite = bool(constraints["allowGlobalRewrite"]) ? "global rewrite allowed" : "global rewrite constrained"
        return "\(tolerance) change tolerance, \(preserveTiming), \(globalRewrite)"
    }

    private func buildDirectorPreferenceSummary(intentPreferences: [String: Any]?, learnedPreferences: [String: Any]?) -> String {
        if let focus = intentPreferences?["focusElements"] {
            let focusElements = arrayOfStrings(focus)
            if !focusElements.isEmpty {
                return "Focus bias toward \(focusElements.prefix(4).joined(separator: ", "))"
            }
        }
        guard let learnedPreferences else { return "No director preference summary available." }
        let ranked = learnedPreferences.keys.sorted()
        if ranked.isEmpty { return "No director preference summary available." }
        return "Prefers \(ranked.prefix(3).joined(separator: ", "))"
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

    private func firstNonEmpty(_ values: [String]) -> String {
        values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.first(where: { !$0.isEmpty }) ?? ""
    }

    private func buildEffectPlacements(_ value: Any?) -> [PendingEffectPlacement] {
        guard let rows = value as? [[String: Any]] else { return [] }
        return rows.map { row in
            let timingContext = row["timingContext"] as? [String: Any]
            return PendingEffectPlacement(
                designId: string(row["designId"]),
                designRevision: int(row["designRevision"]),
                designAuthor: string(row["designAuthor"]),
                targetId: string(row["targetId"], fallback: "Unresolved"),
                layerIndex: int(row["layerIndex"]),
                effectName: string(row["effectName"], fallback: "Unknown Effect"),
                trackName: string(timingContext?["trackName"], fallback: "XD: Sequencer Plan"),
                sectionLabel: string(timingContext?["anchorLabel"], fallback: "General"),
                startMs: int(row["startMs"]),
                endMs: int(row["endMs"])
            )
        }
    }

}

private extension [String] {
    func ifEmpty(_ fallback: [String]) -> [String] {
        isEmpty ? fallback : self
    }
}
