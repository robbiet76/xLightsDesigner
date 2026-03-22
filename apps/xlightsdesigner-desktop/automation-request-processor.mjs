import fs from "node:fs";
import path from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

function withTimeout(promise, timeoutMs = 0, label = "automation action") {
  if (!(timeoutMs > 0)) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

export function flushAutomationRequests({
  requestsDir,
  responsePathForId,
  reason = "Cleared stale automation request.",
  olderThanMs = 0,
  olderThanEpochMs = 0,
  nowMs = () => Date.now(),
  fsImpl = fs
} = {}) {
  const files = fsImpl.readdirSync(requestsDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const name of files) {
    const fullPath = path.join(requestsDir, name);
    if (olderThanEpochMs > 0) {
      try {
        const stats = fsImpl.statSync(fullPath);
        const mtimeMs = Number(stats.mtimeMs || 0);
        if (mtimeMs >= olderThanEpochMs) {
          continue;
        }
      } catch {
        // If stat fails, treat the request as flushable during startup cleanup.
      }
    }
    if (olderThanMs > 0) {
      try {
        const stats = fsImpl.statSync(fullPath);
        const ageMs = Math.max(0, Number(nowMs()) - Number(stats.mtimeMs || 0));
        if (ageMs < olderThanMs) {
          continue;
        }
      } catch {
        // If stat fails, treat the request as flushable during startup cleanup.
      }
    }
    let request = null;
    const idFallback = path.basename(name, ".json");
    try {
      request = JSON.parse(fsImpl.readFileSync(fullPath, "utf8"));
    } catch {
      request = null;
    }
    const id = str(request?.id || idFallback) || idFallback;
    const action = str(request?.action);
    try {
      fsImpl.writeFileSync(
        responsePathForId(id),
        JSON.stringify({ ok: false, id, action, error: reason }, null, 2),
        "utf8"
      );
    } catch {
      // ignore response write failures during startup cleanup
    }
    try {
      fsImpl.unlinkSync(fullPath);
    } catch {
      // ignore cleanup failures
    }
  }
}

export async function processAutomationRequestsOnce({
  requestsDir,
  responsePathForId,
  invokeAction,
  requestTimeoutMsForAction = () => 0,
  onRequestStart = () => {},
  onRequestFinish = () => {},
  fsImpl = fs
} = {}) {
  const files = fsImpl.readdirSync(requestsDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const name of files) {
    const fullPath = path.join(requestsDir, name);
    let request = null;
    try {
      request = JSON.parse(fsImpl.readFileSync(fullPath, "utf8"));
      const id = str(request?.id || path.basename(name, ".json")) || path.basename(name, ".json");
      const action = str(request?.action);
      onRequestStart({ id, action, request, name, fullPath });
      const timeoutMs = Number(requestTimeoutMsForAction({ action, request, name, fullPath, id }) || 0);
      const result = await withTimeout(
        invokeAction({ action, request, name, fullPath, id }),
        timeoutMs,
        `Automation action ${action || "missing"}`
      );
      fsImpl.writeFileSync(
        responsePathForId(id),
        JSON.stringify({ ok: true, id, action, result }, null, 2),
        "utf8"
      );
      onRequestFinish({ id, action, ok: true });
    } catch (err) {
      const id = str(request?.id || path.basename(name, ".json")) || path.basename(name, ".json");
      const action = str(request?.action);
      fsImpl.writeFileSync(
        responsePathForId(id),
        JSON.stringify({ ok: false, id, action, error: String(err?.message || err) }, null, 2),
        "utf8"
      );
      onRequestFinish({ id, action, ok: false, error: String(err?.message || err) });
    } finally {
      try {
        fsImpl.unlinkSync(fullPath);
      } catch {
        // ignore cleanup failures
      }
    }
  }
}

export function createSingleFlightAutomationProcessor({
  processOnce,
  onError = () => {}
} = {}) {
  let inFlight = false;
  let rerunRequested = false;
  let activePromise = null;

  async function drain() {
    try {
      do {
        rerunRequested = false;
        await processOnce();
      } while (rerunRequested);
    } catch (err) {
      onError(err);
    } finally {
      inFlight = false;
      activePromise = null;
    }
  }

  return {
    async processPending() {
      if (inFlight) {
        rerunRequested = true;
        return activePromise;
      }
      inFlight = true;
      activePromise = drain();
      return activePromise;
    }
  };
}
