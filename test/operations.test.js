import test from "node:test";
import assert from "node:assert/strict";
import { createTrace, createRouteTrace, transferPackets } from "../dist/src/model.js";
import { operations, createOperation, operationView, takeDecision, useOperationHint } from "../dist/src/missions.js";

const decide = (state, ...actions) => actions.reduce(takeDecision, state);
const connect = (id = "rescue", variant = 0, hard = false, route = "relay") => {
  let state = createOperation(id, variant, hard);
  state = decide(state, "fresh", id === "race" ? "dns-cache" : "backup", route);
  return decide(state, state.certificate === "expired" ? "renew" : "verify");
};

test("all 24 operation/variant/difficulty combinations have a viable goal", () => {
  for (const definition of operations) for (let variant = 0; variant < 3; variant++) for (const hard of [false, true]) {
    const state = definition.id === "offline-copy"
      ? decide(createOperation(definition.id, variant, hard), "use-cache")
      : decide(connect(definition.id, variant, hard), "burst");
    assert.equal(state.phase, "complete", `${definition.id}/${variant}/${hard}`);
    assert.ok(state.elapsed <= state.budget);
    assert.ok(state.attempts <= state.maxAttempts);
    assert.equal(operationView(state).score, 100);
    if (definition.id !== "offline-copy") {
      assert.equal(state.authenticated, true);
      assert.equal(new Set(state.packets.filter((p) => p.status === "ack").map((p) => p.id)).size, state.count);
    }
  }
});

test("decisions are pure and traces account for all cumulative time", () => {
  const before = createOperation(), snapshot = JSON.stringify(before);
  const after = decide(before, "fresh", "primary", "backup", "relay", "renew", "burst");
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(after.phase, "complete");
  assert.equal(after.faults, 1);
  let elapsed = 0;
  for (const entry of after.history) {
    assert.equal(entry.before, elapsed);
    assert.equal(entry.trace.total, entry.trace.stages.reduce((sum, s) => sum + s.duration, 0));
    elapsed += entry.trace.total;
    assert.equal(entry.after, elapsed);
    assert.equal(entry.trace.stages.at(-1).elapsed, entry.trace.total);
  }
  assert.equal(after.elapsed, elapsed);
  assert.equal(operationView(after).score, 85);
});

test("stale response cannot satisfy latest-response goal and consumes time", () => {
  const before = createOperation("rescue"), after = decide(before, "use-cache");
  assert.equal(after.phase, "cache");
  assert.equal(after.elapsed, 28);
  assert.equal(after.faults, 1);
  assert.equal(after.packets.length, 0);
  assert.equal(decide(after, "fresh").phase, "dns");
});

test("offline saved-copy goal accepts a stale response without network events", () => {
  const run = decide(createOperation("offline-copy", 1, true), "use-cache");
  assert.equal(run.phase, "complete");
  assert.equal(run.elapsed, 28);
  assert.equal(run.authenticated, false);
  assert.ok(run.history[0].trace.stages.every((s) => s.node === "browser"));
  const failedRoute = decide(createOperation("offline-copy"), "fresh", "backup");
  assert.equal(failedRoute.phase, "cache");
  assert.equal(decide(failedRoute, "use-cache").phase, "complete");
});

test("expired DNS cache and unavailable resolver do not start TCP", () => {
  const run = decide(createOperation(), "fresh", "dns-cache", "primary");
  assert.equal(run.phase, "dns");
  assert.equal(run.routeId, null);
  assert.equal(run.faults, 2);
  assert.ok(run.history.every((e) => e.trace.stages.every((s) => s.id !== "tcp")));
  assert.equal(decide(run, "backup").phase, "route");
});

test("valid DNS cache skips lookup but still requires route/TLS/transmission", () => {
  const run = decide(createOperation("race"), "fresh", "dns-cache");
  assert.equal(run.phase, "route");
  assert.equal(run.elapsed, 7);
  assert.equal(run.authenticated, false);
  assert.equal(run.packets.length, 0);
});

test("route outage stops TCP and a different route recovers", () => {
  const run = decide(createOperation("integrity"), "fresh", "primary", "direct");
  assert.equal(run.phase, "route");
  assert.equal(run.history.at(-1).trace.stages.at(-1).code, "SYN · TIMEOUT");
  assert.equal(run.authenticated, false);
  const recovered = decide(run, "relay", "renew", "burst");
  assert.equal(recovered.phase, "complete");
});

test("TLS failure and bypass never produce HTTP or ACK until certificate renewal", () => {
  const run = decide(createOperation(), "fresh", "backup", "relay", "verify", "bypass");
  assert.equal(run.phase, "tls");
  assert.equal(run.authenticated, false);
  assert.equal(run.packets.length, 0);
  assert.equal(run.faults, 2);
  assert.throws(() => takeDecision(run, "burst"), TypeError);
  assert.equal(decide(run, "renew", "burst").phase, "complete");
});

test("more hops can beat a short congested route despite higher RTT", () => {
  const direct = decide(connect("race", 0, false, "direct"), "burst", "retry-missing");
  const relay = decide(connect("race", 0, false, "relay"), "burst");
  assert.equal(relay.phase, "complete");
  assert.ok(relay.elapsed < direct.elapsed);
  assert.ok(relay.routes[1].hops.length > direct.routes[0].hops.length);
});

test("pacing lowers congestion/loss but costs more per packet on a clean link", () => {
  const routes = createOperation("race").routes;
  const burst = transferPackets({ route: routes[0], count: 6, strategy: "burst" });
  const pace = transferPackets({ route: routes[0], count: 6, strategy: "pace" });
  assert.equal(burst.packets.filter((p) => p.status === "lost").length, 2);
  assert.equal(pace.failed, false);
  assert.ok(pace.total < burst.total);
  const cleanBurst = transferPackets({ route: routes[1], count: 6, strategy: "burst" });
  const cleanPace = transferPackets({ route: routes[1], count: 6, strategy: "pace" });
  assert.ok(cleanBurst.total < cleanPace.total);
});

test("loss requires repair, selective retransmission sends only missing IDs", () => {
  const run = decide(connect("rescue", 0, false, "direct"), "burst");
  assert.equal(run.phase, "recovery");
  assert.equal(run.packets.filter((p) => p.status === "lost").length, 2);
  const ignored = decide(run, "ignore");
  assert.equal(ignored.phase, "recovery");
  assert.deepEqual(ignored.packets, run.packets);
  const recovered = decide(run, "retry-missing");
  assert.equal(recovered.phase, "complete");
  assert.deepEqual(recovered.packets.filter((p) => p.retry).map((p) => p.id), [2, 5]);
  const full = decide(run, "retry-all");
  assert.equal(full.phase, "complete");
  assert.equal(full.packets.filter((p) => p.retry).length, 6);
  assert.ok(full.elapsed > recovered.elapsed);
});

test("rerouting resets connection authentication and earlier response pieces", () => {
  const run = decide(connect("rescue", 0, false, "direct"), "burst", "reroute");
  assert.equal(run.phase, "route");
  assert.equal(run.authenticated, false);
  assert.deepEqual(run.packets, []);
  assert.equal(decide(run, "relay", "verify", "burst").phase, "complete");
});

test("hard mode has fewer attempts, less time and no hints; budgets are enforced", () => {
  const normal = createOperation(), hard = createOperation("rescue", 0, true);
  assert.ok(hard.budget < normal.budget);
  assert.equal(hard.maxAttempts, 7);
  assert.equal(useOperationHint(hard), hard);
  assert.equal(useOperationHint(normal).hinted, true);
  const hint = useOperationHint(normal);
  assert.equal(useOperationHint(hint), hint);
  const hintedSuccess = decide(hint, "fresh", "backup", "relay", "renew", "burst");
  assert.equal(operationView(hintedSuccess).score, 80);
  const attemptFailure = decide(hard, ...Array(7).fill("use-cache"));
  assert.equal(attemptFailure.phase, "failed");
  assert.equal(operationView(attemptFailure).choices.length, 0);
  assert.throws(() => takeDecision(attemptFailure, "fresh"), TypeError);
  const deadlineFailure = decide(connect("race", 2, true, "scenic"), "burst");
  assert.equal(deadlineFailure.phase, "failed");
  assert.ok(deadlineFailure.elapsed > deadlineFailure.budget);
  assert.equal(operationView(deadlineFailure).score, 0);
});

test("variant conditions are distinct and reproducible", () => {
  for (const definition of operations) {
    const states = [0, 1, 2].map((variant) => createOperation(definition.id, variant));
    assert.equal(new Set(states.map((s) => s.routes[0].rtt)).size, 3);
    assert.equal(new Set(states.map((s) => s.count)).size, 3);
    assert.deepEqual(states[1], createOperation(definition.id, 1));
  }
});

test("invalid configurations, decisions, routes, packets and trace times are rejected", () => {
  const run = createOperation(), route = run.routes[1], snapshot = JSON.stringify(run);
  for (const args of [["bad"], ["rescue", -1], ["rescue", 3], ["rescue", 0, "hard"]])
    assert.throws(() => createOperation(...args), TypeError);
  assert.throws(() => takeDecision(run, "renew"), TypeError);
  assert.equal(JSON.stringify(run), snapshot);
  for (const input of [{ route, count: 3, strategy: "burst" }, { route, count: 6, strategy: "bad" },
    { route, count: 6, strategy: "retry-missing", missing: [] },
    { route, count: 6, strategy: "retry-missing", missing: [9] },
    { route, count: 6, strategy: "retry-missing", missing: [2, 2] },
    { route: { ...route, down: true }, count: 6, strategy: "burst" }])
    assert.throws(() => transferPackets(input), TypeError);
  assert.throws(() => createRouteTrace({ ...route, rtt: NaN }), TypeError);
  assert.throws(() => createTrace([{ duration: -1 }]), TypeError);
  assert.throws(() => createTrace([]), TypeError);
});
