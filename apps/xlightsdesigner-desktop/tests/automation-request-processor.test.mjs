import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  flushAutomationRequests,
  processAutomationRequestsOnce,
  createSingleFlightAutomationProcessor
} from "../automation-request-processor.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("single-flight automation processor does not execute the same request twice under overlapping polls", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-automation-"));
  const requestsDir = path.join(root, "requests");
  const responsesDir = path.join(root, "responses");
  fs.mkdirSync(requestsDir, { recursive: true });
  fs.mkdirSync(responsesDir, { recursive: true });

  fs.writeFileSync(
    path.join(requestsDir, "req-1.json"),
    JSON.stringify({ id: "req-1", action: "dispatchPrompt", payload: { prompt: "hello" } }),
    "utf8"
  );

  let invokeCount = 0;
  const processor = createSingleFlightAutomationProcessor({
    processOnce: () => processAutomationRequestsOnce({
      requestsDir,
      responsePathForId: (id) => path.join(responsesDir, `${id}.json`),
      invokeAction: async ({ action, request }) => {
        invokeCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { action, prompt: request?.payload?.prompt || "" };
      }
    }),
    onError: (err) => {
      throw err;
    }
  });

  await Promise.all([
    processor.processPending(),
    processor.processPending(),
    processor.processPending()
  ]);

  assert.equal(invokeCount, 1);
  assert.deepEqual(fs.readdirSync(requestsDir), []);
  assert.deepEqual(fs.readdirSync(responsesDir), ["req-1.json"]);
  assert.equal(readJson(path.join(responsesDir, "req-1.json")).ok, true);

  fs.rmSync(root, { recursive: true, force: true });
});

test("single-flight automation processor reruns once after overlap to pick up newly queued requests", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-automation-"));
  const requestsDir = path.join(root, "requests");
  const responsesDir = path.join(root, "responses");
  fs.mkdirSync(requestsDir, { recursive: true });
  fs.mkdirSync(responsesDir, { recursive: true });

  fs.writeFileSync(
    path.join(requestsDir, "req-1.json"),
    JSON.stringify({ id: "req-1", action: "dispatchPrompt", payload: { prompt: "first" } }),
    "utf8"
  );

  let invokeCount = 0;
  const seen = [];
  const processor = createSingleFlightAutomationProcessor({
    processOnce: () => processAutomationRequestsOnce({
      requestsDir,
      responsePathForId: (id) => path.join(responsesDir, `${id}.json`),
      invokeAction: async ({ request }) => {
        invokeCount += 1;
        seen.push(String(request?.payload?.prompt || ""));
        if (invokeCount === 1) {
          fs.writeFileSync(
            path.join(requestsDir, "req-2.json"),
            JSON.stringify({ id: "req-2", action: "dispatchPrompt", payload: { prompt: "second" } }),
            "utf8"
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { ok: true };
      }
    }),
    onError: (err) => {
      throw err;
    }
  });

  await Promise.all([
    processor.processPending(),
    processor.processPending()
  ]);

  assert.equal(invokeCount, 2);
  assert.deepEqual(seen, ["first", "second"]);
  assert.deepEqual(fs.readdirSync(requestsDir), []);
  assert.deepEqual(fs.readdirSync(responsesDir).sort(), ["req-1.json", "req-2.json"]);

  fs.rmSync(root, { recursive: true, force: true });
});

test("flushAutomationRequests clears queued requests and writes failure responses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-automation-"));
  const requestsDir = path.join(root, "requests");
  const responsesDir = path.join(root, "responses");
  fs.mkdirSync(requestsDir, { recursive: true });
  fs.mkdirSync(responsesDir, { recursive: true });

  fs.writeFileSync(
    path.join(requestsDir, "req-1.json"),
    JSON.stringify({ id: "req-1", action: "ping", payload: {} }),
    "utf8"
  );
  fs.writeFileSync(
    path.join(requestsDir, "req-2.json"),
    "{not-valid-json",
    "utf8"
  );

  flushAutomationRequests({
    requestsDir,
    responsePathForId: (id) => path.join(responsesDir, `${id}.json`),
    reason: "Cleared stale automation request during app startup."
  });

  assert.deepEqual(fs.readdirSync(requestsDir), []);
  assert.deepEqual(fs.readdirSync(responsesDir).sort(), ["req-1.json", "req-2.json"]);
  assert.deepEqual(readJson(path.join(responsesDir, "req-1.json")), {
    ok: false,
    id: "req-1",
    action: "ping",
    error: "Cleared stale automation request during app startup."
  });
  assert.deepEqual(readJson(path.join(responsesDir, "req-2.json")), {
    ok: false,
    id: "req-2",
    action: "",
    error: "Cleared stale automation request during app startup."
  });

  fs.rmSync(root, { recursive: true, force: true });
});
