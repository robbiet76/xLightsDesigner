export const AUDIO_ANALYSIS_PROVIDER_IDS = ["librosa"];

function str(value = "") {
  return String(value || "").trim();
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeAudioAnalysisProvider(value = "") {
  const normalized = str(value).toLowerCase();
  return AUDIO_ANALYSIS_PROVIDER_IDS.includes(normalized) ? normalized : "librosa";
}

export function buildAudioAnalysisServiceRequest({
  filePath = "",
  baseUrl = "",
  provider = "librosa",
  analysisProfileMode = "",
  apiKey = "",
  authBearer = ""
} = {}) {
  return {
    filePath: str(filePath),
    baseUrl: str(baseUrl).replace(/\/+$/, ""),
    provider: normalizeAudioAnalysisProvider(provider),
    analysisProfileMode: str(analysisProfileMode).toLowerCase() || undefined,
    apiKey: str(apiKey) || undefined,
    authBearer: str(authBearer) || undefined
  };
}

export function summarizeProviderSelection(meta = {}) {
  const dataMeta = meta && typeof meta === "object" ? meta : {};
  const lines = [];
  const engine = str(dataMeta.engine);
  if (engine) {
    lines.push(`Analysis engine selected: ${engine}`);
  }
  const autoSelection = dataMeta.autoSelection && typeof dataMeta.autoSelection === "object"
    ? dataMeta.autoSelection
    : null;
  if (autoSelection) {
    const provider = str(autoSelection.selectedProvider);
    const score = finiteOrNull(autoSelection.selectedScore);
    if (provider) {
      lines.push(`Auto provider selection: ${provider}${Number.isFinite(score) ? ` (score ${score.toFixed(3)})` : ""}.`);
    }
  }
  return lines;
}
