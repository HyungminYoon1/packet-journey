export const SUMMARY_KEY = "web-lab-progress-v1";
export const RECORD_KEY = "packet-journey-achievements-v1";
export const APP_IDS = Object.freeze([
  "data-mirage", "echo-vault", "light-route", "logic-foundry", "neon-tactics",
  "orbit-courier", "packet-journey", "parcel-panic", "pixel-kitchen", "pocket-city",
  "route-race", "sense-lab", "swarm-garden", "think-forge", "traffic-lab",
]);
const MAX_BYTES = 8192;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
export function parseSummary(raw) {
  if (raw === null) return { version: 1, apps: {} };
  if (typeof raw !== "string" || raw.length > MAX_BYTES) return null;
  try {
    const value = JSON.parse(raw);
    if (!keys(value, ["version", "apps"]) || value.version !== 1 || !object(value.apps) ||
      Object.keys(value.apps).length > APP_IDS.length) return null;
    for (const [id, record] of Object.entries(value.apps)) {
      if (!APP_IDS.includes(id) || !keys(record, ["completed", "total", "updatedAt"]) ||
        !Number.isInteger(record.completed) || !Number.isInteger(record.total) ||
        record.completed < 0 || record.completed > record.total || record.total < 0 || record.total > 1000 ||
        typeof record.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.updatedAt) ||
        new Date(record.updatedAt).toISOString() !== record.updatedAt) return null;
    }
    return value;
  } catch { return null; }
}
function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}
export function createProgressStore(achievementIds, storage = browserStorage(), now = () => new Date()) {
  if (!Array.isArray(achievementIds) || achievementIds.length > 1000 ||
    new Set(achievementIds).size !== achievementIds.length ||
    achievementIds.some((id) => typeof id !== "string" || id.length > 100 || !/^[a-z0-9:-]+$/.test(id)) ||
    JSON.stringify({ version: 1, achievements: achievementIds }).length > MAX_BYTES)
    throw new TypeError("Invalid achievement IDs");
  const read = () => {
    try {
      const raw = storage?.getItem(RECORD_KEY);
      if (raw == null) return [];
      if (raw.length > MAX_BYTES) return null;
      const value = JSON.parse(raw);
      if (!keys(value, ["version", "achievements"]) || value.version !== 1 ||
        !Array.isArray(value.achievements) || value.achievements.length > achievementIds.length ||
        new Set(value.achievements).size !== value.achievements.length ||
        value.achievements.some((id) => !achievementIds.includes(id))) return null;
      return value.achievements;
    } catch { return null; }
  };
  const summary = (completed) => {
    const value = parseSummary(storage.getItem(SUMMARY_KEY));
    if (!value) return false;
    value.apps["packet-journey"] = { completed, total: achievementIds.length, updatedAt: now().toISOString() };
    const raw = JSON.stringify(value);
    if (raw.length > MAX_BYTES) return false;
    storage.setItem(SUMMARY_KEY, raw);
    return true;
  };
  return {
    list: () => read() || [],
    complete(id) {
      if (!achievementIds.includes(id)) return { saved: false, summary: false };
      try {
        if (!storage) return { saved: false, summary: false };
        const previous = read();
        if (!previous) return { saved: false, summary: false };
        // An already completed item may repair a missing aggregate, using a real completion time.
        if (!previous.includes(id)) storage.setItem(RECORD_KEY,
          JSON.stringify({ version: 1, achievements: [...previous, id] }));
        const durable = read();
        if (!durable?.includes(id)) return { saved: false, summary: false };
        return { saved: true, summary: summary(durable.length) };
      } catch { return { saved: (read() || []).includes(id), summary: false }; }
    },
    clear() {
      try {
        if (!storage) return false;
        storage.removeItem(RECORD_KEY);
        const value = parseSummary(storage.getItem(SUMMARY_KEY));
        if (!value) return false;
        if (Object.hasOwn(value.apps, "packet-journey")) {
          delete value.apps["packet-journey"];
          storage.setItem(SUMMARY_KEY, JSON.stringify(value));
        }
        return true;
      } catch { return false; }
    },
  };
}
