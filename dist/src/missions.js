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
