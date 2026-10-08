import { createJourney, concepts } from "./model.js";
const $ = (id) => document.getElementById(id),
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let journey,
  position = -1,
  timer = null,
  running = false;
const coordinates = {
  browser: "14%",
  dns: "38%",
  connection: "62%",
  server: "86%",
};
function configuration() {
  return {
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
function updateButtons() {
  const finished = position === journey.stages.length - 1;
  $("play").textContent = finished
    ? "다시 여행하기"
    : running
      ? "일시정지"
      : position < 0
        ? "여행 시작"
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
      ? "오류에서 멈춤"
      : "여행 완료"
    : running
      ? "여행 중"
      : position < 0
        ? "시작할 준비 완료"
        : "일시정지";
}
function reset() {
  stop();
  journey = createJourney(configuration());
  position = -1;
  $("step-count").textContent =
    "00 / " + String(journey.stages.length).padStart(2, "0");
  $("stage-title").textContent = "어떤 길을 지나갈까요?";
  $("stage-description").textContent = reducedMotion.matches
    ? "동작 줄이기 설정을 감지했습니다. 한 단계씩 버튼으로 여행을 따라가보세요."
    : "재생을 누르거나 한 단계씩 진행해보세요. 캐시와 오류 상황을 바꾸면 여행 경로도 달라집니다.";
  $("progress-fill").style.width = "0%";
  $("packet").style.left = coordinates.browser;
  $("packet").classList.remove("failed");
  $("elapsed").textContent = "모델 경과 시간 0 ms";
  $("latency-output").value = $("latency").value + " ms";
  $("estimated-time").replaceChildren(
    document.createTextNode(String(journey.total)),
    Object.assign(document.createElement("small"), { textContent: " ms" }),
  );
  $("cache-hint").textContent =
    $("cache").value === "http"
      ? "최신 페이지 캐시로 네트워크를 생략합니다."
      : $("cache").value === "dns"
        ? "DNS 조회만 생략합니다. 서버 연결은 필요합니다."
        : "네트워크를 거쳐 페이지를 가져옵니다.";
  if ($("scenario").value === "dns-error" && $("cache").value === "dns")
    $("cache-hint").textContent =
      "DNS 서버가 실패해도 유효한 DNS 캐시로 진행합니다.";
  if (journey.failed)
    $("cache-hint").textContent += " 선택한 오류에서 요청이 중단됩니다.";
  $("trace").replaceChildren(
    Object.assign(document.createElement("li"), {
      textContent: "요청을 시작하면 단계별 기록이 여기에 나타납니다.",
      className: "empty-trace",
    }),
  );
  $("trace-count").textContent = "0 EVENTS";
  document.querySelectorAll("[data-node]").forEach((node) => {
    node.className = "network-node";
    const skipped =
      ($("cache").value === "http" && node.dataset.node !== "browser") ||
      ($("cache").value === "dns" && node.dataset.node === "dns");
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
  position++;
  const stage = journey.stages[position];
  document.querySelectorAll("[data-node]").forEach((node) => {
    const current = node.dataset.node === stage.node;
    node.classList.remove("active", "failed");
    const visited = journey.stages
      .slice(0, position)
      .some((entry) => entry.node === node.dataset.node);
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
    String(position + 1).padStart(2, "0") +
    " / " +
    String(journey.stages.length).padStart(2, "0");
  $("progress-fill").style.width =
    ((position + 1) / journey.stages.length) * 100 + "%";
  $("elapsed").textContent = "모델 경과 시간 " + stage.elapsed + " ms";
  if (position === 0) $("trace").replaceChildren();
  const row = document.createElement("li"),
    time = document.createElement("time"),
    text = document.createElement("span");
  time.textContent = stage.elapsed + " ms";
  text.textContent = stage.title;
  text.classList.toggle("error-text", stage.error);
  row.append(time, text);
  $("trace").append(row);
  $("trace").scrollTop = $("trace").scrollHeight;
  $("trace-count").textContent = position + 1 + " EVENTS";
  if (position === journey.stages.length - 1) stop();
  updateButtons();
}
function schedule() {
  clearTimeout(timer);
  if (!running) return;
  const delay =
    (1050 + (journey.stages[position + 1]?.duration || 0)) /
    Number($("speed").value);
  timer = setTimeout(() => {
    if (!running) return;
    advance();
    schedule();
  }, delay);
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
$("play").addEventListener("click", play);
$("step").addEventListener("click", () => {
  stop();
  advance();
});
$("restart").addEventListener("click", reset);
["cache", "scenario", "latency"].forEach((id) =>
  $(id).addEventListener("input", reset),
);
$("speed").addEventListener("input", schedule);
document.querySelectorAll("[data-concept]").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-concept]").forEach((element) => {
      const selected = element === button;
      element.classList.toggle("active", selected);
      element.setAttribute("aria-pressed", String(selected));
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
reset();
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {
      name: "configure_journey",
      title: "여행 조건 설정",
      description:
        "캐시, 오류 상황, 지연 가정값을 설정하고 교육용 여행을 초기화합니다. 실제 네트워크 요청은 없습니다.",
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
            (key) => !["cache", "scenario", "latency"].includes(key),
          ) ||
          input.latency % 10 !== 0
        )
          throw new TypeError("Invalid journey configuration");
        createJourney(input);
        $("cache").value = input.cache;
        $("scenario").value = input.scenario;
        $("latency").value = String(input.latency);
        reset();
        return {
          ...configuration(),
          stages: journey.stages.length,
          modelTimeMs: journey.total,
        };
      },
    },
    {
      name: "advance_journey",
      title: "여행 단계 진행",
      description:
        "현재 교육용 여행을 지정한 단계 수만큼 진행하고 화면과 여행 기록을 갱신합니다.",
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
          Object.keys(input).some((key) => key !== "count") ||
          !Number.isInteger(input.count) ||
          input.count < 1 ||
          input.count > 7
        )
          throw new TypeError("Invalid step count");
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
      ).catch(() => console.info("Optional browser tool unavailable"));
    } catch {
      console.info("Optional browser tool unavailable");
    }
  }
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
