import fs from "node:fs";
import path from "node:path";

function str(value = "") {
  return String(value || "").trim();
}

export function flushAutomationRequests({
  requestsDir,
  responsePathForId,
  reason = "Cleared stale automation request.",
  fsImpl = fs
} = {}) {
  const files = fsImpl.readdirSync(requestsDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const name of files) {
    const fullPath = path.join(requestsDir, name);
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
      const result = await invokeAction({ action, request, name, fullPath, id });
      fsImpl.writeFileSync(
        responsePathForId(id),
        JSON.stringify({ ok: true, id, action, result }, null, 2),
        "utf8"
      );
    } catch (err) {
      const id = str(request?.id || path.basename(name, ".json")) || path.basename(name, ".json");
      const action = str(request?.action);
      fsImpl.writeFileSync(
        responsePathForId(id),
        JSON.stringify({ ok: false, id, action, error: String(err?.message || err) }, null, 2),
        "utf8"
      );
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
