# 침식 프로토콜 — EROSION PROTOCOL

2인 협동 기지 방어 게임. three.js + 무료 MQTT 릴레이, 서버리스.

**플레이: https://q-erosion.pages.dev**

## 문서

- [게임 가이드](docs/GAME_GUIDE.md) — 조작, 규칙, 적 유형, 시너지, 아이템
- [설계·정책 문서](docs/GAME_DESIGN.md) — 밸런스 수치, 웨이브/맵/네트워킹 정책

## 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 로비 + 앱 셸 (PWA) |
| `game.js` | `<erosion-game>` 커스텀 엘리먼트 — 게임 전체 |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA |
| `design/` | claude.ai/design 원본 시안 스냅샷 |
| `docs/` | 게임 가이드·설계 문서 |

## 개발 · 배포

```bash
python3 -m http.server 8791   # 로컬: http://localhost:8791
```

`development` 브랜치에서 작업 → `production` 대상 PR → 병합 시 GitHub Actions가 Cloudflare Pages로 자동 배포.
