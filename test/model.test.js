import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../dist/src/model.js";
test("normal cold request visits all seven stages", () => {
  const run = createJourney();
  assert.equal(run.stages.length, 7);
  assert.equal(run.total, 390);
  assert.equal(run.failed, false);
});
test("DNS cache reduces model time without bypassing HTTP", () => {
  const run = createJourney({ cache: "dns" });
  assert.equal(run.stages[1].id, "dns-cache");
  assert.equal(run.total, 312);
  assert.ok(run.stages.some((s) => s.id === "request"));
});
test("fresh page cache bypasses the network even offline", () => {
  const run = createJourney({ cache: "http", scenario: "offline" });
  assert.equal(run.total, 33);
  assert.equal(run.failed, false);
  assert.ok(run.stages.every((s) => s.node === "browser"));
});
test("DNS failure prevents TCP and HTTP", () => {
  const run = createJourney({ scenario: "dns-error" });
  assert.equal(run.stages.length, 2);
  assert.equal(run.failed, true);
  assert.equal(run.stages.at(-1).id, "dns-failure");
});
test("valid DNS cache avoids unavailable DNS server", () =>
  assert.equal(
    createJourney({ cache: "dns", scenario: "dns-error" }).failed,
    false,
  ));
test("HTTP 500 occurs after a successful connection and request", () => {
  const run = createJourney({ scenario: "server-error" });
  assert.ok(run.stages.some((s) => s.id === "tcp"));
  assert.ok(run.stages.some((s) => s.id === "request"));
  assert.equal(run.stages.at(-1).id, "http-error");
  assert.equal(run.failed, true);
});
test("offline without page cache stops at browser", () => {
  const run = createJourney({ scenario: "offline", cache: "dns" });
  assert.equal(run.total, 10);
  assert.equal(run.failed, true);
  assert.ok(run.stages.every((s) => s.node === "browser"));
});
test("all cache/scenario combinations have cumulative finite times", () => {
  for (const cache of ["none", "dns", "http"])
    for (const scenario of ["normal", "dns-error", "server-error", "offline"]) {
      const run = createJourney({ cache, scenario, latency: 300 });
      assert.equal(
        run.total,
        run.stages.reduce((sum, s) => sum + s.duration, 0),
      );
      assert.ok(run.stages.every((s) => Number.isFinite(s.elapsed)));
    }
});
test("invalid configuration is rejected", () => {
  for (const config of [
    { cache: "unknown" },
    { scenario: "unknown" },
    { latency: NaN },
    { latency: 0 },
    { latency: 900 },
  ])
    assert.throws(() => createJourney(config), TypeError);
});
