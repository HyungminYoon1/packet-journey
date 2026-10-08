# PACKET JOURNEY

주소를 입력한 순간부터 웹페이지가 나타날 때까지의 과정을 시각적으로 따라가는 교육용 네트워크 시뮬레이터입니다. 실제 웹사이트를 호출하거나 네트워크 상태를 진단하지 않습니다.

- 사이트: [PACKET JOURNEY](https://hyungminyoon1.github.io/packet-journey/)
- 저장소: [HyungminYoon1/packet-journey](https://github.com/HyungminYoon1/packet-journey)

## 직접 바꿔볼 수 있는 것

- 자동 재생·일시정지·한 단계씩 진행·재시작
- 캐시 없음 / 유효한 DNS 캐시 / 재검증 없이 사용할 수 있는 최신 페이지 캐시
- 정상 요청 / DNS 조회 실패 / HTTP 500 응답 / 오프라인
- 왕복 지연 가정(20–300 ms)과 재생 속도
- 현재 단계 강조, 누적 모델 시간, 단계별 여행 기록, DNS·TCP/TLS·HTTP·캐시 설명

첫 방문의 정상 흐름은 **브라우저 확인 → DNS 조회 → TCP 연결 → TLS 준비 → HTTP 요청 → HTTP 응답 → 렌더링**입니다.

DNS 캐시는 브라우저 쪽에서 주소를 재사용하므로 DNS 서버를 거치지 않지만, HTTP 요청은 필요합니다. 최신 페이지 캐시는 네트워크 전체를 생략하므로 이 모델에서는 오프라인이나 DNS 오류에서도 페이지를 표시합니다. HTTP 500은 연결 이후 서버에서 받은 오류 응답으로 DNS 실패와 구분됩니다.

## 모델의 가정과 한계

HTTPS over TCP를 단순화했습니다. 연결 재사용, DNS의 내부 재귀 조회, 병렬 리소스 요청, CDN, HTTP/3의 QUIC, 캐시 만료와 재검증, 서비스 워커 등은 생략합니다. 모든 시간은 설명을 위한 가정값입니다.

- 주소 확인 5 ms, 캐시 조회 2–3 ms, 렌더링 25 ms
- DNS·TCP·TLS는 각각 왕복 지연 한 번을 가정
- HTTP 요청/응답의 전송은 각 왕복 지연의 절반, 서버 처리 40 ms
- 기본 정상 요청: 390 ms / DNS 캐시: 312 ms / 최신 페이지 캐시: 33 ms
- 재생 속도는 읽기 위한 애니메이션 속도이며 모델 시간과 별개

지도 위 점은 실제 패킷이 아니라 **현재 단계**를 표시합니다. museum.example은 교육용 가상 주소이며 실제로 접속하지 않습니다. 모델 값으로 실제 성능이나 장애 원인을 판단하면 안 됩니다.

## 실행과 검증

Node.js 22 이상에서 패키지 설치 없이 실행합니다.

```sh
git clone https://github.com/HyungminYoon1/packet-journey.git
cd packet-journey
npm run dev -- 0
npm test
npm run check
```

출력된 Local 주소에서 확인합니다. 0은 사용 가능한 포트를 자동 선택합니다. 9개 모델 테스트와 정적 자산·문법 검사를 제공합니다. 로컬 검증·원격 CI·실제 배포 확인은 [검증 기록](docs/verification.md)에서 구분합니다.

## 배포·데이터·구조

Pages의 Source는 GitHub Actions이며, main 푸시 후 테스트 통과 시 dist만 배포합니다. 상대 자산 경로로 프로젝트 Pages URL을 지원합니다.

입력과 여행 상태는 페이지 메모리에만 존재합니다. 서버·계정·분석 도구·외부 API·영구 저장·외부 글꼴은 없습니다. GitHub의 호스팅 자체 로그는 별개입니다. AI 에이전트의 도움으로 제작하고 배포한 실험적 학습 프로젝트입니다.

- [구조](architecture.md)
- [결정 기록](docs/decisions.md)
- [MDN 인터넷은 어떻게 동작하는가?](https://developer.mozilla.org/ko/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work)
- [MDN HTTP 개요](https://developer.mozilla.org/ko/docs/Web/HTTP/Overview)
- [MDN HTTP 캐싱](https://developer.mozilla.org/ko/docs/Web/HTTP/Caching)

텍스트는 UTF-8 without BOM / CRLF를 사용합니다. 라이선스는 아직 별도로 부여하지 않았습니다.
