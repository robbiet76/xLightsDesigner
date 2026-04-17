#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <numeric>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "FSEQFile.h"

struct Args {
    std::string fseqPath;
    uint32_t startChannelZero = 0;
    uint32_t channelCount = 0;
    uint32_t windowStartMs = 0;
    uint32_t windowEndMs = 0;
    uint32_t nodeCount = 0;
    uint32_t channelsPerNode = 0;
    uint32_t activeThreshold = 8;
    std::string frameMode = "auto";
    uint32_t maxFrameCells = 250000;
};

static uint32_t computeSampleStride(uint64_t frameCells, uint32_t maxFrameCells) {
    if (frameCells == 0 || maxFrameCells == 0 || frameCells <= static_cast<uint64_t>(maxFrameCells)) {
        return 1;
    }
    uint64_t stride = (frameCells + static_cast<uint64_t>(maxFrameCells) - 1) / static_cast<uint64_t>(maxFrameCells);
    return static_cast<uint32_t>(std::max<uint64_t>(1, stride));
}

static bool parseUInt(const std::string& raw, uint32_t& out) {
    char* end = nullptr;
    unsigned long value = std::strtoul(raw.c_str(), &end, 10);
    if (end == nullptr || *end != '\0') return false;
    out = static_cast<uint32_t>(value);
    return true;
}

static std::optional<Args> parseArgs(int argc, char** argv) {
    Args args;
    for (int i = 1; i < argc; i += 2) {
        if (i + 1 >= argc) return std::nullopt;
        std::string key = argv[i];
        std::string value = argv[i + 1];
        if (key == "--fseq") args.fseqPath = value;
        else if (key == "--start-channel") {
            if (!parseUInt(value, args.startChannelZero)) return std::nullopt;
        } else if (key == "--channel-count") {
            if (!parseUInt(value, args.channelCount)) return std::nullopt;
        } else if (key == "--window-start-ms") {
            if (!parseUInt(value, args.windowStartMs)) return std::nullopt;
        } else if (key == "--window-end-ms") {
            if (!parseUInt(value, args.windowEndMs)) return std::nullopt;
        } else if (key == "--node-count") {
            if (!parseUInt(value, args.nodeCount)) return std::nullopt;
        } else if (key == "--channels-per-node") {
            if (!parseUInt(value, args.channelsPerNode)) return std::nullopt;
        } else if (key == "--active-threshold") {
            if (!parseUInt(value, args.activeThreshold)) return std::nullopt;
        } else if (key == "--frame-mode") {
            args.frameMode = value;
        } else if (key == "--max-frame-cells") {
            if (!parseUInt(value, args.maxFrameCells)) return std::nullopt;
        } else {
            return std::nullopt;
        }
    }
    if (args.fseqPath.empty() || args.windowEndMs <= args.windowStartMs || args.nodeCount == 0) {
        return std::nullopt;
    }
    if (args.channelCount > 0 && args.channelsPerNode == 0) {
        args.channelsPerNode = std::max<uint32_t>(1, args.channelCount / args.nodeCount);
    }
    return args;
}

static double meanOf(const std::vector<double>& values) {
    if (values.empty()) return 0.0;
    return std::accumulate(values.begin(), values.end(), 0.0) / static_cast<double>(values.size());
}

static int signOf(double value, double epsilon = 1e-6) {
    if (value > epsilon) return 1;
    if (value < -epsilon) return -1;
    return 0;
}

int main(int argc, char** argv) {
    auto parsed = parseArgs(argc, argv);
    if (!parsed.has_value()) {
        std::cerr << "usage: fseq_window_decoder --fseq PATH --start-channel N --channel-count N --window-start-ms N --window-end-ms N --node-count N [--channels-per-node N] [--active-threshold N] [--frame-mode auto|full|off] [--max-frame-cells N]\n";
        return 2;
    }
    const Args args = *parsed;

    std::unique_ptr<FSEQFile> fseq(FSEQFile::openFSEQFile(args.fseqPath));
    if (!fseq) {
        std::cerr << "failed to open fseq\n";
        return 1;
    }

    const uint32_t fileChannelCount = static_cast<uint32_t>(fseq->getChannelCount());
    if (args.startChannelZero >= fileChannelCount) {
        std::cerr << "start channel beyond fseq channel count\n";
        return 1;
    }
    if (args.channelCount == 0) {
        const uint32_t remaining = fileChannelCount - args.startChannelZero;
        const_cast<Args&>(args).channelCount = remaining;
    }
    if (args.startChannelZero + args.channelCount > fileChannelCount) {
        const_cast<Args&>(args).channelCount = fileChannelCount - args.startChannelZero;
    }
    if (args.channelsPerNode == 0) {
        const_cast<Args&>(args).channelsPerNode = std::max<uint32_t>(1, args.channelCount / std::max<uint32_t>(1, args.nodeCount));
    }

    const uint32_t stepMs = static_cast<uint32_t>(fseq->getStepTime());
    const uint64_t totalFrames = fseq->getNumFrames();
    const uint32_t startFrame = std::min<uint32_t>(args.windowStartMs / stepMs, static_cast<uint32_t>(totalFrames));
    const uint32_t endFrameExclusive = std::min<uint32_t>((args.windowEndMs + stepMs - 1) / stepMs, static_cast<uint32_t>(totalFrames));
    const uint32_t frameCountWindow = endFrameExclusive > startFrame ? endFrameExclusive - startFrame : 0;
    const uint64_t frameCells = static_cast<uint64_t>(frameCountWindow) * static_cast<uint64_t>(args.nodeCount);
    const uint32_t sampleStride =
        args.frameMode == "full" ? 1 : computeSampleStride(frameCells, args.maxFrameCells);
    const bool emitFrames =
        args.frameMode == "full" ||
        (args.frameMode == "auto" && frameCells > 0);
    if (endFrameExclusive <= startFrame) {
        nlohmann::json out = {
            {"decoded", true},
            {"frameCountWindow", 0},
            {"windowStartFrame", startFrame},
            {"windowEndFrameExclusive", endFrameExclusive},
            {"frameMode", args.frameMode},
            {"emittedFrames", false},
            {"sampleStride", sampleStride}
        };
        std::cout << out.dump();
        return 0;
    }

    fseq->prepareRead({{0, fileChannelCount}}, startFrame);

    std::vector<uint8_t> fullFrameBuffer(fileChannelCount, 0);
    std::vector<double> activeChannelRatios;
    std::vector<double> activeNodeRatios;
    std::vector<double> avgNodeBrightnesses;
    std::vector<double> centroidPositions;
    std::vector<double> runCounts;
    std::vector<double> longestRunRatios;
    std::vector<double> temporalChanges;
    double maxChannelLevel = 0.0;
    double totalChannelLevel = 0.0;
    uint64_t totalChannelsSeen = 0;
    int firstActiveFrameOffset = -1;
    std::vector<double> prevNodeBrightnesses;
    std::vector<nlohmann::json> frames;
    if (emitFrames) {
        frames.reserve(frameCountWindow);
    }

    for (uint32_t frame = startFrame; frame < endFrameExclusive; ++frame) {
        std::unique_ptr<FSEQFile::FrameData> frameData(fseq->getFrame(frame));
        if (!frameData) continue;
        std::fill(fullFrameBuffer.begin(), fullFrameBuffer.end(), 0);
        if (!frameData->readFrame(fullFrameBuffer.data(), fileChannelCount)) continue;

        uint32_t activeChannels = 0;
        uint32_t activeNodes = 0;
        double frameLevelSum = 0.0;
        double weightedNodeSum = 0.0;
        double nodeWeightSum = 0.0;
        uint32_t currentRun = 0;
        uint32_t runCount = 0;
        uint32_t longestRun = 0;
        std::vector<double> nodeBrightnesses;
        nodeBrightnesses.reserve(args.nodeCount);
        std::vector<uint8_t> nodeBrightnessBytes;
        std::vector<uint8_t> nodeActiveFlags;
        std::vector<nlohmann::json> nodeRgbValues;
        if (emitFrames) {
            nodeBrightnessBytes.reserve(args.nodeCount);
            nodeActiveFlags.reserve(args.nodeCount);
            nodeRgbValues.reserve(args.nodeCount);
        }

        for (uint32_t c = 0; c < args.channelCount; ++c) {
            const uint32_t absoluteChannel = args.startChannelZero + c;
            const double level = static_cast<double>(fullFrameBuffer[absoluteChannel]) / 255.0;
            frameLevelSum += level;
            totalChannelLevel += level;
            totalChannelsSeen++;
            if (level > maxChannelLevel) maxChannelLevel = level;
            if (fullFrameBuffer[absoluteChannel] > args.activeThreshold) activeChannels++;
        }

        for (uint32_t node = 0; node < args.nodeCount; ++node) {
            const uint32_t base = node * args.channelsPerNode;
            if (base >= args.channelCount) break;
            const uint32_t end = std::min<uint32_t>(base + args.channelsPerNode, args.channelCount);
            double nodeMax = 0.0;
            double nodeMean = 0.0;
            for (uint32_t c = base; c < end; ++c) {
                const uint32_t absoluteChannel = args.startChannelZero + c;
                const double level = static_cast<double>(fullFrameBuffer[absoluteChannel]) / 255.0;
                nodeMax = std::max(nodeMax, level);
                nodeMean += level;
            }
            nodeMean /= static_cast<double>(end - base);
            const double nodeBrightness = args.channelsPerNode >= 3 ? nodeMax : nodeMean;
            nodeBrightnesses.push_back(nodeBrightness);
            if (emitFrames) {
                uint8_t r = 0;
                uint8_t g = 0;
                uint8_t b = 0;
                const uint32_t absoluteBase = args.startChannelZero + base;
                if (args.channelsPerNode >= 3 && absoluteBase + 2 < fileChannelCount) {
                    r = fullFrameBuffer[absoluteBase];
                    g = fullFrameBuffer[absoluteBase + 1];
                    b = fullFrameBuffer[absoluteBase + 2];
                } else if (args.channelsPerNode == 2 && absoluteBase + 1 < fileChannelCount) {
                    r = fullFrameBuffer[absoluteBase];
                    g = fullFrameBuffer[absoluteBase + 1];
                } else if (absoluteBase < fileChannelCount) {
                    r = fullFrameBuffer[absoluteBase];
                    g = r;
                    b = r;
                }
                nodeBrightnessBytes.push_back(static_cast<uint8_t>(std::round(nodeBrightness * 255.0)));
                nodeActiveFlags.push_back(nodeBrightness > static_cast<double>(args.activeThreshold) / 255.0 ? 1 : 0);
                nodeRgbValues.push_back(nlohmann::json::array({r, g, b}));
            }
            if (nodeBrightness > static_cast<double>(args.activeThreshold) / 255.0) {
                activeNodes++;
                weightedNodeSum += nodeBrightness * static_cast<double>(node);
                nodeWeightSum += nodeBrightness;
                currentRun++;
            } else if (currentRun > 0) {
                runCount++;
                longestRun = std::max(longestRun, currentRun);
                currentRun = 0;
            }
        }
        if (currentRun > 0) {
            runCount++;
            longestRun = std::max(longestRun, currentRun);
        }

        const double activeChannelRatio = static_cast<double>(activeChannels) / static_cast<double>(args.channelCount);
        const double activeNodeRatio = static_cast<double>(activeNodes) / static_cast<double>(args.nodeCount);
        const double avgNodeBrightness = nodeBrightnesses.empty() ? 0.0 : meanOf(nodeBrightnesses);
        const double centroid = nodeWeightSum > 0.0 ? weightedNodeSum / nodeWeightSum / std::max(1u, args.nodeCount - 1) : 0.0;
        activeChannelRatios.push_back(activeChannelRatio);
        activeNodeRatios.push_back(activeNodeRatio);
        avgNodeBrightnesses.push_back(avgNodeBrightness);
        centroidPositions.push_back(centroid);
        runCounts.push_back(static_cast<double>(runCount));
        longestRunRatios.push_back(static_cast<double>(longestRun) / static_cast<double>(args.nodeCount));
        if (firstActiveFrameOffset < 0 && activeNodes > 0) {
            firstActiveFrameOffset = static_cast<int>(frame - startFrame);
        }
        if (!prevNodeBrightnesses.empty() && prevNodeBrightnesses.size() == nodeBrightnesses.size()) {
            double delta = 0.0;
            for (size_t i = 0; i < nodeBrightnesses.size(); ++i) {
                delta += std::abs(nodeBrightnesses[i] - prevNodeBrightnesses[i]);
            }
            temporalChanges.push_back(delta / static_cast<double>(nodeBrightnesses.size()));
        }
        prevNodeBrightnesses = std::move(nodeBrightnesses);

        if (emitFrames && ((frame - startFrame) % sampleStride == 0)) {
            frames.push_back({
                {"frameIndex", frame},
                {"frameOffset", frame - startFrame},
                {"frameTimeMs", frame * stepMs},
                {"activeNodeCount", activeNodes},
                {"activeNodeRatio", activeNodeRatio},
                {"averageNodeBrightness", avgNodeBrightness},
                {"centroidPosition", centroid},
                {"runCount", runCount},
                {"longestRunRatio", static_cast<double>(longestRun) / static_cast<double>(args.nodeCount)},
                {"nodeActive", nodeActiveFlags},
                {"nodeBrightness", nodeBrightnessBytes},
                {"nodeRgb", nodeRgbValues}
            });
        }
    }

    std::vector<double> centroidMotions;
    std::vector<double> centroidSignedDeltas;
    int centroidDirectionReversals = 0;
    int previousSign = 0;
    for (size_t i = 1; i < centroidPositions.size(); ++i) {
        const double delta = centroidPositions[i] - centroidPositions[i - 1];
        centroidMotions.push_back(std::abs(delta));
        centroidSignedDeltas.push_back(delta);
        const int sign = signOf(delta, 0.0025);
        if (sign != 0) {
            if (previousSign != 0 && sign != previousSign) {
                centroidDirectionReversals++;
            }
            previousSign = sign;
        }
    }
    double centroidNetTravel = 0.0;
    if (centroidPositions.size() >= 2) {
        centroidNetTravel = centroidPositions.back() - centroidPositions.front();
    }
    uint32_t positiveMotionCount = 0;
    uint32_t negativeMotionCount = 0;
    for (const double delta : centroidSignedDeltas) {
        const int sign = signOf(delta, 0.0025);
        if (sign > 0) positiveMotionCount++;
        else if (sign < 0) negativeMotionCount++;
    }

    nlohmann::json out;
    out["decoded"] = true;
    out["fseqVersionMajor"] = fseq->getVersionMajor();
    out["fseqVersionMinor"] = fseq->getVersionMinor();
    out["fileChannelCount"] = fileChannelCount;
    out["stepTimeMs"] = stepMs;
    out["frameCountTotal"] = fseq->getNumFrames();
    out["windowStartFrame"] = startFrame;
    out["windowEndFrameExclusive"] = endFrameExclusive;
    out["frameCountWindow"] = frameCountWindow;
    out["startChannel"] = args.startChannelZero + 1;
    out["channelCount"] = args.channelCount;
    out["nodeCount"] = args.nodeCount;
    out["channelsPerNode"] = args.channelsPerNode;
    out["activeThreshold"] = args.activeThreshold;
    out["frameMode"] = args.frameMode;
    out["emittedFrames"] = emitFrames;
    out["sampleStride"] = sampleStride;
    out["maxFrameCells"] = args.maxFrameCells;
    out["averageChannelLevel"] = totalChannelsSeen == 0 ? 0.0 : totalChannelLevel / static_cast<double>(totalChannelsSeen);
    out["maxChannelLevel"] = maxChannelLevel;
    out["averageActiveChannelRatio"] = meanOf(activeChannelRatios);
    out["maxActiveChannelRatio"] = activeChannelRatios.empty() ? 0.0 : *std::max_element(activeChannelRatios.begin(), activeChannelRatios.end());
    out["averageActiveNodeRatio"] = meanOf(activeNodeRatios);
    out["maxActiveNodeRatio"] = activeNodeRatios.empty() ? 0.0 : *std::max_element(activeNodeRatios.begin(), activeNodeRatios.end());
    out["averageNodeBrightness"] = meanOf(avgNodeBrightnesses);
    out["firstActiveFrameOffset"] = firstActiveFrameOffset < 0 ? nlohmann::json(nullptr) : nlohmann::json(firstActiveFrameOffset);
    out["averageCentroidPosition"] = meanOf(centroidPositions);
    out["centroidMotionMean"] = meanOf(centroidMotions);
    out["centroidMotionMax"] = centroidMotions.empty() ? 0.0 : *std::max_element(centroidMotions.begin(), centroidMotions.end());
    out["centroidNetTravel"] = centroidNetTravel;
    out["centroidDirectionReversals"] = centroidDirectionReversals;
    out["positiveMotionCount"] = positiveMotionCount;
    out["negativeMotionCount"] = negativeMotionCount;
    out["averageRunCount"] = meanOf(runCounts);
    out["averageLongestRunRatio"] = meanOf(longestRunRatios);
    out["temporalChangeMean"] = meanOf(temporalChanges);
    out["temporalChangeMax"] = temporalChanges.empty() ? 0.0 : *std::max_element(temporalChanges.begin(), temporalChanges.end());
    if (emitFrames) {
        out["frames"] = frames;
    }

    std::cout << out.dump();
    return 0;
}
