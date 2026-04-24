import Testing
import Foundation
@testable import XLightsDesignerMacOS

@Test func pendingWorkLoadsNativeDesignIntentWithoutGeneratedArtifacts() throws {
    let project = ActiveProjectModel(
        id: "project-1",
        projectName: "Christmas 2026",
        projectFilePath: "/tmp/nonexistent-native-design-only/Christmas 2026.xdproj",
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-04-23T00:00:00Z",
        updatedAt: "2026-04-23T00:00:00Z",
        snapshot: [
            "nativeDesignIntent": AnyCodable([
                "goal": "Make the chorus feel like a clean red and white canopy.",
                "mood": "Warm, crisp, elegant.",
                "constraints": "Keep dense sparkle off the singing faces.",
                "targetScope": "Mega tree, roofline, and window frames.",
                "references": "Use the warm neighborhood mission as the anchor.",
                "approvalNotes": "Ready to hand off after one more target pass.",
                "updatedAt": "2026-04-23T12:00:00Z"
            ]),
            "sequencePathInput": AnyCodable("/tmp/show/HolidayRoad.xsq")
        ]
    )

    let pending = try #require(try LocalPendingWorkService().loadPendingWork(for: project))

    #expect(pending.translationSource == "Native Design Intent")
    #expect(pending.intentGoal == "Make the chorus feel like a clean red and white canopy.")
    #expect(pending.briefSummary == "Make the chorus feel like a clean red and white canopy.")
    #expect(pending.constraintsSummary == "Keep dense sparkle off the singing faces.")
    #expect(pending.nativeDesignTargetScope == "Mega tree, roofline, and window frames.")
    #expect(pending.artifactTimestampSummary == "2026-04-23T12:00:00Z")
}

@Test func pendingWorkCountsSectionPlanProposalAsActionableCommands() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-pending-work-\(UUID().uuidString)", isDirectory: true)
    let projectDir = root.appendingPathComponent("Project", isDirectory: true)
    let proposalDir = projectDir.appendingPathComponent("artifacts/proposals", isDirectory: true)
    let intentDir = projectDir.appendingPathComponent("artifacts/intent-handoffs", isDirectory: true)
    try FileManager.default.createDirectory(at: proposalDir, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: intentDir, withIntermediateDirectories: true)

    try writeJSON([
        "artifactType": "proposal_bundle_v1",
        "artifactId": "proposal_bundle_v1-test",
        "createdAt": "2026-04-23T13:00:00Z",
        "summary": "Apply On effect to MegaTree during Chorus 1.",
        "proposalLines": ["Chorus 1 / MegaTree / apply On effect"],
        "scope": [
            "sections": ["Chorus 1"],
            "targetIds": ["MegaTree"]
        ],
        "executionPlan": [
            "sectionCount": 1,
            "targetCount": 1,
            "shouldUseFullSongStructureTrack": true,
            "sectionPlans": [
                [
                    "section": "Chorus 1",
                    "targetIds": ["MegaTree"],
                    "effectHints": ["On"],
                    "designId": "DES-001",
                    "designAuthor": "user"
                ]
            ],
            "effectPlacements": []
        ]
    ] as [String: Any], to: proposalDir.appendingPathComponent("proposal_bundle_v1-test.json"))
    try writeJSON([
        "artifactType": "intent_handoff_v1",
        "artifactId": "intent_handoff_v1-test",
        "createdAt": "2026-04-23T13:00:00Z",
        "goal": "Apply On effect to MegaTree during Chorus 1.",
        "scope": [
            "sections": ["Chorus 1"],
            "targetIds": ["MegaTree"]
        ],
        "executionStrategy": [
            "sectionPlans": [
                [
                    "section": "Chorus 1",
                    "targetIds": ["MegaTree"]
                ]
            ]
        ]
    ] as [String: Any], to: intentDir.appendingPathComponent("intent_handoff_v1-test.json"))

    let project = ActiveProjectModel(
        id: "project-1",
        projectName: "Christmas 2026",
        projectFilePath: projectDir.appendingPathComponent("Christmas 2026.xdproj").path,
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-04-23T00:00:00Z",
        updatedAt: "2026-04-23T00:00:00Z",
        snapshot: [
            "activeSequence": AnyCodable("HolidayRoad"),
            "sequencePathInput": AnyCodable("/tmp/show/HolidayRoad.xsq")
        ]
    )

    let pending = try #require(try LocalPendingWorkService().loadPendingWork(for: project))

    #expect(pending.translationSource == "Canonical Plan")
    #expect(pending.proposalCommandCount == 1)
    #expect(pending.proposalSectionCount == 1)
    #expect(pending.proposalTargetCount == 1)
}

private func writeJSON(_ object: [String: Any], to url: URL) throws {
    let data = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: url)
}
