function timingMarksSignature(marks = []) {
  const rows = (Array.isArray(marks) ? marks : [])
    .map((m) => {
      const s = Math.max(0, Math.round(Number(m?.startMs || 0)));
      const e = Math.max(s + 1, Math.round(Number(m?.endMs || (s + 1))));
      const l = String(m?.label || "").trim();
      return `${s}:${e}:${l}`;
    })
    .filter(Boolean)
    .sort();
  return rows.join("|");
}

function parseSubmodelParentId(target = "") {
  const name = String(target || "").trim();
  const idx = name.indexOf("/");
  if (idx <= 0) return "";
  return name.slice(0, idx);
}

function effectPlanKey(modelName = "", layerIndex = 0, startMs = 0, endMs = 0, effectName = "") {
  return [
    String(modelName || "").trim(),
    Number(layerIndex),
    Number(startMs),
    Number(endMs),
    String(effectName || "").trim()
  ].join("|");
}

export async function verifyAppliedPlanReadback(plan = [], deps = {}) {
  const commands = Array.isArray(plan) ? plan : [];
  const endpoint = String(deps?.endpoint || "").trim();
  const getTimingMarks = typeof deps?.getTimingMarks === "function" ? deps.getTimingMarks : null;
  const getDisplayElementOrder = typeof deps?.getDisplayElementOrder === "function" ? deps.getDisplayElementOrder : null;
  const listEffects = typeof deps?.listEffects === "function" ? deps.listEffects : null;
  const verification = {
    revisionAdvanced: false,
    expectedMutationsPresent: false,
    lockedTracksUnchanged: true,
    checks: []
  };
  const plannedEffectKeys = new Set(
    commands
      .filter((step) => String(step?.cmd || "").trim() === "effects.create")
      .map((step) => effectPlanKey(
        step?.params?.modelName,
        step?.params?.layerIndex,
        step?.params?.startMs,
        step?.params?.endMs,
        step?.params?.effectName
      ))
  );

  const readbackChecks = [];
  for (const step of commands) {
    const cmd = String(step?.cmd || "").trim();
    const params = step?.params && typeof step.params === "object" ? step.params : {};
    if ((cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") && String(params.trackName || "").trim() && getTimingMarks) {
      readbackChecks.push((async () => {
        const trackName = String(params.trackName || "").trim();
        const expectedSignature = timingMarksSignature(Array.isArray(params.marks) ? params.marks : []);
        const resp = await getTimingMarks(endpoint, trackName);
        const actualMarks = Array.isArray(resp?.data?.marks) ? resp.data.marks : [];
        const actualSignature = timingMarksSignature(actualMarks);
        const ok = Boolean(expectedSignature) && actualSignature === expectedSignature;
        return {
          kind: "timing",
          target: trackName,
          ok,
          detail: ok ? "mark signature matched" : "mark signature mismatch"
        };
      })());
    }
    if (cmd === "sequencer.setDisplayElementOrder" && Array.isArray(params.orderedIds) && params.orderedIds.length && getDisplayElementOrder) {
      readbackChecks.push((async () => {
        const expectedOrder = params.orderedIds.map((row) => String(row || "").trim()).filter(Boolean);
        const resp = await getDisplayElementOrder(endpoint);
        const elements = Array.isArray(resp?.data?.elements) ? resp.data.elements : [];
        const actualOrder = elements.map((row) => String(row?.id || row?.name || "").trim()).filter(Boolean);
        const ok =
          expectedOrder.length === actualOrder.length &&
          expectedOrder.every((id, idx) => id === actualOrder[idx]);
        return {
          kind: "display-order",
          target: "master-view",
          ok,
          detail: ok ? "display element order matched" : "display element order mismatch"
        };
      })());
    }
    if (cmd === "effects.create" && String(params.modelName || "").trim() && listEffects) {
      const modelName = String(params.modelName || "").trim();
      const parentId = parseSubmodelParentId(modelName);
      const layerIndex = Number(params.layerIndex);
      const startMs = Number(params.startMs);
      const endMs = Number(params.endMs);
      const effectName = String(params.effectName || "").trim();
      readbackChecks.push((async () => {
        const resp = await listEffects(endpoint, { modelName, layerIndex, startMs, endMs });
        const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
        const ok = effects.some((row) =>
          String(row?.effectName || "").trim() === effectName &&
          Number(row?.startMs) === startMs &&
          Number(row?.endMs) === endMs &&
          Number(row?.layerIndex) === layerIndex
        );
        return {
          kind: "effect",
          target: `${modelName}@${layerIndex}`,
          ok,
          detail: ok ? `${effectName} present` : `${effectName} missing`
        };
      })());
      if (parentId && !plannedEffectKeys.has(effectPlanKey(parentId, layerIndex, startMs, endMs, effectName))) {
        readbackChecks.push((async () => {
          const resp = await listEffects(endpoint, {
            modelName: parentId,
            layerIndex,
            startMs,
            endMs
          });
          const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
          const broadened = effects.some((row) =>
            String(row?.effectName || "").trim() === effectName &&
            Number(row?.startMs) === startMs &&
            Number(row?.endMs) === endMs &&
            Number(row?.layerIndex) === layerIndex
          );
          return {
            kind: "submodel-precision",
            target: `${modelName}->${parentId}@${layerIndex}`,
            ok: !broadened,
            detail: broadened ? `${effectName} broadened to parent` : "parent remained unchanged"
          };
        })());
      }
    }
  }

  const results = await Promise.allSettled(readbackChecks);
  verification.checks = results.map((row) => {
    if (row.status === "fulfilled") return row.value;
    return {
      kind: "readback",
      target: "",
      ok: false,
      detail: String(row.reason?.message || row.reason || "readback failed")
    };
  });
  verification.expectedMutationsPresent =
    verification.checks.length > 0 && verification.checks.every((row) => Boolean(row?.ok));
  return verification;
}

export { timingMarksSignature };
