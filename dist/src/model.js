const caches = new Set(["none", "dns", "http"]),
  scenarios = new Set(["normal", "dns-error", "server-error", "offline"]);
export function createJourney({
  cache = "none",
  scenario = "normal",
  latency = 80,
} = {}) {
  if (
    !caches.has(cache) ||
    !scenarios.has(scenario) ||
    !Number.isFinite(latency) ||
    latency < 20 ||
    latency > 300
  )
    throw new TypeError("Invalid journey configuration");
  const stages = [];
  const add = (id, node, title, description, duration, error = false) =>
    stages.push({ id, node, title, description, duration, error });
  add(
    "inspect",
    "browser",
    "브라우저가 주소를 확인합니다.",
    "HTTPS 주소를 해석하고 사용할 수 있는 캐시가 있는지 확인합니다.",
    5,
  );
  if (cache === "http") {
    add(
      "cache",
      "browser",
      "최신 페이지를 캐시에서 가져옵니다.",
      "재검증 없이 사용할 수 있는 응답이 있습니다. DNS, 연결, 서버 요청을 모두 건너뜁니다.",
      3,
    );
    add(
      "render",
      "browser",
      "캐시된 페이지를 그립니다.",
      "이 모델에서는 연결이 끊겨 있어도 최신 캐시를 사용할 수 있습니다.",
      25,
    );
    return finish(stages);
  }
  if (scenario === "offline") {
    add(
      "offline",
      "browser",
      "네트워크 연결을 사용할 수 없습니다.",
      "사용할 페이지 캐시가 없어 요청을 더 진행하지 못합니다. 연결 상태를 확인해야 합니다.",
      5,
      true,
    );
    return finish(stages);
  }
  if (cache === "dns")
    add(
      "dns-cache",
      "browser",
      "DNS 캐시에서 IP 주소를 찾습니다.",
      "도메인과 IP 주소의 매핑이 캐시에 있습니다. DNS 서버 조회는 생략하지만 페이지 요청은 필요합니다.",
      2,
    );
  else {
    if (scenario === "dns-error") {
      add(
        "dns-failure",
        "dns",
        "도메인의 IP 주소를 찾지 못했습니다.",
        "DNS 조회가 실패했습니다. TCP 연결과 HTTP 요청은 아직 시작하지 않았습니다.",
        latency,
        true,
      );
      return finish(stages);
    }
    add(
      "dns",
      "dns",
      "DNS에서 IP 주소를 찾습니다.",
      "도메인 이름에 대응하는 IP 주소를 얻습니다. DNS의 내부 조회 과정은 단순화했습니다.",
      latency,
    );
  }
  add(
    "tcp",
    "connection",
    "TCP 연결을 만듭니다.",
    "서버와 연결을 맺습니다. 이 모델에서는 이전 연결을 재사용하지 않습니다.",
    latency,
  );
  add(
    "tls",
    "connection",
    "TLS로 보안 연결을 준비합니다.",
    "서버 인증서를 확인하고 암호화된 통신을 준비합니다. 여기서는 왕복 한 번의 시간을 가정합니다.",
    latency,
  );
  add(
    "request",
    "server",
    "HTTP 요청을 보냅니다.",
    "GET / 요청을 서버로 보냅니다. 편도 전송 시간을 왕복 지연의 절반으로 가정합니다.",
    Math.round(latency / 2),
  );
  if (scenario === "server-error")
    add(
      "http-error",
      "server",
      "서버가 HTTP 500으로 응답합니다.",
      "연결은 성공했지만 서버 내부 처리가 실패했습니다. 오류 응답도 HTTP 응답이며, DNS 실패와 다릅니다.",
      Math.round(latency / 2) + 40,
      true,
    );
  else {
    add(
      "response",
      "server",
      "HTTP 200 응답을 받습니다.",
      "서버가 요청을 처리하고 페이지 데이터를 반환합니다. 처리 시간 40 ms를 추가로 가정합니다.",
      Math.round(latency / 2) + 40,
    );
    add(
      "render",
      "browser",
      "브라우저가 페이지를 그립니다.",
      "HTML을 해석해 화면에 표시합니다. 추가 리소스 요청과 렌더링 세부 과정은 생략합니다.",
      25,
    );
  }
  return finish(stages);
}
function finish(stages) {
  let elapsed = 0;
  for (const stage of stages) {
    elapsed += stage.duration;
    stage.elapsed = elapsed;
  }
  return { stages, total: elapsed, failed: stages.at(-1).error };
}
export const concepts = {
  dns: "DNS는 도메인 이름에 대응하는 IP 주소를 찾습니다. DNS 캐시가 있으면 조회를 생략합니다. 캐시된 주소가 아직 유효한 상황을 가정합니다.",
  tls: "TCP는 연결과 신뢰성 있는 데이터 전달을 담당하고, TLS는 그 위에서 암호화와 서버 인증을 제공합니다. 이 모델은 HTTPS over TCP를 다루며 HTTP/3의 QUIC은 생략합니다.",
  http: "HTTP는 요청과 응답의 약속입니다. 200은 성공 응답, 500은 서버 내부 오류 응답입니다. 500도 서버에 연결한 뒤 받는 응답이며, 네트워크 연결 실패와는 다릅니다.",
  cache:
    "DNS 캐시는 주소를, HTTP 캐시는 응답 내용을 재사용합니다. 기초 사건은 유효한 응답 캐시로 네트워크를 생략합니다. 캐시 만료 진단에서는 유효 시간이 지나면 ETag로 재검증하고, 304는 저장된 본문을 재사용합니다.",
};

// Operation traces are logical events with modeled times, not captured traffic.
export function createTrace(events, offset = 0) {
  if (!Array.isArray(events) || events.length === 0 ||
    !Number.isFinite(offset) || offset < 0 ||
    events.some((event) => !event || !Number.isFinite(event.duration) || event.duration < 0))
    throw new TypeError("Invalid trace");
  let elapsed = offset;
  const stages = events.map((event) => {
    elapsed += event.duration;
    return { error: false, ...event, elapsed };
  });
  return {
    stages,
    total: elapsed - offset,
    failed: stages.some((stage) => stage.error),
  };
}

export function createRouteTrace(route) {
  validateRoute(route);
  const hops = route.hops.map((name, index) => ({
    id: "hop",
    node: index === 0 ? "gateway" : "router",
    title: name,
    description: `${route.label} · 홉 ${index + 1}/${route.hops.length} · 편도 처리`,
    duration: Math.round(route.rtt / (2 * route.hops.length)),
    code: `HOP ${index + 1} · ${name}`,
  }));
  return createTrace([
    ...hops,
    {
      id: "tcp",
      node: "connection",
      title: route.down ? "경로에서 응답이 돌아오지 않습니다." : "TCP 연결 성립",
      description: route.down
        ? "중계 링크가 끊겨 SYN 응답을 기다리다 시간 초과했습니다. 다른 경로를 선택하세요."
        : `RTT ${route.rtt} ms · 대기열 ${route.queue} ms · TLS는 아직 확인하지 않았습니다.`,
      duration: route.down ? route.rtt * 3 : Math.round(route.rtt / 2),
      error: route.down,
      code: route.down ? "SYN · TIMEOUT" : "TCP · CONNECTED",
    },
  ]);
}

export function transferPackets({ route, count, strategy, missing = [] }) {
  validateRoute(route);
  if (
    !Number.isInteger(count) || count < 4 || count > 12 ||
    !["burst", "pace", "retry-missing", "retry-all"].includes(strategy) ||
    !Array.isArray(missing) || new Set(missing).size !== missing.length ||
    missing.some((id) => !Number.isInteger(id) || id < 1 || id > count) ||
    (strategy === "retry-missing" && missing.length === 0) || route.down
  ) throw new TypeError("Invalid transmission");
  const retry = strategy.startsWith("retry"),
    ids = strategy === "retry-missing"
      ? [...missing].sort((a, b) => a - b)
      : Array.from({ length: count }, (_, i) => i + 1),
    lost = retry ? [] : strategy === "pace" ? route.pacedLoss : route.loss,
    queue = strategy === "pace" ? Math.round(route.queue / 4) : route.queue,
    events = [{
      id: "request", node: "server", title: retry ? "재전송 시작" : "HTTP 응답 데이터 전송",
      description: `RTT ${route.rtt} ms + 대기열 ${queue} ms. ${strategy === "pace" ? "전송 간격을 두어 대기열을 줄입니다." : "선택한 패킷을 한 번에 보냅니다."}`,
      duration: route.rtt + queue, code: retry ? "TCP · RETRANSMIT" : "HTTP · 200 / DATA",
    }], packets = [];
  for (const id of ids) {
    const dropped = lost.includes(id);
    packets.push({ id, status: dropped ? "lost" : "ack", retry });
    events.push({
      id: dropped ? "loss" : "ack", node: dropped ? "router" : "browser",
      title: `패킷 #${id} ${dropped ? "유실" : "수신 확인"}`,
      description: dropped
        ? "응답 조각이 도착하지 않았습니다. 누락된 조각을 재전송해야 완성됩니다."
        : `#${id} 조각을 수신했습니다. ACK를 묶어 확인하는 과정은 단순화했습니다.`,
      duration: strategy === "pace" ? 12 : 4, error: dropped,
      code: `SEQ ${id} · ${dropped ? "LOST" : "ACK"}${retry ? " · RETRY" : ""}`,
    });
  }
  if (packets.some((p) => p.status === "lost")) events.push({
    id: "timeout", node: "connection", title: "누락된 패킷을 기다립니다.",
    description: "이 모델은 고정 재전송 대기 시간을 사용합니다. 아직 완전한 응답이 아닙니다.",
    duration: route.rtt * 2, error: true, code: "RTO · MISSING DATA",
  });
  return { ...createTrace(events), packets };
}

function validateRoute(route) {
  if (!route || !Number.isFinite(route.rtt) || route.rtt <= 0 ||
    !Number.isFinite(route.queue) || route.queue < 0 ||
    !Array.isArray(route.hops) || route.hops.length < 2 ||
    route.hops.some((name) => typeof name !== "string" || name.length === 0) ||
    !Array.isArray(route.loss) || !Array.isArray(route.pacedLoss) ||
    [...route.loss, ...route.pacedLoss].some((id) => !Number.isInteger(id) || id < 1) ||
    typeof route.down !== "boolean") throw new TypeError("Invalid route");
}
