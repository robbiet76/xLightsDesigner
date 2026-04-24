import Foundation

protocol HistoryService: Sendable {
    func loadHistory(for project: ActiveProjectModel?) throws -> HistoryServiceResult
}

struct HistoryServiceResult: Sendable {
    let summary: HistorySummaryModel
    let rows: [HistoryRowModel]
    let detailsByID: [String: HistorySelectedEventModel]
    let banners: [WorkflowBannerModel]
}

struct LocalHistoryService: HistoryService {
    func loadHistory(for project: ActiveProjectModel?) throws -> HistoryServiceResult {
        guard let project else {
            return HistoryServiceResult(
                summary: HistorySummaryModel(
                    totalEventCount: 0,
                    latestEventSummary: "No history available.",
                    latestEventTimestamp: "",
                    groupedTypeSummaries: []
                ),
                rows: [],
                detailsByID: [:],
                banners: [WorkflowBannerModel(id: "history-no-project", text: "Open a project to inspect retrospective history.", state: .blocked)]
            )
        }

        let projectFileURL = URL(fileURLWithPath: project.projectFilePath)
        let projectDir = projectFileURL.deletingLastPathComponent()
        let artifactsDir = projectDir.appendingPathComponent("artifacts", isDirectory: true)
        let historyDir = projectDir.appendingPathComponent("history", isDirectory: true)

        var events = [HistoryEventRecord]()
        events.append(try buildProjectFileEvent(project: project, projectFileURL: projectFileURL))
        events.append(contentsOf: try buildHistoryEntryEvents(project: project, historyDir: historyDir))
        events.append(contentsOf: try buildArtifactEvents(project: project, artifactsDir: artifactsDir))
        events.sort { $0.date > $1.date }

        let rows = events.map { event in
            HistoryRowModel(
                id: event.id,
                timestampSummary: Self.displayDateFormatter.string(from: event.date),
                eventType: event.eventType,
                summary: event.summary,
                sequenceSummary: event.sequenceSummary,
                resultSummary: event.resultState.rawValue,
                artifactAvailabilitySummary: event.artifactPath == nil ? "No artifact" : "Artifact available"
            )
        }

        let detailsByID = Dictionary(uniqueKeysWithValues: events.map { event in
            (
                event.id,
                HistorySelectedEventModel(
                    identity: event.summary,
                    timestamp: Self.detailDateFormatter.string(from: event.date),
                    eventType: event.eventType,
                    relatedProjectSummary: project.projectName,
                    relatedSequenceSummary: event.sequenceSummary,
                    changeSummary: event.changeSummary,
                    resultSummary: event.resultSummary,
                    proofChain: event.proofChain,
                    artifactPath: event.artifactPath,
                    artifactReferences: event.artifactReferences,
                    warnings: event.warnings,
                    followUpSummary: event.followUpSummary
                )
            )
        })

        let groupedTypeSummaries = Dictionary(grouping: events, by: \.eventType)
            .map { "\($0.key): \($0.value.count)" }
            .sorted()

        let latest = events.first
        let banners: [WorkflowBannerModel] = events.isEmpty
            ? [WorkflowBannerModel(id: "history-empty", text: "This project has not accumulated retrospective history yet.", state: .none)]
            : [WorkflowBannerModel(id: "history-retrospective", text: "History is retrospective only. Pending decisions remain in Review.", state: .ready)]

        return HistoryServiceResult(
            summary: HistorySummaryModel(
                totalEventCount: events.count,
                latestEventSummary: latest?.summary ?? "No history available.",
                latestEventTimestamp: latest.map { Self.displayDateFormatter.string(from: $0.date) } ?? "",
                groupedTypeSummaries: groupedTypeSummaries
            ),
            rows: rows,
            detailsByID: detailsByID,
            banners: banners
        )
    }

    private func buildProjectFileEvent(project: ActiveProjectModel, projectFileURL: URL) throws -> HistoryEventRecord {
        let values = try projectFileURL.resourceValues(forKeys: [.contentModificationDateKey])
        let date = values.contentModificationDate ?? .distantPast
        let activeSequenceName = string(project.snapshot["activeSequence"]?.value, fallback: "No active sequence")
        return HistoryEventRecord(
            id: "project-file::\(projectFileURL.path)",
            date: date,
            eventType: "Project Snapshot",
            summary: "Project file updated",
            sequenceSummary: activeSequenceName,
            resultState: .recorded,
            resultSummary: "Saved project snapshot at \(project.fileName).",
            changeSummary: "Project settings, sequence references, and durable project state were updated.",
            proofChain: [],
            artifactPath: projectFileURL.path,
            artifactReferences: [projectFileURL.lastPathComponent],
            warnings: [],
            followUpSummary: "Use Project for the current editable state; History is retrospective."
        )
    }

    private func buildArtifactEvents(project: ActiveProjectModel, artifactsDir: URL) throws -> [HistoryEventRecord] {
        guard FileManager.default.fileExists(atPath: artifactsDir.path) else { return [] }
        let files = try FileManager.default.subpathsOfDirectory(atPath: artifactsDir.path)
            .filter { $0.hasSuffix(".json") }

        return try files.compactMap { relativePath in
            let fileURL = artifactsDir.appendingPathComponent(relativePath)
            let values = try fileURL.resourceValues(forKeys: [.contentModificationDateKey])
            let date = values.contentModificationDate ?? .distantPast
            let object = try readJSONObject(at: fileURL)
            let folder = fileURL.deletingLastPathComponent().lastPathComponent
            let eventType = eventTypeLabel(for: folder)
            let summary = buildSummary(for: folder, object: object)
            let sequenceSummary = string(project.snapshot["activeSequence"]?.value, fallback: "No active sequence")
            let resultState: HistoryEventResultState = folder == "analysis" ? .ready : .recorded
            let resultSummary = buildResultSummary(for: folder, object: object)
            let changeSummary = buildChangeSummary(for: folder, object: object)
            let warnings = buildWarnings(for: folder, object: object)
            let references = buildReferences(for: folder, object: object, fileURL: fileURL)
            let proofChain = buildProofChain(for: folder, object: object)
            let followUpSummary = buildFollowUpSummary(for: folder)

            return HistoryEventRecord(
                id: "artifact::\(fileURL.path)",
                date: date,
                eventType: eventType,
                summary: summary,
                sequenceSummary: sequenceSummary,
                resultState: resultState,
                resultSummary: resultSummary,
                changeSummary: changeSummary,
                proofChain: proofChain,
                artifactPath: fileURL.path,
                artifactReferences: references,
                warnings: warnings,
                followUpSummary: followUpSummary
            )
        }
    }

    private func buildHistoryEntryEvents(project: ActiveProjectModel, historyDir: URL) throws -> [HistoryEventRecord] {
        guard FileManager.default.fileExists(atPath: historyDir.path) else { return [] }
        let files = try FileManager.default.contentsOfDirectory(at: historyDir, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles])
            .filter { $0.pathExtension == "json" }
        return try files.compactMap { fileURL in
            let object = try readJSONObject(at: fileURL)
            guard string(object["artifactType"]) == "history_entry_v1" else { return nil }
            let values = try fileURL.resourceValues(forKeys: [.contentModificationDateKey])
            let date = parseDate(object["createdAt"]) ?? values.contentModificationDate ?? .distantPast
            let status = string(object["status"], fallback: "unknown")
            let before = string(object["xlightsRevisionBefore"])
            let after = string(object["xlightsRevisionAfter"])
            let revisionSummary = before.isEmpty && after.isEmpty
                ? "Revision: unknown"
                : "Revision: \(before.isEmpty ? "unknown" : before) -> \(after.isEmpty ? "unknown" : after)"
            let snapshotSummary = object["snapshotSummary"] as? [String: Any]
            let applySummary = snapshotSummary?["applySummary"] as? [String: Any]
            let commandCount = int(object["commandCount"]) > 0 ? int(object["commandCount"]) : int(applySummary?["commandCount"])
            return HistoryEventRecord(
                id: "history::\(string(object["historyEntryId"], fallback: fileURL.path))",
                date: date,
                eventType: "Review Pass",
                summary: string(object["summary"], fallback: "Review pass recorded"),
                sequenceSummary: string(object["sequencePath"], fallback: string(project.snapshot["activeSequence"]?.value, fallback: "No active sequence")),
                resultState: status == "applied" ? .ready : .recorded,
                resultSummary: "Review pass \(status). \(revisionSummary).",
                changeSummary: commandCount > 0 ? "Applied proof-loop pass with \(commandCount) commands." : "Recorded proof-loop pass.",
                proofChain: historyEntryProofChain(object),
                artifactPath: fileURL.path,
                artifactReferences: historyEntryReferences(object, fileURL: fileURL),
                warnings: historyEntryWarnings(object),
                followUpSummary: "Use this review-pass rollup to compare request scope, apply proof, and render feedback across passes."
            )
        }
    }

    private func readJSONObject(at url: URL) throws -> [String: Any] {
        let data = try Data(contentsOf: url)
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private func eventTypeLabel(for folder: String) -> String {
        switch folder {
        case "analysis": return "Audio Analysis"
        case "briefs": return "Creative Brief"
        case "proposals": return "Proposal"
        case "intent-handoffs": return "Intent Handoff"
        case "director-profiles": return "Director Profile"
        case "design-scene": return "Design Scene"
        case "music-context": return "Music Context"
        default: return folder.replacingOccurrences(of: "-", with: " ").capitalized
        }
    }

    private func buildSummary(for folder: String, object: [String: Any]) -> String {
        switch folder {
        case "analysis":
            let title = string((object["track"] as? [String: Any])?["displayName"])
            return title.isEmpty ? "Stored audio analysis artifact" : "Stored audio analysis for \(title)"
        case "briefs", "proposals", "director-profiles", "design-scene":
            return string(object["summary"], fallback: "Stored \(eventTypeLabel(for: folder).lowercased()) artifact")
        case "intent-handoffs":
            return string(object["goal"], fallback: "Stored intent handoff")
        case "plans":
            let commands = (object["commands"] as? [Any])?.count ?? 0
            let summary = string(object["summary"])
            return summary.isEmpty ? "Stored sequencing plan with \(commands) commands" : summary
        case "apply-results":
            let status = string(object["status"], fallback: "unknown")
            let nextRevision = string(object["nextRevision"])
            return nextRevision.isEmpty ? "Stored apply result: \(status)" : "Stored apply result: \(status), revision \(nextRevision)"
        case "render-observations":
            let leadModel = string((object["macro"] as? [String: Any])?["leadModel"])
            return leadModel.isEmpty ? "Stored render observation" : "Stored render observation for \(leadModel)"
        case "render-critique-contexts":
            let breadthRead = string((object["observed"] as? [String: Any])?["breadthRead"])
            return breadthRead.isEmpty ? "Stored render critique context" : "Stored render critique context: \(breadthRead)"
        case "music-context":
            let sections = ((object["sectionArc"] as? [[String: Any]]) ?? []).compactMap { string($0["label"]) }
            return sections.isEmpty ? "Stored music context" : "Stored music context with \(sections.count) labeled sections"
        default:
            return "Stored \(eventTypeLabel(for: folder).lowercased()) artifact"
        }
    }

    private func buildResultSummary(for folder: String, object: [String: Any]) -> String {
        if folder == "proposals", let lifecycle = object["lifecycle"] as? [String: Any] {
            let status = string(lifecycle["status"], fallback: "unknown")
            return "Proposal lifecycle: \(status)"
        }
        if folder == "apply-results" {
            let status = string(object["status"], fallback: "unknown")
            let currentRevision = string(object["currentRevision"])
            let nextRevision = string(object["nextRevision"])
            if !currentRevision.isEmpty || !nextRevision.isEmpty {
                return "Apply \(status): \(currentRevision.isEmpty ? "unknown" : currentRevision) -> \(nextRevision.isEmpty ? "unknown" : nextRevision)"
            }
            return "Apply \(status)."
        }
        if folder == "render-observations" || folder == "render-critique-contexts" {
            return "Render feedback artifact captured for proof-loop inspection."
        }
        return "Artifact captured and available for inspection."
    }

    private func buildChangeSummary(for folder: String, object: [String: Any]) -> String {
        switch folder {
        case "analysis":
            let timingTracks = ((object["timingTracks"] as? [[String: Any]]) ?? []).compactMap { string($0["name"]) }
            return timingTracks.isEmpty ? "Audio timing analysis was persisted." : "Timing coverage: \(timingTracks.joined(separator: ", "))."
        case "briefs":
            let sections = arrayOfStrings(object["sections"])
            return sections.isEmpty ? "Creative brief updated." : "Brief sections: \(sections.prefix(4).joined(separator: ", "))."
        case "proposals":
            let lines = arrayOfStrings(object["proposalLines"])
            return lines.isEmpty ? "Proposal bundle updated." : "Proposal lines: \(lines.prefix(3).joined(separator: " | "))."
        case "intent-handoffs":
            let targets = ((object["scope"] as? [String: Any]).flatMap { arrayOfStrings($0["targetIds"]) }) ?? []
            return targets.isEmpty ? "Intent handoff updated." : "Intent target scope: \(targets.count) targets."
        case "design-scene":
            let metadata = object["metadata"] as? [String: Any]
            let models = int(metadata?["modelCount"])
            let groups = int(metadata?["groupCount"])
            return "Design scene captured with \(models) models across \(groups) groups."
        case "music-context":
            let holds = ((object["designCues"] as? [String: Any]).flatMap { arrayOfStrings($0["holdMoments"]) }) ?? []
            return holds.isEmpty ? "Music context updated." : "Music context captured \(holds.count) hold moments."
        case "plans":
            let commands = (object["commands"] as? [Any])?.count ?? 0
            return "Sequencing plan captured with \(commands) commands."
        case "apply-results":
            let practicalValidation = object["practicalValidation"] as? [String: Any]
            let overallOk = bool(practicalValidation?["overallOk"])
            return overallOk ? "Apply proof passed practical validation." : "Apply proof captured validation details for review."
        case "render-observations":
            let source = object["source"] as? [String: Any]
            let samplingMode = string(source?["samplingMode"])
            return samplingMode.isEmpty ? "Render samples were observed." : "Render samples observed with \(samplingMode) sampling."
        case "render-critique-contexts":
            let observed = object["observed"] as? [String: Any]
            let lead = string(observed?["leadModel"])
            let breadth = string(observed?["breadthRead"])
            return [lead.isEmpty ? "" : "Lead: \(lead)", breadth.isEmpty ? "" : "Breadth: \(breadth)"].filter { !$0.isEmpty }.joined(separator: ". ")
        default:
            return "Artifact updated."
        }
    }

    private func buildWarnings(for folder: String, object: [String: Any]) -> [String] {
        switch folder {
        case "analysis":
            let track = object["track"] as? [String: Any]
            let verification = track?["verification"] as? [String: Any]
            let state = string(verification?["state"])
            return state == "verified" || state.isEmpty ? [] : ["Track identity still needs review."]
        case "proposals":
            let lifecycle = object["lifecycle"] as? [String: Any]
            let status = string(lifecycle?["status"])
            return status == "approved" || status.isEmpty ? [] : ["Proposal is not approved in this artifact snapshot."]
        case "apply-results":
            let practicalValidation = object["practicalValidation"] as? [String: Any]
            return bool(practicalValidation?["overallOk"]) ? [] : ["Practical validation did not pass cleanly."]
        default:
            return []
        }
    }

    private func buildReferences(for folder: String, object: [String: Any], fileURL: URL) -> [String] {
        switch folder {
        case "analysis":
            let track = object["track"] as? [String: Any]
            let displayName = string(track?["displayName"])
            return [displayName, fileURL.lastPathComponent].filter { !$0.isEmpty }
        case "intent-handoffs":
            let targets = ((object["scope"] as? [String: Any]).flatMap { arrayOfStrings($0["targetIds"]) }) ?? []
            return Array(targets.prefix(5)) + [fileURL.lastPathComponent]
        default:
            return [fileURL.lastPathComponent]
        }
    }

    private func buildProofChain(for folder: String, object: [String: Any]) -> [String] {
        switch folder {
        case "apply-results":
            return applyResultProofChain(object)
        case "render-observations":
            return renderObservationProofChain(object)
        case "render-critique-contexts":
            return renderCritiqueProofChain(object)
        case "plans":
            return planProofChain(object)
        default:
            return []
        }
    }

    private func planProofChain(_ object: [String: Any]) -> [String] {
        let metadata = object["metadata"] as? [String: Any]
        let requestScopeMode = string(metadata?["requestScopeMode"])
        let sections = arrayOfStrings(object["selectedSections"])
        let targets = arrayOfStrings(object["targetIds"])
        return [
            requestScopeMode.isEmpty ? "" : "Request scope: \(requestScopeMode)",
            sections.isEmpty ? "" : "Sections: \(sections.prefix(4).joined(separator: ", "))",
            targets.isEmpty ? "" : "Targets: \(targets.prefix(6).joined(separator: ", "))"
        ].filter { !$0.isEmpty }
    }

    private func applyResultProofChain(_ object: [String: Any]) -> [String] {
        let verification = object["verification"] as? [String: Any]
        let practicalValidation = object["practicalValidation"] as? [String: Any]
        let validationSummary = practicalValidation?["summary"] as? [String: Any]
        let readbackChecks = validationSummary?["readbackChecks"] as? [String: Any]
        let designChecks = validationSummary?["designChecks"] as? [String: Any]
        let renderCurrentSummary = string(object["renderCurrentSummary"])
        return [
            "Revision advanced: \(bool(verification?["revisionAdvanced"]) ? "yes" : "no")",
            "Expected mutations present: \(bool(verification?["expectedMutationsPresent"]) ? "yes" : "no")",
            "Practical validation: \(bool(practicalValidation?["overallOk"]) ? "passed" : "needs review")",
            "Readback checks: \(int(readbackChecks?["passed"])) passed, \(int(readbackChecks?["failed"])) failed",
            "Design checks: \(int(designChecks?["passed"])) passed, \(int(designChecks?["failed"])) failed",
            renderCurrentSummary.isEmpty ? "" : renderCurrentSummary
        ].filter { !$0.isEmpty }
    }

    private func renderObservationProofChain(_ object: [String: Any]) -> [String] {
        let macro = object["macro"] as? [String: Any]
        let source = object["source"] as? [String: Any]
        let observed = object["observed"] as? [String: Any]
        return [
            string(source?["samplingMode"]).isEmpty ? "" : "Sampling mode: \(string(source?["samplingMode"]))",
            string(source?["samplingDetail"]).isEmpty ? "" : "Sampling detail: \(string(source?["samplingDetail"]))",
            string(macro?["leadModel"]).isEmpty ? "" : "Lead model: \(string(macro?["leadModel"]))",
            string(observed?["breadthRead"]).isEmpty ? "" : "Breadth read: \(string(observed?["breadthRead"]))"
        ].filter { !$0.isEmpty }
    }

    private func renderCritiqueProofChain(_ object: [String: Any]) -> [String] {
        let observed = object["observed"] as? [String: Any]
        let comparison = object["comparison"] as? [String: Any]
        return [
            string(observed?["leadModel"]).isEmpty ? "" : "Observed lead: \(string(observed?["leadModel"]))",
            string(observed?["breadthRead"]).isEmpty ? "" : "Breadth read: \(string(observed?["breadthRead"]))",
            "Lead matches primary focus: \(bool(comparison?["leadMatchesPrimaryFocus"]) ? "yes" : "no")",
            "Localized focus expected: \(bool(comparison?["localizedFocusExpected"]) ? "yes" : "no")"
        ].filter { !$0.isEmpty }
    }

    private func historyEntryProofChain(_ object: [String: Any]) -> [String] {
        let snapshotSummary = object["snapshotSummary"] as? [String: Any]
        let sequenceSummary = snapshotSummary?["sequenceSummary"] as? [String: Any]
        let requestScope = sequenceSummary?["requestScope"] as? [String: Any]
        let passOutcome = sequenceSummary?["passOutcome"] as? [String: Any]
        let applySummary = snapshotSummary?["applySummary"] as? [String: Any]
        let practicalValidation = snapshotSummary?["practicalValidationSummary"] as? [String: Any]
        return [
            string(requestScope?["mode"]).isEmpty ? "" : "Request scope: \(string(requestScope?["mode"]))",
            string(requestScope?["reviewStartLevel"]).isEmpty ? "" : "Review start: \(string(requestScope?["reviewStartLevel"]))",
            string(passOutcome?["status"]).isEmpty ? "" : "Pass outcome: \(string(passOutcome?["status"]))",
            "Commands: \(int(applySummary?["commandCount"]))",
            practicalValidation == nil ? "" : "Practical validation: \(bool(practicalValidation?["overallOk"]) ? "passed" : "needs review")",
            practicalValidation == nil ? "" : "Validation failures: \(int(practicalValidation?["readbackFailed"])) readback, \(int(practicalValidation?["designFailed"])) design"
        ].filter { !$0.isEmpty }
    }

    private func historyEntryReferences(_ object: [String: Any], fileURL: URL) -> [String] {
        let refs = object["artifactRefs"] as? [String: Any]
        let values = refs?.values.map { string($0) }.filter { !$0.isEmpty } ?? []
        return Array(values.prefix(8)) + [fileURL.lastPathComponent]
    }

    private func historyEntryWarnings(_ object: [String: Any]) -> [String] {
        let snapshotSummary = object["snapshotSummary"] as? [String: Any]
        let practicalValidation = snapshotSummary?["practicalValidationSummary"] as? [String: Any]
        guard let practicalValidation, !bool(practicalValidation["overallOk"]) else { return [] }
        return ["Practical validation summary indicates this pass needs review."]
    }

    private func buildFollowUpSummary(for folder: String) -> String {
        switch folder {
        case "analysis":
            return "Use Audio to refine library analysis and track identity."
        case "briefs", "proposals", "director-profiles", "design-scene", "music-context":
            return "Use Design to continue current creative work."
        case "intent-handoffs":
            return "Use Sequence or Review to inspect current implementation readiness."
        case "plans", "apply-results", "render-observations", "render-critique-contexts":
            return "Use Review and History together to compare this proof-loop pass with the next pass."
        default:
            return "This event is retained for retrospective inspection only."
        }
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
        if let bool = value as? Bool { return bool }
        if let n = value as? NSNumber { return n.boolValue }
        return false
    }

    private func parseDate(_ value: Any?) -> Date? {
        let text = string(value)
        guard !text.isEmpty else { return nil }
        return ISO8601DateFormatter().date(from: text)
    }

    private func arrayOfStrings(_ value: Any?) -> [String] {
        if let rows = value as? [String] { return rows }
        if let rows = value as? [Any] {
            return rows.map { String(describing: $0).trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        }
        return []
    }

    private static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    private static let detailDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .medium
        return formatter
    }()
}

private struct HistoryEventRecord {
    let id: String
    let date: Date
    let eventType: String
    let summary: String
    let sequenceSummary: String
    let resultState: HistoryEventResultState
    let resultSummary: String
    let changeSummary: String
    let proofChain: [String]
    let artifactPath: String?
    let artifactReferences: [String]
    let warnings: [String]
    let followUpSummary: String
}
