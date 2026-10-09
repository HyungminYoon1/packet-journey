import { createTrace, createRouteTrace, transferPackets } from "./model.js";

export const missions = Object.freeze([
  {
    id: "dns",
    title: "이름만 있고, 주소는 없다.",
    short: "사라진 주소",
    category: "DNS / 입문",
    brief:
      "같은 네트워크에서 다른 페이지는 열립니다. 이 요청은 어디에서 막혔을까요?",
    objective: "오류가 시작된 단계를 찾고 연결을 복구하세요.",
    config: { scenario: "dns-error", cache: "none", latency: 80 },
    hint: "TCP와 HTTP 기록이 없다면, 그보다 앞선 단계에서 막힌 것입니다.",
    actions: [
      {
        id: "server",
        label: "웹 서버 프로그램 재시작",
        feedback:
          "서버에 요청이 도착하지 않았습니다. 서버 프로그램을 고쳐도 이름을 주소로 바꾸지 못하는 문제는 남습니다.",
      },
      { id: "dns", label: "DNS 조회 문제 해결 후 재시도", correct: true },
      {
        id: "page",
        label: "페이지 캐시만 비우기",
        feedback:
          "현재 쓸 수 있는 페이지 캐시가 없습니다. 캐시 삭제는 실패한 DNS 조회를 복구하지 못합니다.",
      },
    ],
    after: { scenario: "normal", cache: "none", latency: 80 },
    explanation:
      "DNS 조회가 실패하면 연결할 IP 주소를 얻지 못합니다. DNS 문제를 해결하자 TCP와 TLS, HTTP 요청으로 진행합니다. DNS 서버 변경이 모든 DNS 문제의 해결책인 것은 아니므로 실제 환경에서는 도메인·리졸버·설정을 함께 확인해야 합니다.",
  },
  {
    id: "server",
    title: "연결됐는데, 왜 열리지 않을까?",
    short: "연결 뒤의 오류",
    category: "HTTP / 입문",
    brief:
      "DNS와 보안 연결은 통과했습니다. 그런데 페이지 대신 HTTP 500을 받았습니다.",
    objective: "클라이언트 연결 문제와 서버 처리 문제를 구분하세요.",
    config: { scenario: "server-error", cache: "none", latency: 80 },
    hint: "500은 연결 실패가 아니라 서버가 보낸 HTTP 응답입니다.",
    actions: [
      {
        id: "dns",
        label: "DNS 주소 다시 찾기",
        feedback:
          "이미 DNS 조회와 서버 연결에 성공했습니다. 같은 주소를 다시 찾는 것으로 서버 내부 처리 오류를 고치지는 못합니다.",
      },
      {
        id: "refresh",
        label: "문제를 고치지 않고 계속 새로고침",
        feedback:
          "잠깐의 오류라면 재시도가 통할 수 있지만, 이 사건에서는 서버 오류가 계속됩니다. 원인을 고치는 조치가 필요합니다.",
      },
      { id: "repair", label: "서버 내부 처리 오류 수정", correct: true },
    ],
    after: { scenario: "normal", cache: "none", latency: 80 },
    explanation:
      "500은 서버 내부에서 요청 처리가 실패했다는 응답입니다. 이 모델에서는 서버 오류를 수정한 뒤 200 응답을 받습니다. DNS·연결·TLS가 정상이라는 기록을 먼저 확인하면 불필요한 클라이언트 설정 변경을 줄일 수 있습니다.",
  },
  {
    id: "offline",
    title: "첫 단계에서 멈춘 요청.",
    short: "끊어진 연결",
    category: "NETWORK / 입문",
    brief: "브라우저에 저장된 페이지가 없고 요청은 시작하자마자 중단됩니다.",
    objective: "최신 페이지를 서버에서 가져올 수 있게 복구하세요.",
    config: { scenario: "offline", cache: "none", latency: 80 },
    hint: "DNS 캐시는 IP 주소를 기억할 뿐 인터넷 연결을 만들어주지 않습니다.",
    actions: [
      { id: "network", label: "네트워크 연결 복구", correct: true },
      {
        id: "dns",
        label: "유효한 DNS 캐시만 추가",
        feedback:
          "IP 주소를 알아도 연결이 끊겨 있으면 서버에 요청을 보낼 수 없습니다.",
      },
      {
        id: "server",
        label: "웹 서버 코드 수정",
        feedback:
          "요청이 기기를 벗어나지 못했습니다. 서버 코드를 수정해도 현재 기기의 네트워크 연결은 복구되지 않습니다.",
      },
    ],
    after: { scenario: "normal", cache: "none", latency: 80 },
    explanation:
      "사용할 페이지 캐시가 없으면 서버에 도달해야 합니다. 인터넷 연결을 복구하자 DNS부터 HTTP 응답까지 진행됩니다. DNS 캐시는 응답 내용이 아니므로 오프라인 페이지를 제공하지 못합니다.",
  },
  {
    id: "cache",
    title: "인터넷이 끊겼는데, 페이지가 열린다?",
    short: "오프라인의 역설",
    category: "CACHE / 응용",
    brief:
      "연결은 끊겨 있는데 화면은 정상적으로 나타납니다. 정말 서버와 통신한 걸까요?",
    objective: "페이지 캐시의 역할을 제거 실험으로 확인하세요.",
    config: { scenario: "offline", cache: "http", latency: 80 },
    hint: "어느 노드도 서버에 닿지 않았습니다. 응답 내용이 브라우저에 남아 있습니다.",
    actions: [
      {
        id: "server",
        label: "서버를 재시작해 비교",
        feedback:
          "이 요청은 서버를 거치지 않았습니다. 서버 재시작은 브라우저가 보여주는 캐시 응답을 설명하지 못합니다.",
      },
      { id: "clear", label: "페이지 캐시를 비우고 재시도", correct: true },
      {
        id: "dns",
        label: "DNS 캐시만 비우기",
        feedback:
          "페이지 응답 캐시와 DNS 주소 캐시는 다릅니다. DNS 캐시만 지워도 최신 페이지 캐시는 남습니다.",
      },
    ],
    after: { scenario: "offline", cache: "none", latency: 80 },
    explanation:
      "캐시를 비우자 오프라인 오류가 드러났습니다. 처음 보인 것은 서버 재검증 없이 사용할 수 있는 최신 페이지 응답입니다. 이 사건의 목표는 연결 복구가 아니라, 네트워크 없이 열린 이유를 검증하는 것입니다. 모든 웹사이트가 오프라인에서 열리는 것은 아닙니다.",
  },
  {
    id: "dns-cache",
    title: "DNS가 고장 났는데, 연결은 성공한다.",
    short: "기억된 주소",
    category: "DNS CACHE / 응용",
    brief:
      "DNS 서비스는 실패한 상태입니다. 그런데 브라우저는 서버에 연결해 200 응답을 받습니다.",
    objective: "어떤 캐시가 조회 실패를 가렸는지 확인하세요.",
    config: { scenario: "dns-error", cache: "dns", latency: 80 },
    hint: "DNS 서버 조회 대신 DNS-CACHE-HIT가 있습니다. HTTP 요청도 있는지 함께 확인하세요.",
    actions: [
      {
        id: "page",
        label: "페이지 응답 캐시만 지우기",
        feedback:
          "이 요청은 저장된 페이지가 아니라 실제 모델의 HTTP 응답을 받았습니다. 페이지 캐시를 지우는 실험으로 주소 재사용을 확인할 수 없습니다.",
      },
      {
        id: "tls",
        label: "TLS 연결만 다시 만들기",
        feedback:
          "TLS는 IP 주소를 찾은 뒤의 단계입니다. DNS 조회를 생략한 원인을 확인하려면 주소 캐시를 제거해야 합니다.",
      },
      { id: "clear", label: "DNS 캐시를 비우고 다시 조회", correct: true },
    ],
    after: { scenario: "dns-error", cache: "none", latency: 80 },
    explanation:
      "유효한 DNS 캐시가 IP 주소를 제공해 DNS 서버 조회를 건너뛰었습니다. 캐시를 비우자 실패한 DNS 조회가 나타납니다. DNS 캐시는 주소를 기억하고, 페이지 캐시는 응답 내용을 기억한다는 차이를 확인하는 사건입니다.",
  },
  {
    id: "fast",
    title: "두 번째 방문, 어디까지 건너뛸까?",
    short: "가장 짧은 여행",
    category: "OPTIMIZE / 응용",
    brief:
      "첫 방문은 390 ms입니다. 서버 재검증 없이 쓸 수 있는 최신 페이지 응답이 이미 있습니다.",
    objective: "이번 요청의 처리 시간을 가장 많이 줄이는 방법을 고르세요.",
    config: { scenario: "normal", cache: "none", latency: 80 },
    hint: "DNS만 줄이는 것보다, 연결과 HTTP 요청까지 생략하는 쪽이 짧습니다.",
    actions: [
      {
        id: "dns",
        label: "유효한 DNS 캐시 사용",
        feedback:
          "DNS 조회만 줄이면 312 ms입니다. 서버 요청까지 생략할 수 있는 최신 페이지 응답이 있다는 조건을 다시 보세요.",
      },
      { id: "page", label: "최신 페이지 응답 캐시 사용", correct: true },
      {
        id: "latency",
        label: "왕복 지연을 절반으로 줄이기",
        feedback:
          "이 모델에서 지연을 40 ms로 줄이면 230 ms입니다. 네트워크 단계를 모두 생략하는 방법은 더 짧습니다.",
      },
    ],
    after: { scenario: "normal", cache: "http", latency: 80 },
    explanation:
      "최신 페이지 응답 캐시를 사용하면 DNS, TCP, TLS와 HTTP 요청을 모두 건너뛰어 33 ms가 됩니다. DNS 캐시는 주소 조회만 생략합니다. 여기서는 최신 응답을 재검증 없이 사용할 수 있는 상황이며, 만료된 응답은 별도로 검증해야 합니다.",
  },
]);
export function assessAction(
  missionId,
  actionId,
  { wrong = 0, hinted = false } = {},
) {
  const mission = missions.find((m) => m.id === missionId),
    action = mission?.actions.find((a) => a.id === actionId);
  if (
    !action ||
    !Number.isInteger(wrong) ||
    wrong < 0 ||
    typeof hinted !== "boolean"
  )
    throw new TypeError("Invalid mission action");
  return action.correct
    ? {
        correct: true,
        score: Math.max(10, 100 - wrong * 15 - (hinted ? 20 : 0)),
        config: { ...mission.after },
        explanation: mission.explanation,
      }
    : { correct: false, feedback: action.feedback };
}

export const operations = Object.freeze([
  { id: "rescue", title: "주소 뒤에 숨은 두 번째 장애", short: "복합 장애 복구",
    brief: "저장된 응답은 오래됐고 DNS도 불안정합니다. 다음 장애까지 예상하며 새 응답을 받아오세요.",
    goal: "서버의 최신 응답 조각을 모두 수신하고 인증서를 검증하세요.", budget: 1500 },
  { id: "race", title: "짧은 길이 정말 빠를까?", short: "혼잡 구간 돌파",
    brief: "짧은 경로의 대기열이 길어졌습니다. 홉 수, 왕복 지연, 유실을 함께 비교하세요.",
    goal: "마감 안에 인증된 최신 응답을 완성하세요.", budget: 1000 },
  { id: "integrity", title: "우회해도 신뢰는 지켜야 한다", short: "경로와 인증",
    brief: "경로 장애와 인증서 문제를 분리해서 복구해야 합니다. 전송 중 유실도 확인하세요.",
    goal: "가용 경로를 찾고 TLS 검증 후 전체 응답을 전달하세요.", budget: 1300 },
  { id: "offline-copy", title: "서버에 갈 수 없는 날", short: "저장본 구출",
    brief: "모든 외부 경로가 끊겼습니다. 이번 목표는 최신 서버 응답이 아니라 저장된 자료를 여는 것입니다.",
    goal: "저장된 응답을 사용해 자료를 여세요. 최신성은 이번 목표의 조건이 아닙니다.", budget: 120 },
]);
const phaseTitles = {
  cache: "01 · 응답을 어디서 가져올까?", dns: "02 · 어떤 주소를 사용할까?",
  route: "03 · 어느 경로로 연결할까?", tls: "04 · 이 연결을 신뢰할 수 있을까?",
  transport: "05 · 패킷을 어떻게 보낼까?", recovery: "06 · 누락된 조각을 복구하라",
  complete: "작전 완료", failed: "예산 소진 · 다시 도전",
};
const event = (node, title, description, duration, error = false, code = title) =>
  ({ id: "operation", node, title, description, duration, error, code });

export function createOperation(id = "rescue", variant = 0, hard = false) {
  const definition = operations.find((o) => o.id === id);
  if (!definition || !Number.isInteger(variant) || variant < 0 || variant > 2 ||
    typeof hard !== "boolean") throw new TypeError("Invalid operation configuration");
  const offline = id === "offline-copy", race = id === "race";
  const routes = [
    { id: "direct", label: "A · 직행", hops: ["게이트웨이", "직행 라우터"],
      rtt: 40 + variant * 20, queue: race ? 230 + variant * 60 : 60,
      loss: variant === 2 ? [2, 3, 5] : [2, 5], pacedLoss: variant === 2 ? [3] : [],
      down: offline || (id === "integrity" && variant === 0) },
    { id: "relay", label: "B · 중계", hops: ["게이트웨이", "중계 라우터", "엣지 라우터"],
      rtt: 80 + variant * 15, queue: 12, loss: [], pacedLoss: [], down: offline },
    { id: "scenic", label: "C · 우회", hops: ["게이트웨이", "우회 라우터", "지역 라우터", "엣지 라우터"],
      rtt: 170 + variant * 20, queue: 0, loss: [], pacedLoss: [], down: offline },
  ];
  return {
    id, variant, hard, phase: "cache", elapsed: 0, attempts: 0, faults: 0,
    hinted: false, history: [], packets: [], routeId: null, authenticated: false,
    cache: offline ? (variant === 1 ? "stale" : "fresh") : variant === 1 ? "none" : "stale",
    dnsCache: race ? "valid" : variant === 2 ? "none" : "expired",
    primaryDns: id === "rescue" || (id === "integrity" && variant === 1) ? "down" : "up",
    certificate: id === "rescue" || (id === "integrity" && variant !== 2) ? "expired" : "valid",
    count: 6 + variant * 2, routes,
    budget: hard ? Math.round(definition.budget * 0.7) : definition.budget,
    maxAttempts: hard ? 7 : 12, feedback: "조건을 비교하고 첫 판단을 선택하세요.",
  };
}

export function operationView(state) {
  const definition = operations.find((o) => o.id === state.id);
  if (!definition || !phaseTitles[state.phase]) throw new TypeError("Invalid operation state");
  let choices = [], evidence = "", hint = "";
  switch (state.phase) {
    case "cache":
      evidence = `응답 캐시: ${state.cache === "none" ? "없음" : state.cache === "stale" ? "오래된 저장본" : "최신 저장본"} · 이번 목표: ${definition.goal}`;
      choices = [["use-cache", "저장된 응답 사용", "3 ms + 렌더링 · 네트워크 생략"],
        ["fresh", "서버에서 새 응답 받기", "5 ms · 주소 조회로 진행"]];
      hint = state.id === "offline-copy" ? "저장본을 여는 목표에서는 오래된 응답도 쓸 수 있습니다." : "오래된 응답은 최신 자료라는 목표를 만족하지 않습니다.";
      break;
    case "dns":
      evidence = `주소 캐시: ${state.dnsCache === "valid" ? "TTL 남음" : state.dnsCache === "expired" ? "TTL 만료" : "없음"} · 기본 리졸버: ${state.primaryDns === "up" ? "응답 가능" : "시간 초과"} · 대체 리졸버: 응답 가능`;
      choices = [["dns-cache", "기억된 주소 사용", "2 ms · TTL 확인 필요"],
        ["primary", "기본 리졸버에 조회", "35 ms · 실패 시 대기 120 ms"],
        ["backup", "대체 리졸버에 조회", "55 ms · 사용 가능한 주소 반환"]];
      hint = "TTL이 지난 주소는 유효하다고 가정할 수 없습니다. 리졸버 응답 상태를 함께 보세요.";
      break;
    case "route":
      evidence = "경로 카드의 홉 수와 RTT는 서로 다른 지표입니다. 대기열과 유실 조각도 전송 시간에 영향을 줍니다.";
      choices = state.routes.map((route) => [route.id, route.label,
        `${route.hops.length}홉 · RTT ${route.rtt} ms · 대기열 ${route.queue} ms · ${route.down ? "링크 단절" : `일괄 유실 ${route.loss.length}개 / 간격 유실 ${route.pacedLoss.length}개`}`]);
      hint = "홉이 더 많아도 대기열이 짧고 유실이 없는 경로가 빨리 끝날 수 있습니다.";
      break;
    case "tls":
      evidence = `TCP 연결 완료 · 서버 인증서: ${state.certificate === "valid" ? "유효" : "만료됨"} · HTTP 요청은 아직 보내지 않음`;
      choices = [["verify", "인증서 검증", "선택 경로 RTT · 유효한 인증서 필요"],
        ["renew", "인증서 갱신 후 검증", "110 ms + RTT · 신뢰 복구"],
        ["bypass", "검증 생략 시도", "인증된 응답 목표를 만족하지 못함"]];
      hint = "주소와 TCP가 정상이어도 TLS 검증은 실패할 수 있습니다. 만료된 인증서를 먼저 복구하세요.";
      break;
    case "transport":
      evidence = `${state.count}개 응답 조각 · TLS 검증 완료 · ${state.routes.find((r) => r.id === state.routeId).label}`;
      choices = [["burst", "한 번에 전송", "조각당 4 ms · 대기열/일괄 유실 적용"],
        ["pace", "간격을 두고 전송", "조각당 12 ms · 대기열 ¼ / 간격 유실 적용"]];
      hint = "혼잡한 경로에서는 전송 간격이 대기열과 유실을 줄입니다. 깨끗한 경로에서는 일괄 전송이 빠릅니다.";
      break;
    case "recovery": {
      const missing = missingPackets(state);
      evidence = `수신 ${state.count - missing.length}/${state.count} · 누락 ${missing.map((id) => `#${id}`).join(", ")} · 완전한 응답이 아님`;
      choices = [["retry-missing", "누락 조각만 재전송", `${missing.length}개 · 같은 연결 사용`],
        ["retry-all", "전체 조각 재전송", `${state.count}개 · 중복 조각도 다시 전송`],
        ["ignore", "받은 조각만으로 완료", "누락된 조각은 그대로 남음"],
        ["reroute", "경로를 다시 선택", "연결/TLS/전송을 다시 시작"]];
      hint = "이미 ACK된 조각은 다시 보낼 필요가 없습니다. 누락된 번호를 재전송하세요.";
      break;
    }
    default:
      evidence = state.feedback;
  }
  return { definition, title: phaseTitles[state.phase], evidence, hint,
    choices: choices.map(([id, label, detail]) => ({ id, label, detail })),
    score: state.phase === "complete" ? Math.max(10, 100 - state.faults * 15 - (state.hinted ? 20 : 0)) : 0,
  };
}

function missingPackets(state) {
  return Array.from({ length: state.count }, (_, i) => i + 1)
    .filter((id) => !state.packets.some((p) => p.id === id && p.status === "ack"));
}

export function useOperationHint(state) {
  if (state.hard || state.hinted || ["complete", "failed"].includes(state.phase)) return state;
  return { ...state, hinted: true };
}

export function takeDecision(previous, actionId) {
  const view = operationView(previous);
  if (!view.choices.some((a) => a.id === actionId)) throw new TypeError("Invalid operation decision");
  const state = structuredClone(previous), phase = state.phase;
  let trace, feedback = "", fault = false;
  const fail = (node, text, duration, description = text) => {
    fault = true; feedback = text;
    return createTrace([event(node, text, description, duration, true)]);
  };
  if (phase === "cache") {
    if (actionId === "fresh") {
      state.phase = "dns"; feedback = "새 응답을 받으려면 주소부터 확보해야 합니다.";
      trace = createTrace([event("browser", "응답 캐시를 건너뜁니다.", "최신 서버 응답을 요청합니다.", 5)]);
    } else if (state.cache === "none") trace = fail("browser", "저장된 응답이 없습니다.", 3);
    else if (state.cache === "stale" && state.id !== "offline-copy")
      trace = fail("browser", "오래된 응답은 이번 목표를 만족하지 않습니다.", 28, "저장된 자료는 표시할 수 있지만 최신 서버 응답이 필요합니다.");
    else {
      state.phase = "complete"; feedback = "저장된 자료를 열었습니다. 서버 통신은 생략했습니다.";
      trace = createTrace([event("browser", "저장된 응답 사용", "이번 저장본 열기 목표에 맞는 응답입니다.", 3),
        event("browser", "페이지 표시", "응답 캐시로 네트워크 단계를 생략했습니다.", 25)]);
    }
  } else if (phase === "dns") {
    if (state.id === "offline-copy") trace = fail("browser", "네트워크 경로가 모두 끊겼습니다.", 10, "DNS 캐시가 있어도 서버에 연결할 수 없습니다. 저장본 선택으로 돌아갑니다."), state.phase = "cache";
    else if (actionId === "dns-cache" && state.dnsCache !== "valid") trace = fail("dns", "유효한 DNS 캐시가 없습니다.", 2, "TTL 만료 또는 캐시 없음. 새 조회가 필요합니다.");
    else if (actionId === "primary" && state.primaryDns === "down") trace = fail("dns", "기본 리졸버 시간 초과", 120, "TCP/HTTP 전에 멈췄습니다. 대체 리졸버를 선택할 수 있습니다.");
    else {
      state.phase = "route"; feedback = "유효한 주소를 확보했습니다. 이제 경로를 선택하세요.";
      trace = createTrace([event(actionId === "dns-cache" ? "browser" : "dns", "IP 주소 확보",
        actionId === "dns-cache" ? "TTL이 남은 주소를 사용합니다. HTTP 응답 캐시는 아닙니다." : "리졸버가 사용 가능한 주소를 반환했습니다.",
        actionId === "dns-cache" ? 2 : actionId === "primary" ? 35 : 55)]);
    }
  } else if (phase === "route") {
    const route = state.routes.find((r) => r.id === actionId);
    trace = createRouteTrace(route);
    state.routeId = actionId;
    if (route.down) { fault = true; feedback = "SYN 응답이 없습니다. 가용 경로를 다시 선택하세요."; }
    else { state.phase = "tls"; feedback = "연결은 성공했습니다. 인증서 상태를 확인하세요."; }
  } else if (phase === "tls") {
    const route = state.routes.find((r) => r.id === state.routeId);
    if (actionId === "bypass") trace = fail("connection", "인증서 검증을 생략할 수 없습니다.", 5, "인증된 응답이라는 목표를 지켜야 합니다. 아직 HTTP 요청을 보내지 않았습니다.");
    else if (actionId === "verify" && state.certificate === "expired") trace = fail("connection", "TLS 검증 실패 · 인증서 만료", route.rtt);
    else {
      state.certificate = "valid"; state.authenticated = true; state.phase = "transport";
      feedback = "TLS 검증에 성공했습니다. 패킷 전송 방식을 고르세요.";
      trace = createTrace([event("connection", "TLS 검증 완료", actionId === "renew" ? "인증서를 갱신한 뒤 검증했습니다." : "유효한 인증서를 확인했습니다.",
        route.rtt + (actionId === "renew" ? 110 : 0))]);
    }
  } else if (phase === "transport" || phase === "recovery") {
    const route = state.routes.find((r) => r.id === state.routeId);
    if (actionId === "ignore") trace = fail("browser", "누락된 응답 조각이 남아 있습니다.", 5);
    else if (actionId === "reroute") {
      state.phase = "route"; state.authenticated = false; state.packets = [];
      trace = createTrace([event("connection", "연결을 닫고 경로 재선택", "새 연결에서 TLS와 응답 전송을 다시 진행합니다.", 20)]);
      feedback = "경로 선택으로 돌아왔습니다. 이전 수신 조각은 이번 연결에 재사용하지 않습니다.";
    } else {
      trace = transferPackets({ route, count: state.count, strategy: actionId, missing: missingPackets(state) });
      state.packets.push(...trace.packets);
      const missing = missingPackets(state);
      state.phase = missing.length ? "recovery" : "complete";
      feedback = missing.length ? `${missing.length}개 조각이 누락됐습니다. 기록의 번호를 보고 복구하세요.` : "인증된 응답 조각을 모두 받았습니다.";
      if (!missing.length) trace = createTrace([...trace.stages,
        event("browser", "응답 조립 · 페이지 표시", `${state.count}개 조각을 순서대로 조립했습니다.`, 25)]);
    }
  }
  state.attempts++; state.faults += fault ? 1 : 0; state.elapsed += trace.total;
  if (state.elapsed > state.budget || (state.attempts >= state.maxAttempts && state.phase !== "complete")) {
    state.phase = "failed";
    feedback = state.elapsed > state.budget ? "시간 예산을 넘었습니다. 경로와 전송 전략을 바꿔 다시 도전하세요." : "조치 예산을 모두 사용했습니다. 단서를 비교해 다시 도전하세요.";
  }
  state.feedback = feedback;
  state.history.push({ phase, actionId, label: view.choices.find((a) => a.id === actionId).label,
    before: previous.elapsed, after: state.elapsed, feedback, trace });
  return state;
}
