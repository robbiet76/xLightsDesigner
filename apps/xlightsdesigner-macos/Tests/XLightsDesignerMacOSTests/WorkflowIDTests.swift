import Testing
@testable import XLightsDesignerMacOS

@Test func workflowOrderMatchesLockedNavigation() {
    #expect(WorkflowID.allCases == [
        .project,
        .layout,
        .audio,
        .design,
        .sequence,
        .review,
        .history,
    ])
}
