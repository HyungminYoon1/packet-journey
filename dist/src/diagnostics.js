import { createTrace } from "./model.js";

export const diagnostics = Object.freeze([
  { id: "cache-expiry", short: "캐시 만료 진단", title: "저장본이 있는데 서버에 다시 묻는 이유",
    brief: "같은 GET 응답을 만료 전후로 비교합니다. 서버 내용은 조건 02에서만 바뀝니다.",
    goal: "만료 전 캐시 사용, 만료 후 재검증을 관찰하고 원인을 고르세요.", budget: 5000 },
  { id: "retry-cascade", short: "재시도 연쇄 진단", title: "시간 초과 뒤에 쌓이는 요청",
    brief: "클라이언트 3개와 게이트웨이가 각각 최대 3회 시도합니다. 시간 초과는 서버 작업을 취소하지 않습니다.",
    goal: "중복 요청을 줄여 3개 GET을 완료하고 대기열 증가 원인을 고르세요.", budget: 25000 },
]);

const event = (node, title, description, duration, error = false, code = title) =>
  ({ id: "diagnostic", node, title, description, duration, error, code });

export function cacheFreshness({ age, lifetime }) {
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(lifetime) || lifetime <= 0)
    throw new TypeError("Invalid cache age");
  return { fresh: age < lifetime, remaining: Math.max(0, lifetime - age) };
}

// One FIFO worker; timeouts abandon attempts but never cancel queued server work.
// Completion at a deadline is late. Both retry layers stop after three attempts.
export function simulateRetries({ service = 120, timeout = 80, gatewayRetries = true } = {}) {
  if (!Number.isInteger(service) || service < 1 || service > 1000 ||
    !Number.isInteger(timeout) || timeout < 1 || timeout > 10000 ||
    typeof gatewayRetries !== "boolean") throw new TypeError("Invalid retry configuration");
  const pending = [], jobs = [], events = [], clients = Array.from({ length: 3 }, () =>
    ({ attempt: 0, done: false, failed: false }));
  let tail = 0, maxQueued = 0, sequence = 0;
  const schedule = (at, kind, fn) => pending.push({ at, kind, fn, sequence: sequence++ });
  const submit = (clientId, outer, group, inner, at) => {
    const start = Math.max(at, tail), finish = start + service;
    tail = finish;
    const job = { id: jobs.length + 1, clientId, outer, inner, arrived: at, start, finish };
    jobs.push(job);
    const queued = jobs.filter((j) => j.start > at).length;
    maxQueued = Math.max(maxQueued, queued);
    events.push({ at, node: "server", title: `GET #${job.id} 접수`,
      description: `클라이언트 ${clientId + 1} · 시도 ${outer}/${inner} · 대기 ${queued}개 · 이번 요청군 처리 +${start}–${finish} ms`,
      code: `GET #${job.id} · QUEUED ${queued}` });
    schedule(finish, 1, () => {
      const client = clients[clientId], valid = !group.done && group.attempt === inner && finish < at + timeout;
      if (valid) group.done = true;
      const accepted = valid && !client.done && !client.failed && client.attempt === outer && finish < group.started + timeout;
      if (accepted) client.done = true;
      job.accepted = accepted;
      events.push({ at: finish, node: "browser", title: `GET #${job.id} ${accepted ? "응답 수신" : "늦은 응답"}`,
        description: accepted ? `클라이언트 ${clientId + 1} 요청 완료.` : "대기 한도가 지난 시도의 응답입니다. 서버 작업은 끝까지 실행됐습니다.",
        error: !accepted, code: `GET #${job.id} · ${accepted ? "200 ACCEPTED" : "200 LATE"}` });
    });
    schedule(at + timeout, 0, () => {
      if (group.done || group.attempt !== inner) return;
      events.push({ at: at + timeout, node: "connection", title: "게이트웨이 대기 한도 도달",
        description: "이 시도의 서버 작업은 취소되지 않습니다.", error: true,
        code: `GATEWAY ${clientId + 1}:${outer}:${inner} · TIMEOUT` });
      if (gatewayRetries && inner < 3) {
        group.attempt++;
        submit(clientId, outer, group, inner + 1, at + timeout);
      }
    });
  };
  const startOuter = (clientId, at) => {
    const client = clients[clientId], outer = ++client.attempt;
    const group = { attempt: 1, done: false, started: at };
    submit(clientId, outer, group, 1, at);
    schedule(at + timeout, 0, () => {
      if (client.done || client.attempt !== outer) return;
      events.push({ at: at + timeout, node: "browser", title: "클라이언트 대기 한도 도달",
        description: outer < 3 ? "클라이언트가 새 시도를 시작합니다. 이전 게이트웨이 시도도 남아 있습니다." : "3회 시도를 소진했습니다.",
        error: true, code: `CLIENT ${clientId + 1}:${outer} · TIMEOUT` });
      if (outer < 3) startOuter(clientId, at + timeout);
      else client.failed = true;
    });
  };
  for (let id = 0; id < 3; id++) startOuter(id, 0);
  while (pending.length) {
    pending.sort((a, b) => a.at - b.at || a.kind - b.kind || a.sequence - b.sequence);
    const next = pending.shift(); next.fn();
  }
  events.sort((a, b) => a.at - b.at);
  let previous = 0;
  const trace = createTrace(events.map((entry) => {
    const stage = { ...entry, id: "retry", duration: entry.at - previous };
    previous = entry.at; return stage;
  }));
  return { jobs, events, trace, submitted: jobs.length, maxQueued,
    completed: clients.filter((client) => client.done).length, drainTime: tail };
}

export function createDiagnostic(id, variant = 0, hard = false) {
  const definition = diagnostics.find((d) => d.id === id);
  if (!definition || !Number.isInteger(variant) || variant < 0 || variant > 2 || typeof hard !== "boolean")
    throw new TypeError("Invalid diagnostic configuration");
  return { id, variant, hard, diagnostic: true, phase: "observe", elapsed: 0,
    attempts: 0, faults: 0, hinted: false, history: [], packets: [], routes: [], count: 0,
    routeId: null, authenticated: false, budget: Math.round(definition.budget * (hard ? 0.7 : 1)),
    maxAttempts: hard ? 7 : 12, feedback: "", age: 200, lifetime: 1000 + variant * 1000,
    body: "v1", serverBody: variant === 1 ? "v2" : "v1", status: null,
    service: 120 + variant * 40, timeout: 80 + variant * 20, baseline: null, repaired: null };
}

export function diagnosticView(state) {
  const definition = diagnostics.find((d) => d.id === state.id);
  if (!definition || !["observe", "expire", "repair", "cause", "complete", "failed"].includes(state.phase))
    throw new TypeError("Invalid diagnostic state");
  const cache = state.id === "cache-expiry", fresh = cacheFreshness({ age: state.age, lifetime: state.lifetime });
  let choices = [], evidence = "", title = "", hint = "";
  if (state.phase === "observe") {
    title = "01 · 첫 요청 확인";
    evidence = cache ? `Cache-Control: max-age=${state.lifetime / 1000}, must-revalidate · 나이 ${state.age} ms · ETag: "${state.body}"`
      : `서버 1개 처리 슬롯 · GET당 ${state.service} ms · 각 계층 대기 한도 ${state.timeout} ms · 클라이언트 3개`;
    choices = cache ? [["use-cache", "만료 전 응답 사용", "저장된 본문으로 표시"]]
      : [["inspect", "현재 재시도 기록 확인", "클라이언트와 게이트웨이 모두 최대 3회"]];
  } else if (state.phase === "expire") {
    title = "02 · 시간 경과";
    evidence = `캐시 나이 ${state.age} ms · 남은 유효 시간 ${fresh.remaining} ms`;
    choices = [["wait", "만료 시점까지 시간 진행", "캐시를 지우지 않고 다음 요청 비교"]];
  } else if (state.phase === "repair") {
    title = "03 · 다음 요청 선택";
    evidence = cache ? `캐시 나이 ${state.age} ms / 유효 시간 ${state.lifetime} ms · ${fresh.fresh ? "유효" : "만료"} · DNS/TCP/TLS 정상`
      : `접수 ${state.baseline.submitted}개 / 원래 GET 3개 · 최대 대기 ${state.baseline.maxQueued}개 · 제때 수신 ${state.baseline.completed}/3`;
    choices = cache ? [["revalidate", "ETag로 조건부 재검증", "If-None-Match · 304 또는 새 본문 200"],
      ["reuse", "재검증 없이 저장본 사용", "must-revalidate 조건 확인"],
      ["dns", "DNS 캐시만 비우기", "응답 캐시의 나이는 바뀌지 않음"]]
      : [["single", "재시도는 클라이언트 한 곳에서", `게이트웨이 재시도 끄기 · 대기 한도 ${3 * state.service + 1} ms`],
        ["repeat", "같은 재시도 정책으로 다시 요청", "짧은 대기 한도와 두 계층 유지"],
        ["longer", "대기 한도만 두 배로", "두 계층의 재시도 유지"]];
    hint = cache ? "유효 시간이 지난 본문은 서버에 변경 여부를 확인해야 합니다." : "시간 초과는 서버 작업 취소가 아닙니다. 전체 대기열 처리 시간을 고려하세요.";
  } else if (state.phase === "cause") {
    title = "04 · 관찰한 원인 선택";
    evidence = cache ? `만료 전 네트워크 생략 → 만료 후 HTTP ${state.status} · 현재 본문 ${state.body}`
      : `접수 ${state.baseline.submitted} → ${state.repaired.submitted}개 · 최대 대기 ${state.baseline.maxQueued} → ${state.repaired.maxQueued}개 · 제때 수신 ${state.repaired.completed}/3`;
    choices = [["cause", cache ? "유효 시간이 지나 재검증함" : "겹친 재시도가 대기열을 늘림", cache ? "응답 나이와 max-age 비교" : "원래 GET 수와 서버 접수 수 비교"],
      ["dns", "DNS 조회 실패", "주소 조회 기록 비교"], ["http500", "서버가 HTTP 500을 반환함", "응답 상태 비교"]];
    hint = "실패한 시도와 실제 서버 응답 상태를 구분하세요.";
  } else { title = state.phase === "complete" ? "진단 완료" : "예산 소진"; evidence = state.feedback; }
  return { definition, title, evidence, hint, choices: choices.map(([id, label, detail]) => ({ id, label, detail })),
    score: state.phase === "complete" ? Math.max(10, 100 - state.faults * 15 - (state.hinted ? 20 : 0)) : 0 };
}

export function takeDiagnosticDecision(previous, actionId) {
  const view = diagnosticView(previous), choice = view.choices.find((c) => c.id === actionId);
  if (!choice) throw new TypeError("Invalid diagnostic decision");
  const state = structuredClone(previous), cache = state.id === "cache-expiry", phase = state.phase;
  let trace, fault = false, feedback = "";
  if (phase === "observe") {
    if (cache) {
      trace = createTrace([event("browser", "유효한 응답 캐시 사용", "DNS/TCP/TLS/HTTP 생략 · 본문 v1", 28, false, "CACHE · FRESH / v1")]);
      state.phase = "expire"; feedback = "유효 시간이 남아 서버 요청 없이 표시했습니다.";
    } else {
      state.baseline = simulateRetries({ service: state.service, timeout: state.timeout });
      trace = state.baseline.trace; state.phase = "repair";
      feedback = `3개의 GET이 ${state.baseline.submitted}개 서버 작업으로 늘었습니다. 늦은 응답은 버려져도 서버 작업은 남습니다.`;
    }
  } else if (phase === "expire") {
    trace = createTrace([event("browser", "응답 캐시 만료", "현재 나이가 max-age에 도달했습니다. 본문은 그대로 남아 있습니다.",
      Math.max(0, state.lifetime - state.age), false, "CACHE · STALE / BODY RETAINED")]);
    state.phase = "repair"; feedback = "만료는 본문 삭제가 아닙니다. 다음 사용 전에 재검증합니다.";
  } else if (phase === "repair" && cache && actionId === "revalidate") {
    const changed = state.body !== state.serverBody;
    state.status = changed ? 200 : 304;
    trace = createTrace([
      event("dns", "주소 조회", "DNS 정상", 40), event("connection", "TCP/TLS 연결", "인증서 유효", 80),
      event("server", "조건부 GET", `If-None-Match: "${state.body}"`, 20, false, `GET · If-None-Match "${state.body}"`),
      event("server", `HTTP ${state.status}`, changed ? "ETag 불일치 · 새 본문 v2 전송" : "ETag 일치 · 본문 전송 없음", changed ? 100 : 20, false, `HTTP · ${state.status}`),
      event("browser", "본문 표시", changed ? "새 본문 v2로 교체" : "저장된 본문 v1 재사용", 25),
    ]);
    state.body = state.serverBody; state.phase = "cause";
    feedback = changed ? "200 응답의 새 본문으로 교체했습니다." : "304 응답으로 최신성을 확인하고 저장된 본문을 재사용했습니다.";
  } else if (phase === "repair" && !cache) {
    const fixed = actionId === "single";
    const run = simulateRetries({ service: state.service, timeout: fixed ? 3 * state.service + 1 : state.timeout * (actionId === "longer" ? 2 : 1), gatewayRetries: !fixed });
    trace = run.trace; state.repaired = run;
    if (run.completed === 3 && run.submitted === 3) {
      state.phase = "cause"; feedback = "3개의 GET만 접수했고 모두 대기 한도 안에 응답했습니다.";
    } else {
      fault = true; feedback = `접수 ${run.submitted}개 · 제때 수신 ${run.completed}/3. 중복 작업이 남습니다.`;
    }
  } else if (phase === "cause" && actionId === "cause") {
    state.phase = "complete";
    feedback = cache ? `유효 시간 경과 → 재검증 → ${state.status === 304 ? "304로 저장 본문 재사용" : "200으로 새 본문 교체"}. DNS 장애는 없었습니다.`
      : "짧은 대기 한도와 두 계층의 재시도가 중복 작업을 만들었습니다. 한 계층만 재시도하고 대기 한도를 늘리자 대기열이 줄었습니다.";
    trace = createTrace([event("browser", "진단 완료", feedback, 0)]);
  } else {
    fault = true;
    feedback = phase === "cause" ? "기록에 DNS 실패나 HTTP 500은 없습니다. 관찰한 변화의 원인을 다시 고르세요."
      : actionId === "reuse" ? "must-revalidate: 만료된 응답은 확인 없이 사용할 수 없습니다."
      : "DNS 캐시를 비워도 HTTP 응답의 유효 시간은 바뀌지 않습니다.";
    trace = createTrace([event("browser", "조치로 원인을 해결하지 못함", feedback, 5, true)]);
  }
  if (cache) {
    state.age += trace.total;
    if (phase === "repair" && actionId === "revalidate") state.age = 25;
  }
  state.elapsed += trace.total; state.attempts++; state.faults += fault ? 1 : 0;
  if (state.elapsed > state.budget || (state.attempts >= state.maxAttempts && state.phase !== "complete")) {
    state.phase = "failed"; feedback = "예산 소진 · 같은 조건으로 다시 도전하세요.";
  }
  state.feedback = feedback;
  state.history.push({ phase, actionId, label: choice.label, before: previous.elapsed, after: state.elapsed, feedback, trace });
  return state;
}
