import Foundation
import Testing
@testable import XLightsDesignerMacOS

@Test func historyShowsApplyResultProofChain() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-history-\(UUID().uuidString)", isDirectory: true)
    let projectDir = root.appendingPathComponent("Project", isDirectory: true)
    let applyDir = projectDir.appendingPathComponent("artifacts/apply-results", isDirectory: true)
    try FileManager.default.createDirectory(at: applyDir, withIntermediateDirectories: true)
    let projectFile = projectDir.appendingPathComponent("Christmas 2026.xdproj")
    try Data("{}".utf8).write(to: projectFile)
    try writeHistoryJSON([
        "artifactType": "apply_result_v1",
        "artifactId": "apply_result_v1-test",
        "status": "applied",
        "currentRevision": "rev-1",
        "nextRevision": "rev-2",
        "renderCurrentSummary": "Rendered xLights sequence: /tmp/HolidayRoad.xsq",
        "verification": [
            "revisionAdvanced": true,
            "expectedMutationsPresent": true
        ],
        "practicalValidation": [
            "artifactType": "practical_sequence_validation_v1",
            "overallOk": true,
            "summary": [
                "readbackChecks": ["passed": 3, "failed": 0],
                "designChecks": ["passed": 2, "failed": 0]
            ]
        ]
    ] as [String: Any], to: applyDir.appendingPathComponent("apply_result_v1-test.json"))
    let project = ActiveProjectModel(
        id: "project-1",
        projectName: "Christmas 2026",
        projectFilePath: projectFile.path,
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-04-24T00:00:00Z",
        updatedAt: "2026-04-24T00:00:00Z",
        snapshot: ["activeSequence": AnyCodable("HolidayRoad")]
    )

    let result = try LocalHistoryService().loadHistory(for: project)
    let row = try #require(result.rows.first { $0.eventType == "Apply Results" })
    let detail = try #require(result.detailsByID[row.id])

    #expect(row.summary.contains("revision rev-2"))
    #expect(detail.proofChain.contains("Revision advanced: yes"))
    #expect(detail.proofChain.contains("Expected mutations present: yes"))
    #expect(detail.proofChain.contains("Practical validation: passed"))
    #expect(detail.proofChain.contains("Readback checks: 3 passed, 0 failed"))
    #expect(detail.proofChain.contains("Design checks: 2 passed, 0 failed"))
}

@Test func historyShowsReviewPassRollupFromHistoryEntry() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-history-rollup-\(UUID().uuidString)", isDirectory: true)
    let projectDir = root.appendingPathComponent("Project", isDirectory: true)
    let historyDir = projectDir.appendingPathComponent("history", isDirectory: true)
    try FileManager.default.createDirectory(at: historyDir, withIntermediateDirectories: true)
    let projectFile = projectDir.appendingPathComponent("Christmas 2026.xdproj")
    try Data("{}".utf8).write(to: projectFile)
    try writeHistoryJSON([
        "artifactType": "history_entry_v1",
        "historyEntryId": "history_entry_v1-test",
        "createdAt": "2026-04-24T12:00:00Z",
        "status": "applied",
        "summary": "Applied chorus revision.",
        "sequencePath": "/tmp/show/HolidayRoad.xsq",
        "xlightsRevisionBefore": "rev-1",
        "xlightsRevisionAfter": "rev-2",
        "commandCount": 5,
        "artifactRefs": [
            "planId": "plan-1",
            "applyResultId": "apply-1",
            "renderObservationId": "render-1",
            "renderCritiqueContextId": "critique-1"
        ],
        "snapshotSummary": [
            "sequenceSummary": [
                "requestScope": [
                    "mode": "section_target_refinement",
                    "reviewStartLevel": "section"
                ],
                "passOutcome": [
                    "status": "stable"
                ]
            ],
            "applySummary": [
                "commandCount": 5
            ],
            "practicalValidationSummary": [
                "overallOk": false,
                "readbackFailed": 1,
                "designFailed": 2
            ]
        ]
    ] as [String: Any], to: historyDir.appendingPathComponent("history_entry_v1-test.json"))
    let project = ActiveProjectModel(
        id: "project-1",
        projectName: "Christmas 2026",
        projectFilePath: projectFile.path,
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-04-24T00:00:00Z",
        updatedAt: "2026-04-24T00:00:00Z",
        snapshot: [:]
    )

    let result = try LocalHistoryService().loadHistory(for: project)
    let row = try #require(result.rows.first { $0.eventType == "Review Pass" })
    let detail = try #require(result.detailsByID[row.id])

    #expect(row.summary == "Applied chorus revision.")
    #expect(detail.resultSummary.contains("rev-1 -> rev-2"))
    #expect(detail.proofChain.contains("Request scope: section_target_refinement"))
    #expect(detail.proofChain.contains("Review start: section"))
    #expect(detail.proofChain.contains("Pass outcome: stable"))
    #expect(detail.proofChain.contains("Commands: 5"))
    #expect(detail.proofChain.contains("Practical validation: needs review"))
    #expect(detail.proofChain.contains("Validation failures: 1 readback, 2 design"))
    #expect(detail.warnings.contains("Practical validation summary indicates this pass needs review."))
}

private func writeHistoryJSON(_ object: [String: Any], to url: URL) throws {
    let data = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: url)
}
