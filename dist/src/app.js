import { createJourney, concepts } from "./model.js";
import { missions, assessAction } from "./missions.js";
const $ = (id) => document.getElementById(id),
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const coordinates = {
  browser: "14%",
  dns: "38%",
  connection: "62%",
  server: "86%",
};
const logCodes = {
  inspect: "BROWSER · CACHE-CHECK",
  cache: "HTTP-CACHE-HIT",
  render: "RENDER · COMPLETE",
  offline: "ERR_INTERNET_DISCONNECTED",
  "dns-cache": "DNS-CACHE-HIT",
  dns: "DNS · RESOLVED",
  "dns-failure": "ERR_NAME_NOT_RESOLVED",
  tcp: "TCP · CONNECTED",
  tls: "TLS · READY",
  request: "HTTP · GET /",
  response: "HTTP · 200 OK",
  "http-error": "HTTP · 500 INTERNAL SERVER ERROR",
};
let mode = "mission",
  caseIndex = 0,
  journey,
  position = -1,
  timer = null,
  running = false,
  evidenceReady = false,
  resolving = false,
  solved = false,
  wrong = 0,
  hinted = false,
  currentConfig = { ...missions[0].config };
const scores = new Map();
function configuration() {
  return mode === "mission"
    ? currentConfig
    : {
        cache: $("cache").value,
        scenario: $("scenario").value,
        latency: Number($("latency").value),
      };
}
function stop() {
  clearTimeout(timer);
  timer = null;
  running = false;
}
function renderRail() {
  $("case-picker").replaceChildren(
    ...missions.map((mission, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${String(index + 1).padStart(2, "0")} · ${mission.short}${scores.has(mission.id) ? " ✓" : ""}`;
      option.selected = index === caseIndex;
      return option;
    }),
  );
  $("case-list").replaceChildren(
    ...missions.map((mission, i) => {
      const button = document.createElement("button");
      button.className =
        "case-button" +
        (mode === "mission" && i === caseIndex ? " selected" : "");
      button.setAttribute(
        "aria-pressed",
        String(mode === "mission" && i === caseIndex),
      );
      const number = document.createElement("span"),
        text = document.createElement("span"),
        title = document.createElement("strong"),
        meta = document.createElement("small"),
        mark = document.createElement("span");
      number.textContent = String(i + 1).padStart(2, "0");
      title.textContent = mission.short;
      meta.textContent = mission.category.split(" / ")[0];
      text.append(title, meta);
      mark.className = "case-mark";
      mark.textContent = scores.has(mission.id) ? "✓" : "";
      button.append(number, text, mark);
      button.addEventListener("click", () => openCase(i));
      return button;
    }),
  );
  $("solved-count").textContent = `${scores.size} / 6`;
  $("total-score").textContent =
    `${[...scores.values()].reduce((a, b) => a + b, 0)} POINTS`;
  $("completion-dots").replaceChildren(
    ...missions.map((m) => {
      const span = document.createElement("span");
      span.className = scores.has(m.id) ? "done" : "";
      return span;
    }),
  );
}
function updateButtons() {
  const finished = position === journey.stages.length - 1;
  $("play").textContent = finished
    ? "다시 보기"
    : running
      ? "일시정지"
      : position < 0
        ? mode === "mission"
          ? resolving
            ? "결과 확인하기"
            : "요청 조사하기"
          : "요청 시작"
        : "계속 재생";
  $("play").setAttribute("aria-pressed", String(running));
  $("step").disabled = finished;
  $("run-status").className =
    "status-badge" +
    (finished
      ? journey.failed
        ? " error"
        : " done"
      : running
        ? " running"
        : "");
  $("run-status").textContent = finished
    ? journey.failed
      ? "오류 확인"
      : "응답 확인"
    : running
      ? "요청 진행 중"
      : position < 0
        ? "조사 대기"
        : "일시정지";
  document
    .querySelectorAll(".action-option")
    .forEach((b) => (b.disabled = !evidenceReady || resolving || solved));
  $("hint").disabled = hinted || solved || resolving;
}
function reset() {
  stop();
  journey = createJourney(configuration());
  position = -1;
  $("step-count").textContent =
    `00 / ${String(journey.stages.length).padStart(2, "0")}`;
  $("stage-title").textContent = resolving
    ? "조건을 바꿨습니다. 결과를 비교해보세요."
    : mode === "mission"
      ? "첫 번째 단서는 요청 기록에 있습니다."
      : "조건을 정하고 요청을 시작하세요.";
  $("stage-description").textContent =
    "요청을 실행하고 어떤 단계를 거치는지 확인하세요.";
  $("progress-fill").style.width = "0%";
  $("packet").style.left = coordinates.browser;
  $("packet").classList.remove("failed");
  $("elapsed").textContent = "0 ms";
  $("latency-output").value = $("latency").value + " ms";
  $("estimated-time").textContent = journey.total + " ms";
  $("cache-hint").textContent =
    configuration().cache === "http"
      ? "최신 페이지 응답을 재사용해 네트워크를 생략합니다."
      : configuration().cache === "dns"
        ? "IP 주소를 재사용하지만 HTTP 요청은 필요합니다."
        : "DNS 조회부터 서버 응답까지 진행합니다.";
  $("trace").replaceChildren(
    Object.assign(document.createElement("li"), {
      className: "empty-trace",
      textContent: "요청을 실행하면 단서가 나타납니다.",
    }),
  );
  $("trace-count").textContent = "0 EVENTS";
  document.querySelectorAll("[data-node]").forEach((node) => {
    node.className = "network-node";
    const skipped =
      (configuration().cache === "http" && node.dataset.node !== "browser") ||
      (configuration().cache === "dns" && node.dataset.node === "dns");
    node.classList.toggle("skipped", skipped);
    node.querySelector(".node-state").textContent = skipped
      ? "BYPASSED"
      : node.dataset.node === "browser"
        ? "READY"
        : "WAITING";
  });
  updateButtons();
}
function advance() {
  if (position >= journey.stages.length - 1) return;
  const stage = journey.stages[++position];
  document.querySelectorAll("[data-node]").forEach((node) => {
    const current = node.dataset.node === stage.node,
      visited = journey.stages
        .slice(0, position)
        .some((s) => s.node === node.dataset.node);
    node.classList.remove("active", "failed");
    node.classList.toggle("visited", visited && !current);
    if (current) node.classList.add(stage.error ? "failed" : "active");
    node.querySelector(".node-state").textContent = current
      ? stage.error
        ? "FAILED"
        : position === journey.stages.length - 1
          ? "COMPLETE"
          : "ACTIVE"
      : node.classList.contains("skipped")
        ? "BYPASSED"
        : visited
          ? "VISITED"
          : "WAITING";
  });
  $("packet").style.left = coordinates[stage.node];
  $("packet").classList.toggle("failed", stage.error);
  $("stage-title").textContent = stage.title;
  $("stage-description").textContent = stage.description;
  $("step-count").textContent =
    `${String(position + 1).padStart(2, "0")} / ${String(journey.stages.length).padStart(2, "0")}`;
  $("progress-fill").style.width =
    `${((position + 1) / journey.stages.length) * 100}%`;
  $("elapsed").textContent = stage.elapsed + " ms";
  if (position === 0) $("trace").replaceChildren();
  const row = document.createElement("li"),
    time = document.createElement("time"),
    text = document.createElement("span");
  time.textContent = stage.elapsed + " ms";
  text.textContent = logCodes[stage.id];
  if (stage.error) text.className = "error-text";
  row.append(time, text);
  $("trace").append(row);
  $("trace").scrollTop = $("trace").scrollHeight;
  $("trace-count").textContent = position + 1 + " EVENTS";
  if (position === journey.stages.length - 1) {
    stop();
    if (mode === "mission") {
      if (resolving) finishResolution();
      else if (!solved) {
        evidenceReady = true;
        $("action-instruction").textContent =
          "기록을 확인했습니다. 가장 적절한 조치를 선택하세요.";
      }
    }
  }
  updateButtons();
}
function schedule() {
  clearTimeout(timer);
  if (!running) return;
  timer = setTimeout(
    () => {
      if (!running) return;
      advance();
      schedule();
    },
    (800 + (journey.stages[position + 1]?.duration || 0)) /
      Number($("speed").value),
  );
}
function play() {
  if (running) {
    stop();
    updateButtons();
    return;
  }
  if (position === journey.stages.length - 1) reset();
  if (position < 0) advance();
  if (position === journey.stages.length - 1) return;
  running = true;
  updateButtons();
  schedule();
}
function setMode(next) {
  mode = next;
  $("mission-mode").classList.toggle("selected", mode === "mission");
  $("free-mode").classList.toggle("selected", mode === "free");
  $("mission-mode").setAttribute("aria-pressed", String(mode === "mission"));
  $("free-mode").setAttribute("aria-pressed", String(mode === "free"));
  $("mission-actions").hidden = mode !== "mission";
  $("free-controls").hidden = mode !== "free";
}
function openCase(index) {
  if (!Number.isInteger(index) || index < 0 || index >= missions.length)
    throw new TypeError("Invalid case");
  stop();
  caseIndex = index;
  setMode("mission");
  const mission = missions[index];
  currentConfig = { ...mission.config };
  evidenceReady = false;
  resolving = false;
  solved = false;
  wrong = 0;
  hinted = false;
  $("case-number").textContent = `CASE ${String(index + 1).padStart(2, "0")}`;
  $("case-category").textContent = mission.category;
  $("case-title").textContent = mission.title;
  $("case-brief").textContent = mission.brief;
  $("case-objective").textContent = mission.objective;
  $("case-points").textContent = "100 PT";
  $("hint-text").hidden = true;
  $("resolution").hidden = true;
  $("action-feedback").hidden = true;
  $("action-instruction").textContent =
    "먼저 요청을 끝까지 조사하세요. 기록을 확인하면 조치를 선택할 수 있습니다.";
  $("action-options").replaceChildren(
    ...mission.actions.map((action, i) => {
      const button = document.createElement("button"),
        number = document.createElement("span"),
        text = document.createElement("strong");
      button.className = "action-option";
      number.textContent = `OPTION ${String(i + 1).padStart(2, "0")}`;
      text.textContent = action.label;
      button.append(number, text);
      button.addEventListener("click", () => chooseAction(action.id));
      return button;
    }),
  );
  $("hint").textContent = "힌트 보기 · −20 PT";
  renderRail();
  reset();
}
function showFree() {
  stop();
  setMode("free");
  evidenceReady = false;
  resolving = false;
  solved = false;
  $("case-number").textContent = "SANDBOX";
  $("case-category").textContent = "FREE EXPERIMENT";
  $("case-title").textContent = "같은 요청, 다른 경로.";
  $("case-brief").textContent =
    "캐시와 오류를 바꾸고 각 단계가 생략되거나 멈추는 지점을 비교하세요.";
  $("case-objective").textContent = "조건을 바꾸고 결과를 직접 관찰하세요.";
  $("case-points").textContent = "NO SCORE";
  renderRail();
  reset();
}
function chooseAction(actionId) {
  if (!evidenceReady || resolving || solved) return;
  const result = assessAction(missions[caseIndex].id, actionId, {
    wrong,
    hinted,
  });
  $("action-feedback").hidden = false;
  if (!result.correct) {
    wrong++;
    $("action-feedback").className = "action-feedback";
    $("action-feedback").textContent = result.feedback;
    $("case-points").textContent =
      `${Math.max(10, 100 - wrong * 15 - (hinted ? 20 : 0))} PT`;
    return;
  }
  stop();
  resolving = true;
  currentConfig = result.config;
  $("action-feedback").className = "action-feedback success";
  $("action-feedback").textContent =
    "조치를 적용했습니다. 바뀐 요청 경로를 확인해보세요.";
  reset();
  play();
  document.querySelector(".journey").scrollIntoView({
    behavior: reducedMotion.matches ? "auto" : "smooth",
    block: "center",
  });
}
function finishResolution() {
  const mission = missions[caseIndex],
    result = assessAction(
      mission.id,
      mission.actions.find((a) => a.correct).id,
      { wrong, hinted },
    );
  resolving = false;
  solved = true;
  scores.set(mission.id, Math.max(scores.get(mission.id) || 0, result.score));
  $("case-points").textContent = result.score + " PT";
  $("action-feedback").hidden = true;
  $("resolution").hidden = false;
  $("resolution-title").textContent = `사건 해결 · ${result.score} PT`;
  $("resolution-explanation").textContent = result.explanation;
  $("comparison").replaceChildren(
    ...[
      ["BEFORE", createJourney(mission.config)],
      ["AFTER", journey],
    ].map(([label, run]) => {
      const box = document.createElement("div"),
        small = document.createElement("small"),
        strong = document.createElement("strong"),
        p = document.createElement("p");
      small.textContent = label;
      strong.textContent = run.total + " ms";
      p.textContent = `${run.stages.length}단계 · ${run.failed ? "요청 중단" : "페이지 표시"}`;
      box.append(small, strong, p);
      return box;
    }),
  );
  $("next-case").textContent =
    caseIndex === 5 ? "첫 사건으로 돌아가기" : "다음 사건";
  $("action-instruction").textContent =
    scores.size === 6
      ? "6개의 사건을 모두 해결했습니다. 다른 조치나 자유 실험도 비교해보세요."
      : "해결 전과 후의 기록을 비교하고 다음 사건으로 진행하세요.";
  renderRail();
}
$("play").addEventListener("click", play);
$("step").addEventListener("click", () => {
  stop();
  advance();
});
$("restart").addEventListener("click", reset);
$("mission-mode").addEventListener("click", () => openCase(caseIndex));
$("case-picker").addEventListener("change", () =>
  openCase(Number($("case-picker").value)),
);
$("free-mode").addEventListener("click", showFree);
$("hint").addEventListener("click", () => {
  if (hinted || solved || resolving) return;
  hinted = true;
  $("hint-text").hidden = false;
  $("hint-text").textContent = missions[caseIndex].hint;
  $("hint").textContent = "힌트 사용됨";
  $("case-points").textContent = `${Math.max(10, 100 - wrong * 15 - 20)} PT`;
  updateButtons();
});
$("next-case").addEventListener("click", () =>
  openCase((caseIndex + 1) % missions.length),
);
$("replay-case").addEventListener("click", () => openCase(caseIndex));
for (const id of ["cache", "scenario", "latency"])
  $(id).addEventListener("input", () => {
    if (mode === "free") reset();
  });
$("speed").addEventListener("input", schedule);
document.querySelectorAll("[data-concept]").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-concept]").forEach((b) => {
      const active = b === button;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    $("concept-text").textContent = concepts[button.dataset.concept];
  }),
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
    updateButtons();
  }
});
window.addEventListener("pagehide", stop);
$("concept-text").textContent = concepts.dns;
openCase(0);
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {
      name: "configure_journey",
      title: "자유 실험 설정",
      description:
        "자유 실험으로 이동해 캐시, 오류와 지연 조건을 설정합니다. 미션 점수를 변경하거나 실제 네트워크 요청을 보내지 않습니다.",
      inputSchema: {
        type: "object",
        properties: {
          cache: { type: "string", enum: ["none", "dns", "http"] },
          scenario: {
            type: "string",
            enum: ["normal", "dns-error", "server-error", "offline"],
          },
          latency: {
            type: "number",
            minimum: 20,
            maximum: 300,
            multipleOf: 10,
          },
        },
        required: ["cache", "scenario", "latency"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (
          !input ||
          Object.keys(input).some(
            (k) => !["cache", "scenario", "latency"].includes(k),
          ) ||
          input.latency % 10 !== 0
        )
          throw new TypeError("Invalid configuration");
        createJourney(input);
        $("cache").value = input.cache;
        $("scenario").value = input.scenario;
        $("latency").value = input.latency;
        showFree();
        return {
          ...configuration(),
          stages: journey.stages.length,
          modelTimeMs: journey.total,
        };
      },
    },
    {
      name: "advance_journey",
      title: "요청 단계 진행",
      description:
        "현재 화면의 요청을 한 단계씩 진행합니다. 미션의 정답 선택이나 완료 처리는 하지 않습니다.",
      inputSchema: {
        type: "object",
        properties: { count: { type: "integer", minimum: 1, maximum: 7 } },
        required: ["count"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (
          !input ||
          Object.keys(input).some((k) => k !== "count") ||
          !Number.isInteger(input.count) ||
          input.count < 1 ||
          input.count > 7
        )
          throw new TypeError("Invalid count");
        stop();
        for (let i = 0; i < input.count; i++) advance();
        return {
          completedSteps: position + 1,
          title: journey.stages[position]?.title,
          done: position === journey.stages.length - 1,
          failed: journey.stages[position]?.error || false,
        };
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        document.modelContext.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
