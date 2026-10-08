import test from "node:test";
import assert from "node:assert/strict";
import { missions, assessAction } from "../dist/src/missions.js";
import { createJourney } from "../dist/src/model.js";
test("six missions each have one valid action and reproducible before/after", () => {
  assert.equal(missions.length, 6);
  assert.equal(new Set(missions.map((m) => m.id)).size, 6);
  for (const mission of missions) {
    assert.equal(mission.actions.filter((a) => a.correct).length, 1);
    assert.ok(createJourney(mission.config).stages.length > 0);
    const answer = mission.actions.find((a) => a.correct);
    const result = assessAction(mission.id, answer.id);
    assert.equal(result.correct, true);
    assert.equal(result.score, 100);
    assert.deepEqual(result.config, mission.after);
    assert.ok(createJourney(result.config).stages.length > 0);
    for (const action of mission.actions.filter((a) => !a.correct)) {
      const failed = assessAction(mission.id, action.id);
      assert.equal(failed.correct, false);
      assert.ok(failed.feedback.length > 20);
      assert.equal(failed.config, undefined);
    }
  }
});
test("hints and wrong actions reduce points but cannot create negative score", () => {
  assert.equal(
    assessAction("dns", "dns", { wrong: 1, hinted: true }).score,
    65,
  );
  assert.equal(assessAction("dns", "dns", { wrong: 20 }).score, 10);
});
test("cache-removal cases intentionally reveal a failure, not a restored page", () => {
  for (const id of ["cache", "dns-cache"]) {
    const mission = missions.find((m) => m.id === id);
    assert.equal(createJourney(mission.config).failed, false);
    assert.equal(createJourney(mission.after).failed, true);
  }
});
test("fresh-page cache is faster than DNS cache or halved model latency", () => {
  const mission = missions.find((m) => m.id === "fast");
  assert.equal(createJourney(mission.after).total, 33);
  assert.ok(createJourney({ cache: "dns" }).total > 33);
  assert.ok(createJourney({ latency: 40 }).total > 33);
});
test("invalid mission input is rejected without mutating mission data", () => {
  const snapshot = JSON.stringify(missions);
  for (const args of [
    ["bad", "dns"],
    ["dns", "bad"],
    ["dns", "dns", { wrong: -1 }],
    ["dns", "dns", { wrong: 1.2 }],
    ["dns", "dns", { hinted: "yes" }],
  ])
    assert.throws(() => assessAction(...args), TypeError);
  assert.equal(JSON.stringify(missions), snapshot);
});
