import SwiftUI

struct AdaptiveSplitView<Primary: View, Secondary: View>: View {
    let breakpoint: CGFloat
    let spacing: CGFloat
    @ViewBuilder let primary: () -> Primary
    @ViewBuilder let secondary: () -> Secondary

    init(
        breakpoint: CGFloat = 1100,
        spacing: CGFloat = 20,
        @ViewBuilder primary: @escaping () -> Primary,
        @ViewBuilder secondary: @escaping () -> Secondary
    ) {
        self.breakpoint = breakpoint
        self.spacing = spacing
        self.primary = primary
        self.secondary = secondary
    }

    var body: some View {
        GeometryReader { proxy in
            let useVertical = proxy.size.width < breakpoint
            ScrollView {
                AnyLayout(useVertical ? AnyLayout(VStackLayout(alignment: .leading, spacing: spacing)) : AnyLayout(HStackLayout(alignment: .top, spacing: spacing))) {
                    primary()
                        .frame(maxWidth: useVertical ? .infinity : nil, alignment: .topLeading)
                    secondary()
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .scrollIndicators(.hidden)
        }
    }
}
