import test from "node:test";
import assert from "node:assert/strict";
import { APP_IDS, SUMMARY_KEY, RECORD_KEY, parseSummary, createProgressStore } from "../dist/src/progress.js";
const timestamp = "2026-10-09T01:23:45.000Z";
const record = { completed: 2, total: 5, updatedAt: timestamp };
function memoryStorage() {
  const data = new Map();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
test("bounded summary validates exactly 15 app IDs, counts, timestamp and fields", () => {
  assert.equal(APP_IDS.length, 15);
  assert.equal(new Set(APP_IDS).size, 15);
  assert.deepEqual(parseSummary(null), { version: 1, apps: {} });
  for (const value of ["{", "x".repeat(8193), JSON.stringify({ version: 2, apps: {} }),
    JSON.stringify({ version: 1, apps: { fake: record } }),
    ...[{ completed: -1 }, { completed: 6 }, { total: 1001 }, { total: 1.1 }, { updatedAt: "2026-02-30T00:00:00.000Z" },
      { updatedAt: "not-a-date" }, { seed: 1 }, { actions: [] }, { name: "someone" }].map((extra) =>
      JSON.stringify({ version: 1, apps: { "packet-journey": { ...record, ...extra } } }))])
    assert.equal(parseSummary(value), null);
  const valid = { version: 1, apps: Object.fromEntries(APP_IDS.map((id) => [id, record])) };
  assert.deepEqual(parseSummary(JSON.stringify(valid)), valid);
});
test("reads do not create progress; summary count comes from durable unique achievements", () => {
  const storage = memoryStorage(), ids = ["one", "two"], store = createProgressStore(ids, storage, () => new Date(timestamp));
  assert.deepEqual(store.list(), []);
  assert.equal(storage.data.size, 0);
  assert.equal(store.complete("not-a-task").saved, false);
  assert.equal(storage.data.size, 0);
  assert.deepEqual(store.complete("one"), { saved: true, summary: true });
  assert.deepEqual(store.complete("one"), { saved: true, summary: true });
  assert.equal(parseSummary(storage.getItem(SUMMARY_KEY)).apps["packet-journey"].completed, 1);
  assert.deepEqual(createProgressStore(ids, storage).list(), ["one"]);
  store.complete("two");
  assert.deepEqual(parseSummary(storage.getItem(SUMMARY_KEY)).apps["packet-journey"], { completed: 2, total: 2, updatedAt: timestamp });
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(RECORD_KEY))), ["version", "achievements"]);
});
test("read-modify-write and clearing preserve all sibling entries and unrelated storage", () => {
  const storage = memoryStorage(), store = createProgressStore(["one"], storage, () => new Date(timestamp));
  storage.setItem(SUMMARY_KEY, JSON.stringify({ version: 1, apps: { "sense-lab": record } }));
  storage.setItem("other-private-key", "untouched");
  store.complete("one");
  assert.deepEqual(parseSummary(storage.getItem(SUMMARY_KEY)).apps["sense-lab"], record);
  assert.equal(store.clear(), true);
  assert.equal(storage.getItem(RECORD_KEY), null);
  assert.deepEqual(parseSummary(storage.getItem(SUMMARY_KEY)), { version: 1, apps: { "sense-lab": record } });
  assert.equal(storage.getItem("other-private-key"), "untouched");
});
test("malformed, unknown or excessive stored achievements fail closed", () => {
  for (const raw of ["{", "x".repeat(8193), JSON.stringify({ version: 1, achievements: ["unknown"] }),
    JSON.stringify({ version: 1, achievements: ["one", "one"] }), JSON.stringify({ version: 1, achievements: ["one"], extra: "bad" })]) {
    const storage = memoryStorage(); storage.setItem(RECORD_KEY, raw);
    const store = createProgressStore(["one"], storage);
    assert.deepEqual(store.list(), []);
    assert.equal(store.complete("one").saved, false);
    assert.equal(storage.getItem(RECORD_KEY), raw);
    assert.equal(storage.getItem(SUMMARY_KEY), null);
  }
});
test("corrupt aggregate is never overwritten even when own completion is saved", () => {
  const storage = memoryStorage(), store = createProgressStore(["one"], storage);
  storage.setItem(SUMMARY_KEY, "malformed");
  assert.deepEqual(store.complete("one"), { saved: true, summary: false });
  assert.equal(storage.getItem(SUMMARY_KEY), "malformed");
  assert.equal(store.clear(), false);
  assert.equal(storage.getItem(SUMMARY_KEY), "malformed");
  assert.equal(storage.getItem(RECORD_KEY), null);
});
test("denied reads and quota failures never invent durable completion", () => {
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  const store = createProgressStore(["one"], denied);
  assert.deepEqual(store.list(), []);
  assert.equal(store.complete("one").saved, false);
  assert.equal(store.clear(), false);
  const storage = memoryStorage(); storage.setItem = () => { throw new Error("quota"); };
  assert.equal(createProgressStore(["one"], storage).complete("one").saved, false);
  assert.equal(storage.getItem(SUMMARY_KEY), null);
});

test("aggregate-only quota failure preserves real private completion and can recover", () => {
  const storage = memoryStorage(), set = storage.setItem;
  storage.setItem = (key, value) => { if (key === SUMMARY_KEY) throw new Error("quota"); set(key, value); };
  const store = createProgressStore(["one"], storage, () => new Date(timestamp));
  assert.deepEqual(store.complete("one"), { saved: true, summary: false });
  assert.deepEqual(store.list(), ["one"]);
  assert.equal(storage.getItem(SUMMARY_KEY), null);
  storage.setItem = set;
  assert.deepEqual(store.complete("one"), { saved: true, summary: true });
  assert.equal(parseSummary(storage.getItem(SUMMARY_KEY)).apps["packet-journey"].completed, 1);
});

test("achievement catalog itself is ASCII, unique and bounded before any storage access", () => {
  for (const ids of [["한글"], ["one", "one"], ["x".repeat(101)], Array.from({ length: 1000 }, (_, i) => "long-achievement-name:" + i)])
    assert.throws(() => createProgressStore(ids, null), TypeError);
});
