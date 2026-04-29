function str(value = "") {
  return String(value || "").trim();
}

function norm(value = "") {
  return str(value).toLowerCase();
}

export function ownedModalStateBlocked(data = {}) {
  const modalState = data?.modalState && typeof data.modalState === "object" ? data.modalState : null;
  return modalState?.observed !== false && (modalState?.blocked === true || norm(modalState?.blocked) === "true");
}

export function describeOwnedModalBlock(data = {}) {
  const modalState = data?.modalState && typeof data.modalState === "object" ? data.modalState : {};
  const modalCount = Number(modalState.modalCount || 0);
  const windows = Array.isArray(modalState.windows) ? modalState.windows : [];
  const titles = windows
    .filter((window) => window?.isModal !== false)
    .map((window) => str(window?.title || window?.className))
    .filter(Boolean)
    .slice(0, 5);
  const countText = modalCount > 0 ? ` (${modalCount})` : "";
  const titleText = titles.length ? `: ${titles.join(", ")}` : "";
  return `xLights modal blocked${countText}${titleText}`;
}

export function ownedModalBlockedMessage(health = {}) {
  const data = health?.data && typeof health.data === "object" ? health.data : {};
  if (!ownedModalStateBlocked(data)) return "";
  return `xLights is blocked by ${describeOwnedModalBlock(data)}`;
}

export function isOwnedHealthReady(health = {}) {
  const data = health?.data && typeof health.data === "object" ? health.data : {};
  const state = norm(data.state || data.startupState || data.status);
  const listenerReachable = data.listenerReachable === true;
  const appReady = data.appReady == null ? true : data.appReady === true;
  const startupSettled = data.startupSettled === true || state === "ready";
  return health?.ok === true && listenerReachable && appReady && startupSettled && !ownedModalStateBlocked(data);
}

export async function assertOwnedXlightsNotBlocked(endpoint = "", getOwnedHealth = null) {
  if (typeof getOwnedHealth !== "function") throw new Error("owned xLights health probe is required");
  const health = await getOwnedHealth(endpoint);
  const message = ownedModalBlockedMessage(health);
  if (message) throw new Error(message);
  return health;
}
