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
    "DNS 캐시는 이름과 주소의 매핑을, 페이지 캐시는 응답 내용을 재사용합니다. 최신 페이지 캐시가 있으면 이 모델에서는 네트워크 전체를 건너뜁니다. 만료와 재검증은 생략합니다.",
};
