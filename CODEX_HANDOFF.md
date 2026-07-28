# Sydney Couple Travel Guide — Codex Handoff

> 기준일: 2026-07-28
>
> 기준 코드: `100ccc8` (`main`에 로컬 병합된 Task 6 결과)
>
> 현재 실행 기준 계획: `docs/superpowers/plans/2026-07-28-couple-travel-guide-continuation.md`

## 결론

- Phase 1의 13개 Task 중 Task 1~6이 완료됐다.
- 진행률은 Task 기준 `6 / 13 = 46.2%`, 남은 범위는 `7 / 13 = 53.8%`다.
- Task 4.5에서 UI 구조가 재설계됐으므로, 예전 Phase 1 계획의 Task 7~13 파일 경로를 그대로 실행하면 안 된다.
- 다음 작업은 새 연속 구현계획의 **Task 7: 실제 snapshot 연결·일정 편집·Today 실데이터화**다.
- GitHub Pages는 현재 UI 확인용 read-only preview다. 실제 공동 편집 production 배포는 Task 13의 Cloudflare 승인 gate 전에는 진행하지 않는다.

## 완료 상태

| 단계 | 상태 | 기준 commit | 핵심 결과 |
|---|---:|---|---|
| Task 1 | 완료 | `79d296b` | React·Vite·PWA shell과 디자인 토큰 |
| Task 2 | 완료 | `7b3ef4e` | Cloudflare Worker·D1 schema 기반 |
| Task 3 | 완료 | `47b26a5` | 관리자 Access JWT·파트너 세션 경계 |
| Task 4 | 완료 | `eae1289` | 10분 1회용 QR·링크 기기 연결 |
| Task 4.5 | 완료 | `c47f67f` | Trip Control UI 통합 재설계 |
| Task 5 | 완료 | `f1b51f1` | 여행 서재 CRUD·30일 휴지통·복구 |
| Task 6 | 완료 | `5f24c39`, `373222c`, `100ccc8` | snapshot·멱등 mutation·version conflict API |
| Task 7~13 | 미완료 | 새 연속 계획 참고 | 실제 여행 내부 기능·오프라인·QA·Cloudflare |

## Task 6 완료 검증 기준

- Frontend: 26 files, 294 tests 통과
- Worker: 5 files, 53 tests 통과
- `npm run typecheck` 통과
- Git 추적 소스 전체 ESLint 통과
- `npm run build` 통과
- `git diff --check` 통과
- Task 6 최종 review: Critical 0, Important 0
- 남은 Minor: snapshot read와 mutation read에 개인 데이터 privacy predicate가 중복돼 있다. 현재 동작 오류는 아니며 관련 모듈을 수정할 때 공통 helper로 합친다.

## 반드시 읽을 문서

1. `CODEX_HANDOFF.md`
2. `docs/superpowers/plans/2026-07-28-couple-travel-guide-continuation.md`
3. `docs/superpowers/specs/2026-07-28-trip-control-ui-integration-design.md`
4. `docs/superpowers/specs/2026-07-27-couple-travel-guide-phase-1-design.md`
5. `DESIGN.md`

`docs/superpowers/plans/2026-07-27-couple-travel-guide-phase-1.md`의 Task 1~6은 완료 이력과 API 계약 확인용이다. 해당 문서의 Task 7~13은 Task 4.5 이전 경로를 사용하므로 새 연속 계획이 우선한다.

## 로컬 PC에서 시작

기존 checkout이 깨끗할 때:

```bash
git switch main
git pull --ff-only origin main
npm ci
git status --short
```

예상 결과:

- `git status --short` 출력 없음
- Node.js 24 이상
- 다음 파일이 존재함:

```bash
test -f CODEX_HANDOFF.md
test -f docs/superpowers/plans/2026-07-28-couple-travel-guide-continuation.md
```

기준 검사:

```bash
npm test
npm run test:worker
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Windows PowerShell에서는 마지막 명령만 다음처럼 실행한다.

```powershell
$env:XDG_CONFIG_HOME=".tmp/wrangler"
npm run build
```

## Codex에 바로 입력할 시작 명령

```text
CODEX_HANDOFF.md와 docs/superpowers/plans/2026-07-28-couple-travel-guide-continuation.md를 전부 읽고,
새 연속 계획의 Task 7만 TDD로 구현해.
기존 src/pages/today, src/pages/schedule, src/pages/map, src/pages/tools UI를 재사용하고
옛 Phase 1 계획의 src/features/schedule 페이지 구조는 새로 만들지 마.
Task 7 검증이 모두 통과하면 commit까지만 하고 결과를 보고해.
push, merge, production deploy는 내 승인 전 실행하지 마.
```

## 작업 규칙

- 한 번에 Task 하나만 구현한다.
- 각 Task는 test-first로 진행하고 검증 성공 후 commit한다.
- 현재 재설계된 4-tab 구조 `today | schedule | map | tools`를 유지한다.
- 새 독립 페이지를 늘리지 말고 기존 `src/pages/*` 화면에 실제 데이터와 편집 기능을 연결한다.
- GitHub Pages에서는 fixture 기반 read-only preview를 유지한다.
- 로컬·Cloudflare 실행에서만 실제 API와 D1을 사용한다.
- 비밀값, 이메일, Cloudflare 계정값, 실제 세션값을 Git에 기록하지 않는다.
- Task 13 전에는 Cloudflare 리소스 생성, production migration, production deploy를 실행하지 않는다.
- Task 13에서도 실제 host·관리자 이메일·계정·D1 입력과 배포는 사용자 승인 후 진행한다.

## 남은 Task와 추천 모델

| 묶음 | 작업 | 추천 모델·추론 | 이유 |
|---|---|---|---|
| A | Task 7~10 | GPT-5.6 Sol · High | 기존 UI와 snapshot/mutation 계약을 함께 다루는 복합 구현 |
| B | Task 11 | GPT-5.6 Sol · XHigh | IndexedDB·재전송·충돌·세션 폐기 등 상태 일관성이 핵심 |
| C | Task 12 | GPT-5.6 Sol · High | 개인정보 제외, legacy parser, SQL 재현성 검증 필요 |
| D | Task 13 | GPT-5.6 Sol · XHigh | E2E·실기기·Cloudflare 전환 및 배포 gate 판단 필요 |

## 남은 범위

1. Task 7: 실제 snapshot 연결, 일정 편집, Today 실데이터 selector
2. Task 8: 장소 CRUD, MapLibre 온라인 지도, 오프라인 목록, 커플 투표
3. Task 9: 예약 CRUD, 예약번호 보호, Today·일정 연결
4. Task 10: 준비물, 메모, 통합 검색, 활동 기록
5. Task 11: IndexedDB cache/outbox, 15초 sync, 충돌 선택
6. Task 12: 로컬 AI launcher, 환율, 기존 시드니 데이터 import
7. Task 13: 통합 E2E, 실기기 QA, 승인 후 Cloudflare production 전환
