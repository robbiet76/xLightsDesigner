import fs from "node:fs";
import path from "node:path";

import { buildCustomModelStructureCatalog } from "../../apps/xlightsdesigner-ui/runtime/custom-model-catalog.js";
import { parseXLightsRgbEffectsCustomModelSceneGraph } from "../../apps/xlightsdesigner-ui/runtime/custom-model-xml.js";

function norm(value = "") {
  return String(value || "").trim();
}

function defaultAppStatePath() {
  return path.join(process.env.HOME || "", "Library/Application Support/xLightsDesigner/xlightsdesigner-state.json");
}

function readAppState(inputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  return raw?.localStateRaw ? JSON.parse(raw.localStateRaw) : raw;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    input: defaultAppStatePath(),
    output: "/tmp/custom-model-structure-catalog.v1.json",
    showDir: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input" || arg === "-i") {
      args.input = argv[++index] || args.input;
    } else if (arg === "--output" || arg === "-o") {
      args.output = argv[++index] || args.output;
    } else if (arg === "--show-dir") {
      args.showDir = argv[++index] || "";
    } else if (!arg.startsWith("-") && !args._inputSet) {
      args.input = arg;
      args._inputSet = true;
    } else if (!arg.startsWith("-") && !args._outputSet) {
      args.output = arg;
      args._outputSet = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function sceneGraphFromShowDir(showDir = "") {
  const resolvedShowDir = path.resolve(showDir);
  const rgbeffectsPath = path.join(resolvedShowDir, "xlights_rgbeffects.xml");
  if (!fs.existsSync(rgbeffectsPath)) {
    throw new Error(`xlights_rgbeffects.xml not found under ${resolvedShowDir}`);
  }
  return parseXLightsRgbEffectsCustomModelSceneGraph(fs.readFileSync(rgbeffectsPath, "utf8"));
}

function main() {
  const args = parseArgs();
  const state = args.showDir
    ? {
        sceneGraph: sceneGraphFromShowDir(args.showDir),
        projectName: path.basename(path.resolve(args.showDir)),
        sequencePathInput: "",
        health: { sceneGraphSource: "xlights_rgbeffects.xml" }
      }
    : readAppState(args.input);
  const catalog = buildCustomModelStructureCatalog({
    sceneGraph: state.sceneGraph || {},
    source: {
      statePath: args.showDir ? "" : args.input,
      showDir: args.showDir ? path.resolve(args.showDir) : "",
      projectName: norm(state.projectName),
      sequencePath: norm(state.sequencePathInput),
      sceneGraphSource: norm(state.health?.sceneGraphSource)
    }
  });
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(args.output);
}

main();
