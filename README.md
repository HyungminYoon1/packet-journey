# PACKET JOURNEY — 연결을 복구하라

네트워크 요청을 관찰하고, 단서를 해석하고, 적절한 조치를 선택하는 6개 미션과 자유 실험입니다.

- [사이트](https://hyungminyoon1.github.io/packet-journey/)
- [저장소](https://github.com/HyungminYoon1/packet-journey)

## 6개의 사건

1. **사라진 주소**: DNS 실패에서 연결이 시작되지 않은 이유를 찾습니다.
2. **연결 뒤의 오류**: HTTP 500 응답과 연결 실패를 구분합니다.
3. **끊어진 연결**: DNS 캐시만으로 인터넷 연결을 복구할 수 없음을 확인합니다.
4. **오프라인의 역설**: 최신 페이지 캐시를 비워 네트워크 없이 열린 이유를 검증합니다.
5. **기억된 주소**: 유효한 DNS 캐시를 비워 조회 실패가 가려진 이유를 확인합니다.
6. **가장 짧은 여행**: DNS 캐시와 최신 페이지 응답 캐시가 생략하는 단계를 비교합니다.

먼저 요청을 끝까지 조사해야 조치를 선택할 수 있습니다. 오답은 이유를 설명하며 조건을 바꾸지 않습니다. 정답을 선택하면 조건을 바꿔 재생하고 전후의 단계 수·시간·결과를 비교합니다. 캐시 제거 사건에서는 요청 실패를 드러내는 것이 학습 목표이지 연결 복구가 아닙니다.

사건별 100점에서 오답당 15점, 힌트 사용 시 20점을 차감하며 최저 10점입니다. 이번 세션에서 사건별 최고 점수만 합산합니다. 언제든 다른 사건으로 이동하거나 다시 풀 수 있고, 전역 순위나 사용자 능력 판정을 하지 않습니다.

## 자유 실험

기존 캐시·상황·왕복 지연·재생 속도 설정을 유지합니다. 자동 재생·일시정지·한 단계씩·재시작, 요청 기록과 DNS/TCP/TLS/HTTP/캐시 설명을 지원합니다.

- 정상 첫 요청: 브라우저 → DNS → TCP → TLS → HTTP 요청/응답 → 렌더링
- 유효한 DNS 캐시: 주소 조회만 생략; 연결과 HTTP 요청 필요
- 최신 페이지 응답 캐시: 서버 재검증 없이 사용할 수 있는 응답을 전제로 네트워크 전체 생략
- DNS 실패: TCP와 HTTP 전에 중단
- HTTP 500: 연결 이후 받은 서버 오류 응답
- 오프라인: 페이지 캐시가 없으면 브라우저 단계에서 중단

## 모델의 범위

HTTPS over TCP를 단순화했습니다. 지도는 처리 단계 표시이지 실제 물리적 패킷 경로가 아닙니다. 실제 웹사이트 호출·DNS 조회·서버 진단·기기 설정 변경은 없습니다. 주소창처럼 보이던 사용하지 않는 example 주소와 반복적인 전면 주의 문구는 제거했습니다. ‘시뮬레이션’ 표시와 펼쳐보는 원리 설명으로 범위를 구분합니다.

주소/캐시 확인·렌더링과 서버 처리 시간을 정해 두고, DNS·TCP·TLS에 각각 왕복 지연을 적용하는 비교 모델입니다. 기본 정상 요청 390 ms, DNS 캐시 312 ms, 최신 페이지 캐시 33 ms입니다. 재생 속도는 애니메이션 속도일 뿐 모델 시간과 별개입니다. 연결 재사용·재귀 DNS·CDN·HTTP/3·병렬 리소스·만료·재검증은 생략합니다.

## 실행·검증·배포

Node.js 22 이상, 패키지 설치 없이 실행합니다.

```sh
git clone https://github.com/HyungminYoon1/packet-journey.git
cd packet-journey
npm run dev -- 0
npm test
npm run check
```

출력된 Local 주소를 엽니다. 0은 임시 포트를 자동 선택합니다. 14개의 테스트는 요청 모델 조합, 사건별 조치와 감점, 캐시 제거 전후, 잘못된 입력을 확인합니다. [검증 기록](docs/verification.md)에 로컬 테스트·실제 브라우저·원격 CI·공개 배포를 구분합니다.

Pages Source는 GitHub Actions입니다. main 푸시 후 테스트·정적 검사 통과 시 dist만 배포하며 모든 자산은 상대 경로입니다.

## 데이터와 참고 자료

점수와 입력은 페이지 메모리에만 남고 새로고침하면 사라집니다. 서버·계정·외부 API·분석 도구·영구 저장·외부 글꼴은 없습니다. GitHub 호스팅 자체 로그는 별개입니다. AI 에이전트와 함께 제작한 학습 프로젝트입니다.

- [구조](architecture.md) · [결정 기록](docs/decisions.md)
- [MDN 인터넷의 동작](https://developer.mozilla.org/ko/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work)
- [MDN HTTP 개요](https://developer.mozilla.org/ko/docs/Web/HTTP/Guides/Overview)
- [MDN HTTP 캐싱](https://developer.mozilla.org/ko/docs/Web/HTTP/Guides/Caching)

UTF-8 without BOM / CRLF. 라이선스는 아직 별도로 부여하지 않았습니다.
