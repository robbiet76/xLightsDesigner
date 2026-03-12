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
      readbackChecks.push((async () => {
        const modelName = String(params.modelName || "").trim();
        const layerIndex = Number(params.layerIndex);
        const startMs = Number(params.startMs);
        const endMs = Number(params.endMs);
        const effectName = String(params.effectName || "").trim();
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
