import test from "node:test";
import assert from "node:assert/strict";
import { cacheFreshness, simulateRetries, diagnostics, createDiagnostic, takeDiagnosticDecision, diagnosticView } from "../dist/src/diagnostics.js";
import { createOperation, operationView, takeDecision, useOperationHint } from "../dist/src/missions.js";
const decide = (state, ...actions) => actions.reduce(takeDecision, state);

test("all 12 diagnostic configurations complete through executable visible choices", () => {
  for (const definition of diagnostics) for (const variant of [0, 1, 2]) for (const hard of [false, true]) {
    let state = createOperation(definition.id, variant, hard);
    for (const action of definition.id === "cache-expiry" ? ["use-cache", "wait", "revalidate", "cause"] : ["inspect", "single", "cause"]) {
      assert.ok(operationView(state).choices.some((choice) => choice.id === action));
      state = takeDecision(state, action);
    }
    assert.equal(state.phase, "complete");
    assert.equal(operationView(state).score, 100);
    assert.ok(state.elapsed <= state.budget);
    assert.ok(state.attempts <= state.maxAttempts);
    assert.equal(state.elapsed, state.history.reduce((sum, item) => sum + item.trace.total, 0));
  }
});

test("cache expires exactly at max-age, retaining the body until validation", () => {
  assert.deepEqual(cacheFreshness({ age: 999, lifetime: 1000 }), { fresh: true, remaining: 1 });
  assert.deepEqual(cacheFreshness({ age: 1000, lifetime: 1000 }), { fresh: false, remaining: 0 });
  let state = decide(createOperation("cache-expiry"), "use-cache");
  assert.ok(state.history[0].trace.stages.every((s) => s.node === "browser"));
  state = decide(state, "wait");
  assert.equal(state.age, state.lifetime);
  assert.equal(state.body, "v1");
  assert.equal(state.status, null);
  assert.equal(state.phase, "repair");
});

test("ETag equality yields 304 without body download; change yields 200 replacement", () => {
  for (const variant of [0, 1, 2]) {
    const state = decide(createOperation("cache-expiry", variant), "use-cache", "wait", "revalidate");
    assert.equal(state.status, variant === 1 ? 200 : 304);
    assert.equal(state.body, variant === 1 ? "v2" : "v1");
    assert.equal(state.age, 25, "freshness restarts on response receipt, then rendering takes 25 ms");
    const trace = state.history.at(-1).trace;
    assert.ok(trace.stages.some((stage) => stage.code === 'GET · If-None-Match "v1"'));
    assert.ok(trace.stages.some((stage) => stage.code === `HTTP · ${state.status}`));
    assert.equal(state.phase, "cause", "a successful HTTP response alone is not diagnostic completion");
  }
});

test("stale reuse and DNS clearing cannot replace HTTP cache validation", () => {
  const before = decide(createOperation("cache-expiry"), "use-cache", "wait"), snapshot = JSON.stringify(before);
  const after = decide(before, "reuse", "dns");
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(after.phase, "repair");
  assert.equal(after.status, null);
  assert.equal(after.body, "v1");
  assert.equal(after.age, 1010);
  assert.equal(after.faults, 2);
});

test("retry cascade produces 27 real FIFO jobs from three logical GETs", () => {
  const run = simulateRetries();
  assert.equal(run.submitted, 27);
  assert.equal(run.completed, 0);
  assert.equal(run.maxQueued, 24);
  assert.equal(run.drainTime, 3240);
  assert.equal(run.trace.total, run.drainTime);
  assert.equal(run.jobs.filter((job) => job.accepted).length, 0);
  for (const [index, job] of run.jobs.entries()) {
    assert.equal(job.finish - job.start, 120);
    assert.ok(job.start >= job.arrived);
    if (index) assert.equal(job.start, run.jobs[index - 1].finish);
    assert.ok(job.outer <= 3 && job.inner <= 3);
  }
  for (let clientId = 0; clientId < 3; clientId++)
    assert.equal(run.jobs.filter((job) => job.clientId === clientId).length, 9);
  assert.ok(run.jobs.some((job) => job.finish > 3 * 80), "server work outlives caller exhaustion");
});

test("one retry owner with adequate timeout completes only the three original jobs", () => {
  const fixed = simulateRetries({ service: 120, timeout: 361, gatewayRetries: false });
  assert.equal(fixed.submitted, 3);
  assert.equal(fixed.completed, 3);
  assert.equal(fixed.maxQueued, 2);
  assert.equal(fixed.drainTime, 360);
  assert.deepEqual(fixed.jobs.map((job) => job.finish), [120, 240, 360]);
  assert.ok(fixed.jobs.every((job) => job.accepted));
});

test("partial responses cancel future retries only for their active caller", () => {
  const run = simulateRetries({ service: 120, timeout: 160 });
  assert.ok(run.submitted > 3 && run.submitted < 27);
  assert.equal(run.jobs.filter((j) => j.clientId === 0).length, 1);
  assert.ok(run.jobs.some((job) => !job.accepted));
  assert.ok(run.completed < 3);
});

test("repeating or doubling the timeout is evaluated and leaves duplicate work", () => {
  for (const action of ["repeat", "longer"]) {
    const before = decide(createOperation("retry-cascade"), "inspect"), after = decide(before, action);
    assert.equal(after.phase, "repair");
    assert.equal(after.faults, 1);
    assert.ok(after.repaired.submitted > 3);
    assert.ok(after.repaired.completed < 3);
    assert.ok(after.elapsed > before.elapsed);
    assert.equal(before.repaired, null);
    assert.equal(decide(after, "single", "cause").phase, "complete");
  }
});

test("wrong causes never award completion and consume attempts", () => {
  for (const id of ["cache-expiry", "retry-cascade"]) {
    let state = decide(createOperation(id), ...(id === "cache-expiry" ? ["use-cache", "wait", "revalidate"] : ["inspect", "single"]));
    state = decide(state, "dns", "http500");
    assert.equal(state.phase, "cause");
    assert.equal(operationView(state).score, 0);
    assert.equal(state.faults, 2);
    assert.equal(decide(state, "cause").phase, "complete");
  }
});

test("diagnostic budgets and hint penalty preserve established boundaries", () => {
  const hard = decide(createOperation("retry-cascade", 2, true), "inspect", "repeat", "repeat", "repeat");
  assert.equal(hard.phase, "failed");
  assert.ok(hard.elapsed > hard.budget);
  assert.throws(() => takeDecision(hard, "single"));
  const normal = useOperationHint(createOperation("cache-expiry"));
  assert.equal(operationView(decide(normal, "use-cache", "wait", "revalidate", "cause")).score, 80);
  const noHints = createOperation("cache-expiry", 0, true);
  assert.equal(useOperationHint(noHints), noHints);
});

test("diagnostic configuration, choices and timing inputs reject invalid values", () => {
  for (const args of [["bad"], ["cache-expiry", 3], ["cache-expiry", 0, 1]])
    assert.throws(() => createDiagnostic(...args), TypeError);
  assert.throws(() => takeDiagnosticDecision(createDiagnostic("cache-expiry"), "cause"), TypeError);
  assert.throws(() => diagnosticView({ id: "cache-expiry", phase: "other" }), TypeError);
  for (const input of [{ service: 0 }, { timeout: NaN }, { timeout: 10001 }, { gatewayRetries: "yes" }])
    assert.throws(() => simulateRetries(input), TypeError);
  for (const input of [{ age: -1, lifetime: 1000 }, { age: 0, lifetime: 0 }, { age: NaN, lifetime: 1 }])
    assert.throws(() => cacheFreshness(input), TypeError);
});
