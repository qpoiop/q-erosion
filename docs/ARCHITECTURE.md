# 침식 프로토콜 — 아키텍처 & 구현 방식

## 스택
- 정적 사이트: `index.html`(로비/SW 등록) + `src/*.js` ES 모듈, three.js r147(UMD/unpkg), MQTT.js(폴백)
- 배포: GitHub Actions → Cloudflare Pages (prod `q-erosion` / dev `q-erosion-dev`), 릴레이는 Workers+Durable Objects
- PWA: 앱 셸 network-first, 에셋 cache-first, CI가 sw.js·index.html에 빌드 SHA 스탬프 → 업데이트 토스트 + 로비 빌드 표기

## 모듈 구조 (prototype-install 패턴)
커스텀 엘리먼트 `<erosion-game>` 하나에 기능 모듈이 메서드를 설치한다.
`export function install(P) { P._method = ... }` — main.js가 순서대로 설치.

| 모듈 | 책임 |
|---|---|
| util.js | 모든 상수·데이터 테이블의 단일 출처: UPG(증강)/SYN(시너지)/SHOP(연구)/ETYPES(적)/DIFF*(난이도)/MODELS(GLB 매니페스트)/CAP_*/PV |
| main.js | 수명주기, 틱 오케스트레이션(페이즈 분기·일시정지 소스), RAF+워치독 |
| world.js | 그리드(N=32, TS=2)·flow field(Dial 버킷 Dijkstra)·건설/판매/소유(own[])·저장/로드 |
| waves.js | 웨이브 구성·스폰·적 AI(분리·기회공격)·보스 티어·탈출/침투(맵2)·게임오버/엔딩 |
| combat.js | 플레이어 사격(사거리/탄수명)·피해 판정(관통 1회타격/감쇠)·XP/카드/시너지 등급·스킬 |
| scene.js | three.js 씬·모델 메시(_eMesh/_sMesh)·렌더 루프·파티클 풀·성능 거버너 |
| models.js | GLB 로딩(_mergeStatic로 정적 병합, _normalize로 풋프린트 정규화)·코어 교체·x-ray 실루엣 |
| hud.js | HUD 셸·배너·난이도 태그·미니맵·프레임 갱신 |
| sheets.js | 모달: 연구 상점·증강 카드·인벤토리·보유증강 시트 |
| input.js | 포인터/키보드/가상 스틱·타일 픽킹·건설 배치 |
| net.js | 전송(릴레이 우선+MQTT 폴백+매치메이킹 이중화)·메시지 프로토콜·상태 동기화 |

## 데이터 주도 설계
증강/시너지/연구/적/난이도는 전부 util.js의 선언형 테이블. 효과는 `f(player, game)` 순수 함수,
시너지는 `grade(p, g, gr)` 훅(등급 도달마다 1회). 신규 컨텐츠 = 테이블 행 추가로 끝나는 구조.

## 넷코드 (호스트 권위)
- 호스트가 스폰/AI/피해/자원/웨이브 전환을 소유. 조이너는 자기 입력·사격만 로컬, 결과는 패킷으로 수신
- 패킷: pose(0.09s, 샷·히트 배치 동승) / state(적응 0.13~0.26s: 평탄 en·연구 hr·통계 ss,as·게이트 gts·ebq) / struct(1.4s, stride-5 평탄)
- 이벤트성 메시지는 전부 큐→틱 플러시 원칙(shotQ/hitQ/ebQ) — 발생당 1메시지 금지
- 프로토콜 버전(PV): 와이어 포맷 변경 시 범프, hello/welcome에서 불일치 배너
- 재접속: welcome이 연구(ar)/구매수(abuys)/웨이브(wv)/구조물 전체를 복원. restart는 게임오버 화면에서만 유효
- 전송: DO 릴레이 우선(과금 방어: 2소켓 캡·60msg/s·8KB·TTL 알람) → MQTT 폴백 + 4초 릴레이 복귀 재시도, 매치메이킹 중엔 보조 MQTT 병행(스플릿브레인 원천 차단)

## 렌더 원칙
- 조명·머티리얼은 초기화 시 고정 — 런타임에 라이트 추가/제거 금지(셰이더 전체 재컴파일 유발)
- 파티클(링/스파크)·탄환 메시는 풀 + 상한, 인트로 뒤 _warmFx로 머티리얼 선컴파일
- 잡몹 그림자 없음(보스/플레이어/구조물만), 유휴 시 절반 렌더, 지속 34ms 초과 시 거버너가 블룸/그림자/해상도 감량
