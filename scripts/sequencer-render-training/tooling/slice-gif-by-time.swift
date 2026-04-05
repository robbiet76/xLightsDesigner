import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Args {
    let input: String
    let output: String
    let startMs: Double
    let endMs: Double
}

func parseArgs() -> Args {
    var input: String?
    var output: String?
    var startMs: Double?
    var endMs: Double?

    var i = 1
    while i < CommandLine.arguments.count {
        let arg = CommandLine.arguments[i]
        switch arg {
        case "--input":
            i += 1
            input = CommandLine.arguments[i]
        case "--output":
            i += 1
            output = CommandLine.arguments[i]
        case "--start-ms":
            i += 1
            startMs = Double(CommandLine.arguments[i])
        case "--end-ms":
            i += 1
            endMs = Double(CommandLine.arguments[i])
        default:
            fputs("Unknown argument: \(arg)\n", stderr)
            exit(1)
        }
        i += 1
    }

    guard let input, let output, let startMs, let endMs else {
        fputs("Usage: slice-gif-by-time.swift --input in.gif --output out.gif --start-ms 1000 --end-ms 2000\n", stderr)
        exit(1)
    }
    guard endMs > startMs else {
        fputs("end-ms must be greater than start-ms\n", stderr)
        exit(1)
    }

    return Args(input: input, output: output, startMs: startMs, endMs: endMs)
}

func frameDelayMs(props: NSDictionary) -> Double {
    let gif = props[kCGImagePropertyGIFDictionary as String] as? NSDictionary
    let unclamped = gif?[kCGImagePropertyGIFUnclampedDelayTime as String] as? Double
    let clamped = gif?[kCGImagePropertyGIFDelayTime as String] as? Double
    let seconds = unclamped ?? clamped ?? 0.02
    return max(seconds * 1000.0, 20.0)
}

let args = parseArgs()
let inputURL = URL(fileURLWithPath: args.input)
let outputURL = URL(fileURLWithPath: args.output)

guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil) else {
    fputs("Failed to open GIF source: \(args.input)\n", stderr)
    exit(1)
}

let frameCount = CGImageSourceGetCount(source)
guard frameCount > 0 else {
    fputs("No GIF frames found: \(args.input)\n", stderr)
    exit(1)
}

guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.gif.identifier as CFString, 0, nil) else {
    fputs("Failed to create GIF destination: \(args.output)\n", stderr)
    exit(1)
}

CGImageDestinationSetProperties(destination, [
    kCGImagePropertyGIFDictionary: [
        kCGImagePropertyGIFLoopCount: 0
    ]
] as CFDictionary)

var currentStartMs = 0.0
var includedFrames = 0

for index in 0..<frameCount {
    guard let props = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as NSDictionary? else {
        continue
    }
    let delayMs = frameDelayMs(props: props)
    let currentEndMs = currentStartMs + delayMs

    let overlapStart = max(currentStartMs, args.startMs)
    let overlapEnd = min(currentEndMs, args.endMs)
    if overlapEnd > overlapStart {
        guard let image = CGImageSourceCreateImageAtIndex(source, index, nil) else {
            fputs("Failed to read frame \(index)\n", stderr)
            exit(1)
        }
        let clippedDelayMs = max(overlapEnd - overlapStart, 20.0)
        let frameProps: CFDictionary = [
            kCGImagePropertyGIFDictionary: [
                kCGImagePropertyGIFDelayTime: clippedDelayMs / 1000.0,
                kCGImagePropertyGIFUnclampedDelayTime: clippedDelayMs / 1000.0
            ]
        ] as CFDictionary
        CGImageDestinationAddImage(destination, image, frameProps)
        includedFrames += 1
    }

    currentStartMs = currentEndMs
    if currentStartMs >= args.endMs {
        break
    }
}

guard includedFrames > 0 else {
    fputs("No frames overlapped requested range \(args.startMs)-\(args.endMs) ms\n", stderr)
    exit(1)
}

if !CGImageDestinationFinalize(destination) {
    fputs("Failed to finalize GIF slice: \(args.output)\n", stderr)
    exit(1)
}

print(outputURL.path)
