function str(value = "") {
  return String(value || "").trim();
}

function formatDateTime(value = "") {
  const raw = str(value);
  if (!raw) return "(not set)";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleString([], { hour12: false });
}

export function buildProjectDashboardState({
  state = {}
} = {}) {
  const hasSavedProject = Boolean(str(state.projectFilePath));
  const catalog = Array.isArray(state.sequenceCatalog) ? state.sequenceCatalog : [];
  const currentSequencePath = str(state.sequencePathInput);
  const catalogHasCurrent = catalog.some((row) => str(row?.path) === currentSequencePath);
  const catalogOptions = [
    ...catalog.map((row) => ({
      path: str(row?.path),
      relativePath: str(row?.relativePath || row?.path),
      name: str(row?.name || str(row?.path).split("/").pop() || row?.relativePath),
      selected: str(row?.path) === currentSequencePath
    })),
    ...(!catalogHasCurrent && currentSequencePath
      ? [{
          path: currentSequencePath,
          relativePath: currentSequencePath,
          name: currentSequencePath.split("/").pop() || "Current",
          selected: true
        }]
      : [])
  ];
  const mediaFile = str(state.sequenceMediaFile || state.audioPathInput);
  const revision = str(state.currentSequenceRevision);
  const validationIssues = [];
  if (!hasSavedProject) {
    validationIssues.push({
      code: "no_saved_project",
      severity: "info",
      message: "No project file is open yet."
    });
  }
  if (!str(state.showFolder)) {
    validationIssues.push({
      code: "missing_show_directory",
      severity: "warning",
      message: "Show Directory is not configured."
    });
  }
  return {
    contract: "project_dashboard_state_v1",
    version: "1.0",
    page: "project",
    title: "Project",
    summary: hasSavedProject
      ? `Current project: ${str(state.projectName || "(unnamed)")}`
      : "No project file is open yet.",
    status: hasSavedProject ? "active" : "idle",
    readiness: {
      ok: hasSavedProject && Boolean(str(state.showFolder)),
      level: hasSavedProject ? "partial" : "blocked",
      reasons: validationIssues.map((issue) => issue.code)
    },
    warnings: validationIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    validationIssues,
    refs: {
      projectFilePath: str(state.projectFilePath || null),
      activeSequence: str(state.activeSequence || null),
      sequencePath: currentSequencePath || null
    },
    data: {
      lifecycle: {
        hasSavedProject,
        projectName: str(state.projectName || "(unnamed)")
      },
      summary: {
        projectConcept: str(state.projectConcept),
        showFolder: str(state.showFolder),
        mediaPath: str(state.mediaPath),
        xsqCount: Number(state.showDirectoryStats?.xsqCount || 0),
        xdmetaCount: Number(state.showDirectoryStats?.xdmetaCount || 0),
        createdAt: formatDateTime(state.projectCreatedAt),
        updatedAt: formatDateTime(state.projectUpdatedAt)
      },
      sequenceContext: {
        options: catalogOptions,
        activeSequence: str(state.activeSequence || "(none)"),
        mediaFile: mediaFile || "(none attached)",
        revision: revision || "(not loaded)",
        sequenceLoaded: Boolean(state.flags?.activeSequenceLoaded)
      }
    }
  };
}
