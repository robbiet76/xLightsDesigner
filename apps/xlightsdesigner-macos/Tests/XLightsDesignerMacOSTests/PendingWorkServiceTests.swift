import Testing
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
