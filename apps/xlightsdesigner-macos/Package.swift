// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "XLightsDesignerMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "XLightsDesignerMacOS", targets: ["XLightsDesignerMacOS"])
    ],
    targets: [
        .executableTarget(
            name: "XLightsDesignerMacOS",
            path: "Sources/XLightsDesignerMacOS"
        ),
        .testTarget(
            name: "XLightsDesignerMacOSTests",
            dependencies: ["XLightsDesignerMacOS"],
            path: "Tests/XLightsDesignerMacOSTests"
        )
    ]
)
