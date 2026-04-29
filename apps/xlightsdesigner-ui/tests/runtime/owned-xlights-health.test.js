import test from "node:test";
import assert from "node:assert/strict";

import {
  assertOwnedXlightsNotBlocked,
  isOwnedHealthReady,
  ownedModalBlockedMessage,
  ownedModalStateBlocked
} from "../../runtime/owned-xlights-health.js";

test("owned xLights health treats all observed blocked modal types as blocking", async () => {
  const health = {
    ok: true,
    data: {
      state: "ready",
      listenerReachable: true,
      appReady: true,
      startupSettled: true,
      modalState: {
        observed: true,
        blocked: "true",
        modalCount: 2,
        windows: [
          { title: "Save Changes", isModal: true },
          { className: "wxMessageDialog", isModal: true }
        ]
      }
    }
  };

  assert.equal(ownedModalStateBlocked(health.data), true);
  assert.equal(isOwnedHealthReady(health), false);
  assert.match(ownedModalBlockedMessage(health), /Save Changes/);
  assert.match(ownedModalBlockedMessage(health), /wxMessageDialog/);
  await assert.rejects(
    () => assertOwnedXlightsNotBlocked("http://owned", async () => health),
    /xLights is blocked by xLights modal blocked \(2\): Save Changes, wxMessageDialog/
  );
});

test("owned xLights health ignores unobserved modal state", async () => {
  const health = {
    ok: true,
    data: {
      state: "ready",
      listenerReachable: true,
      appReady: true,
      startupSettled: true,
      modalState: {
        observed: false,
        blocked: true,
        windows: [{ title: "Stale" }]
      }
    }
  };

  assert.equal(ownedModalStateBlocked(health.data), false);
  assert.equal(isOwnedHealthReady(health), true);
  assert.equal(ownedModalBlockedMessage(health), "");
  assert.equal(await assertOwnedXlightsNotBlocked("http://owned", async () => health), health);
});
