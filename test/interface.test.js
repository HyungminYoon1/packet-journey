// Node DOM/timer test double: checks orchestration, not layout or browser APIs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createJourney, concepts } from "../dist/src/model.js";
import { missions, assessAction, operations, createOperation, operationView, takeDecision, useOperationHint } from "../dist/src/missions.js";
import { diagnostics } from "../dist/src/diagnostics.js";
import { createProgressStore, SUMMARY_KEY, RECORD_KEY } from "../dist/src/progress.js";

function mount(storage = (() => {
  const data = new Map();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
})()) {
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  class Element {
    constructor(tag = "div") { this.tag = tag; this.children = []; this.className = ""; this.dataset = {}; this.listeners = new Map(); this.value = ""; }
    get classList() {
      const element = this;
      return {
        contains: (name) => element.className.split(" ").includes(name),
        add: (...names) => { element.className = [...new Set([...element.className.split(" ").filter(Boolean), ...names])].join(" "); },
        remove: (...names) => { element.className = element.className.split(" ").filter((name) => !names.includes(name)).join(" "); },
        toggle(name, force) { const on = force ?? !this.contains(name); on ? this.add(name) : this.remove(name); return on; },
      };
    }
    style = {};
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) {
      this.children = children;
      if (this.tag === "select" && !children.some((child) => child.value === this.value)) this.value = children[0]?.value || "";
    }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    click() { if (!this.disabled) this.listeners.get("click")?.(); }
    querySelector(selector) { return all(this.children).find((element) => matches(element, selector)); }
    scrollIntoView() {}
  }
  const all = (roots) => [...new Set(roots.flatMap((root) => [root, ...all(root.children)]))];
  const matches = (element, selector) => selector === "[data-node]" ? !!element.dataset.node
    : selector === "[data-concept]" ? !!element.dataset.concept
    : selector.startsWith(".") ? element.classList.contains(selector.slice(1)) : element.tag === selector;
  const ids = new Map([...html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)].map(([, tag, id]) => [id, new Element(tag)]));
  // Read form defaults from the actual HTML rather than relying on UI defaults.
  for (const [, tag, id, rest] of html.matchAll(/<(select|input)\b[^>]*\bid="([^"]+)"([^>]*)>([\s\S]*?)/g)) {
    if (tag === "input") ids.get(id).value = rest.match(/value="([^"]+)"/)?.[1] || "";
  }
  for (const [, id, body] of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g))
    ids.get(id).value = body.match(/<option\b[^>]*value="([^"]+)"/)?.[1] || "";
  const map = new Element(), journey = new Element(), mobile = new Element();
  map.className = "network-map"; journey.className = "journey"; mobile.className = "mobile-case-picker";
  const roots = () => [...ids.values(), map, journey, mobile];
  const callbacks = new Map(), tools = new Map(); let timerId = 0;
  const document = {
    hidden: false, getElementById: (id) => ids.get(id), createElement: (tag) => new Element(tag),
    querySelector: (selector) => all(roots()).find((element) => matches(element, selector)),
    querySelectorAll(selector) {
      const scoped = selector.match(/^#([\w-]+) (.+)$/);
      return all(scoped ? ids.get(scoped[1]).children : roots()).filter((element) => matches(element, scoped ? scoped[2] : selector));
    },
    addEventListener() {}, modelContext: { registerTool: (tool) => tools.set(tool.name, tool) },
  };
  const source = readFileSync(new URL("../dist/src/app.js", import.meta.url), "utf8").replace(/^import[\s\S]*?;/gm, "");
  vm.runInNewContext(source, {
    createJourney, concepts, missions, assessAction, operations, createOperation, operationView, takeDecision, useOperationHint,
    diagnostics, createProgressStore: (ids) => createProgressStore(ids, storage),
    document, window: { addEventListener() {} }, matchMedia: () => ({ matches: false }), AbortController,
    setTimeout(callback) { callbacks.set(++timerId, callback); return timerId; }, clearTimeout(id) { callbacks.delete(id); },
  });
  const drain = () => {
    let limit = 300;
    while (callbacks.size && limit--) {
      const [id, callback] = callbacks.entries().next().value; callbacks.delete(id); callback();
    }
    assert.ok(limit > 0, "timer playback should terminate");
  };
  return { ids, tools, drain, storage, select(id, value) {
    ids.get(id).value = value; ids.get(id).listeners.get("change")?.();
  }, choose(label) {
    const button = ids.get("operation-choices").children.find((child) => child.children[0].textContent === label);
    assert.ok(button, `visible choice: ${label}`); button.click();
  } };
}

test("UI decision gates, replay, packet repair and mode changes (Node test double)", () => {
  const ui = mount(), get = (id) => ui.ids.get(id);
  ui.choose("서버에서 새 응답 받기");
  ui.drain();
  assert.match(get("operation-title").textContent, /02/);
  ui.choose("대체 리졸버에 조회"); ui.drain();
  ui.choose("A · 직행");
  assert.ok(get("operation-choices").children.every((button) => button.disabled));
  ui.drain();
  ui.choose("인증서 갱신 후 검증"); ui.drain();
  ui.choose("한 번에 전송"); ui.drain();
  assert.match(get("operation-evidence").textContent, /#2, #5/);
  ui.choose("누락 조각만 재전송"); ui.drain();
  assert.equal(get("operation-result").hidden, false);
  assert.match(get("operation-result-title").textContent, /작전 완료 · 100 PT/);
  assert.ok(get("packet-ledger").children.every((chip) => chip.textContent.includes("ACK")));
  const budget = get("operation-budget").textContent;
  get("play").click(); ui.drain();
  assert.equal(get("operation-budget").textContent, budget, "replaying must not charge another decision");
  get("free-mode").click(); assert.equal(get("operation-actions").hidden, true);
  get("mission-mode").click(); assert.equal(get("mission-actions").hidden, false);
  assert.equal(get("case-list").children.length, 6);
  get("operation-mode").click();
  assert.match(get("operation-title").textContent, /01/);
  assert.match(get("operation-budget").textContent, /조치 0/);
  assert.match(get("operation-budget").textContent, /최고 100 PT/);
});

test("WebMCP rejects missing/invalid inputs before changing visible state (Node test double)", () => {
  const ui = mount(), tool = ui.tools.get("configure_journey");
  const before = ui.ids.get("case-title").textContent;
  for (const input of [{ latency: 80 }, { cache: "none", latency: 80 },
    { cache: "none", scenario: "normal", latency: 25 },
    { cache: "bad", scenario: "normal", latency: 80 }])
    assert.throws(() => tool.execute(input));
  assert.equal(ui.ids.get("case-title").textContent, before);
  const result = tool.execute({ cache: "http", scenario: "offline", latency: 80 });
  assert.equal(result.modelTimeMs, 33);
  const advance = ui.tools.get("advance_journey");
  assert.throws(() => advance.execute({ count: 8 }));
  assert.equal(advance.execute({ count: 3 }).done, true);
});

test("diagnostic walkthroughs persist only independent final completion (Node test double)", () => {
  const ui = mount(), get = (id) => ui.ids.get(id);
  assert.equal(ui.storage.data.size, 0, "initial view writes no achievements or summary");
  ui.select("operation-picker", "cache-expiry");
  assert.equal(ui.storage.data.size, 0);
  ui.choose("만료 전 응답 사용"); ui.drain();
  ui.choose("만료 시점까지 시간 진행"); ui.drain();
  assert.match(get("diagnostic-summary").textContent, /1000 \/ 1000 ms \(가정\)/);
  ui.choose("ETag로 조건부 재검증"); ui.drain();
  assert.match(get("diagnostic-summary").textContent, /HTTP 304/);
  assert.equal(ui.storage.data.size, 0, "repair alone is not diagnosis completion");
  ui.choose("유효 시간이 지나 재검증함"); ui.drain();
  assert.match(get("operation-result-title").textContent, /진단 완료 · 100 PT/);
  for (const id of ["operation-evidence", "stage-description", "operation-feedback"])
    assert.equal(get(id).hidden, true, "completed explanation belongs only in the result");
  assert.equal(JSON.parse(ui.storage.getItem(SUMMARY_KEY)).apps["packet-journey"].completed, 1);
  assert.match(get("saved-progress").textContent, /1 \/ 42/);
  const raw = ui.storage.getItem(SUMMARY_KEY);
  get("play").click(); ui.drain();
  assert.equal(ui.storage.getItem(SUMMARY_KEY), raw, "replay cannot update the completion timestamp");
  const reload = mount(ui.storage);
  assert.match(reload.ids.get("saved-progress").textContent, /1 \/ 42/);
  get("free-mode").click();assert.equal(get("stage-description").hidden, false);
  ui.select("operation-picker", "cache-expiry");
  assert.equal(ui.storage.getItem(SUMMARY_KEY), raw, "reload is read-only");
  get("clear-progress").click();
  assert.equal(ui.storage.getItem(RECORD_KEY), null);
  assert.equal(JSON.parse(ui.storage.getItem(SUMMARY_KEY)).apps["packet-journey"], undefined);
  get("play").click(); ui.drain();
  assert.equal(ui.storage.getItem(RECORD_KEY), null, "replay after clear cannot recreate completion");
  ui.select("operation-picker", "retry-cascade");
  ui.choose("현재 재시도 기록 확인"); ui.drain();
  assert.match(get("operation-evidence").textContent, /접수 27개/);
  ui.choose("재시도는 클라이언트 한 곳에서"); ui.drain();
  assert.match(get("operation-evidence").textContent, /27 → 3개/);
  ui.choose("겹친 재시도가 대기열을 늘림"); ui.drain();
  assert.match(get("operation-result-title").textContent, /진단 완료 · 100 PT/);
  assert.equal(JSON.parse(ui.storage.getItem(SUMMARY_KEY)).apps["packet-journey"].completed, 1);
});

test("hinted and mistaken solutions display results without independent badges (Node test double)", () => {
  for (const assisted of ["hint", "wrong"]) {
    const ui = mount(); ui.select("operation-picker", "cache-expiry");
    ui.choose("만료 전 응답 사용"); ui.drain();
    ui.choose("만료 시점까지 시간 진행"); ui.drain();
    if (assisted === "hint") ui.ids.get("operation-hint").click();
    else { ui.choose("재검증 없이 저장본 사용"); ui.drain(); }
    ui.choose("ETag로 조건부 재검증"); ui.drain();
    ui.choose("유효 시간이 지나 재검증함"); ui.drain();
    assert.equal(ui.ids.get("operation-result").hidden, false);
    assert.equal(ui.storage.getItem(RECORD_KEY), null);
    assert.equal(ui.storage.getItem(SUMMARY_KEY), null);
  }
});

test("base cases retain scoring while successful unaided resolution saves an achievement (Node test double)", () => {
  for (const assisted of [false, true]) {
    const ui = mount(); ui.ids.get("mission-mode").click();
    ui.ids.get("play").click(); ui.drain();
    if (assisted) ui.ids.get("hint").click();
    const button = ui.ids.get("action-options").children.find((b) => b.children[1].textContent === "DNS 조회 문제 해결 후 재시도");
    assert.ok(button); button.click(); ui.drain();
    assert.equal(ui.ids.get("resolution").hidden, false);
    assert.equal(ui.storage.getItem(RECORD_KEY) === null, assisted);
    if (!assisted) assert.deepEqual(JSON.parse(ui.storage.getItem(RECORD_KEY)).achievements, ["case:dns"]);
  }
});
