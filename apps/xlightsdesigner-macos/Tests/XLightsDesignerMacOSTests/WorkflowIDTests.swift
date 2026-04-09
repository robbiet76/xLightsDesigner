import Testing
@testable import XLightsDesignerMacOS

@Test func workflowOrderMatchesLockedNavigation() {
    #expect(WorkflowID.allCases == [
        .project,
        .display,
        .audio,
        .design,
        .sequence,
        .review,
        .history,
    ])
}
