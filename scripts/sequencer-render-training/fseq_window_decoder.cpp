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
};

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

int main(int argc, char** argv) {
    auto parsed = parseArgs(argc, argv);
    if (!parsed.has_value()) {
        std::cerr << "usage: fseq_window_decoder --fseq PATH --start-channel N --channel-count N --window-start-ms N --window-end-ms N --node-count N [--channels-per-node N] [--active-threshold N]\n";
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
    if (endFrameExclusive <= startFrame) {
        nlohmann::json out = {
            {"decoded", true},
            {"frameCountWindow", 0},
            {"windowStartFrame", startFrame},
            {"windowEndFrameExclusive", endFrameExclusive}
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
    }

    std::vector<double> centroidMotions;
    for (size_t i = 1; i < centroidPositions.size(); ++i) {
        centroidMotions.push_back(std::abs(centroidPositions[i] - centroidPositions[i - 1]));
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
    out["frameCountWindow"] = endFrameExclusive - startFrame;
    out["startChannel"] = args.startChannelZero + 1;
    out["channelCount"] = args.channelCount;
    out["nodeCount"] = args.nodeCount;
    out["channelsPerNode"] = args.channelsPerNode;
    out["activeThreshold"] = args.activeThreshold;
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
    out["averageRunCount"] = meanOf(runCounts);
    out["averageLongestRunRatio"] = meanOf(longestRunRatios);
    out["temporalChangeMean"] = meanOf(temporalChanges);
    out["temporalChangeMax"] = temporalChanges.empty() ? 0.0 : *std::max_element(temporalChanges.begin(), temporalChanges.end());

    std::cout << out.dump();
    return 0;
}
