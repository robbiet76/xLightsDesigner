#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${XLIGHTS_BASE_URL:-http://127.0.0.1:49913}"
AUTOMATION_URL="${BASE_URL}/xlDoAutomation"
OUT_DIR="${1:-${OUT_DIR:-/tmp/xlights-demo-sequences}}"
SOURCE_SEQUENCE="${SOURCE_SEQUENCE:-}"

mkdir -p "${OUT_DIR}"

if [[ -z "${SOURCE_SEQUENCE}" || ! -f "${SOURCE_SEQUENCE}" ]]; then
  echo "Missing SOURCE_SEQUENCE: ${SOURCE_SEQUENCE:-<unset>}" >&2
  echo "Set SOURCE_SEQUENCE to an existing .xsq file." >&2
  exit 2
fi

post() {
  local payload="$1"
  curl -sS -X POST "${AUTOMATION_URL}" -H "Content-Type: application/json" -d "${payload}"
}

require_ok() {
  local label="$1"
  local body="$2"
  local res
  res="$(printf "%s" "${body}" | jq -r '.res // empty')"
  if [[ "${res}" != "200" ]]; then
    echo "FAILED: ${label}"
    echo "${body}"
    exit 1
  fi
}

first_model_name() {
  local body
  body="$(post '{"apiVersion":2,"cmd":"layout.getDisplayElements","params":{}}')"
  require_ok "layout.getDisplayElements" "${body}"
  printf "%s" "${body}" | jq -r '.data.elements[]? | select(.type != "timing") | .name' | head -n1
}

open_source_sequence() {
  local body
  body="$(post "{\"apiVersion\":2,\"cmd\":\"sequence.open\",\"params\":{\"file\":\"${SOURCE_SEQUENCE}\",\"force\":true}}")"
  require_ok "sequence.open ${SOURCE_SEQUENCE}" "${body}"
}

save_sequence_as() {
  local file_path="$1"
  local body
  body="$(post "{\"apiVersion\":2,\"cmd\":\"sequence.save\",\"params\":{\"file\":\"${file_path}\"}}")"
  require_ok "sequence.save ${file_path}" "${body}"
}

close_sequence() {
  local body
  body="$(post '{"apiVersion":2,"cmd":"sequence.close","params":{"force":true}}')"
  require_ok "sequence.close" "${body}"
}

# Demo 1: basic timing track authoring
open_source_sequence
body="$(post '{"apiVersion":2,"cmd":"timing.createTrack","params":{"trackName":"Demo_Beats","replaceIfExists":true}}')"
require_ok "timing.createTrack demo1" "${body}"
body="$(post '{"apiVersion":2,"cmd":"timing.insertMarks","params":{"trackName":"Demo_Beats","marks":[{"startMs":1000,"label":"Intro"},{"startMs":5000,"label":"Verse"},{"startMs":10000,"label":"Chorus"},{"startMs":18000,"label":"Bridge"}]}}')"
require_ok "timing.insertMarks demo1" "${body}"
save_sequence_as "${OUT_DIR}/API-Demo-01-BasicTiming.xsq"

# Demo 2: effects + layers
open_source_sequence
MODEL="$(first_model_name)"
if [[ -z "${MODEL}" ]]; then
  echo "FAILED: no non-timing model available"
  exit 1
fi
body="$(post '{"apiVersion":2,"cmd":"timing.createTrack","params":{"trackName":"Demo_Phrases","replaceIfExists":true}}')"
require_ok "timing.createTrack demo2" "${body}"
body="$(post '{"apiVersion":2,"cmd":"timing.insertMarks","params":{"trackName":"Demo_Phrases","marks":[{"startMs":0,"label":"P1"},{"startMs":15000,"label":"P2"},{"startMs":30000,"label":"P3"},{"startMs":45000,"label":"P4"}]}}')"
require_ok "timing.insertMarks demo2" "${body}"
body="$(post "{\"apiVersion\":2,\"cmd\":\"effects.create\",\"params\":{\"modelName\":\"${MODEL}\",\"layerIndex\":0,\"effectName\":\"On\",\"startMs\":0,\"endMs\":20000}}")"
require_ok "effects.create layer0 demo2" "${body}"
body="$(post "{\"apiVersion\":2,\"cmd\":\"effects.create\",\"params\":{\"modelName\":\"${MODEL}\",\"layerIndex\":1,\"effectName\":\"On\",\"startMs\":20000,\"endMs\":40000}}")"
require_ok "effects.create layer1 demo2" "${body}"
save_sequence_as "${OUT_DIR}/API-Demo-02-EffectsLayers.xsq"

# Demo 3: execute plan behavior
open_source_sequence
MODEL="$(first_model_name)"
PLAN_PAYLOAD="$(jq -nc --arg model "${MODEL}" '{apiVersion:2,cmd:"system.executePlan",params:{steps:[
  {cmd:"timing.createTrack",params:{trackName:"Demo_PlanTrack",replaceIfExists:true}},
  {cmd:"timing.insertMarks",params:{trackName:"Demo_PlanTrack",marks:[{startMs:1000,label:"A"},{startMs:12000,label:"B"},{startMs:24000,label:"C"}]}},
  {cmd:"effects.create",params:{modelName:$model,layerIndex:0,effectName:"On",startMs:1000,endMs:12000}},
  {cmd:"effects.create",params:{modelName:$model,layerIndex:0,effectName:"On",startMs:12000,endMs:24000}}
],rollbackOnFailure:true}}')"
body="$(post "${PLAN_PAYLOAD}")"
require_ok "system.executePlan demo3" "${body}"
save_sequence_as "${OUT_DIR}/API-Demo-03-PlanExecution.xsq"

close_sequence

ls -l "${OUT_DIR}"/API-Demo-*.xsq
