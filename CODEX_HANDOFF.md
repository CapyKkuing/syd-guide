# 우리만의 여행 가이드북 — Codex Handoff

> 기준일: 2026-07-29
>
> 기준 코드: `eced04f` (`main`, 기존 Phase 1 Task 1~13 구현)
>
> 현재 작업 브랜치: `agent/final-travel-guide-spec`

## 결론

- 기존 Phase 1 Task 1~13 코드는 `main`에 구현돼 있다.
- 사용자가 승인한 최종 제품명은 **우리만의 여행 가이드북**이다.
- 최종 제품 설계와 후속 구현계획은 이번 브랜치에 추가했다.
- 다음 구현은 새 계획의 **Task 14: Product Name Guard and Journey Phase Model**부터 시작한다.
- 기존 Task 7~13 계획은 구현 이력 확인용이며 다시 실행하지 않는다.
- private R2 생성, production migration·deploy는 사용자 승인 전 실행하지 않는다.

## 반드시 읽을 문서

1. `CODEX_HANDOFF.md`
2. `docs/superpowers/specs/2026-07-29-final-product-design.md`
3. `docs/superpowers/plans/2026-07-29-final-product-experience.md`
4. `docs/superpowers/specs/2026-07-28-trip-control-ui-integration-design.md`
5. `DESIGN.md`

우선순위:

```text
2026-07-29 최종 제품 설계
  > 2026-07-28 Trip Control 통합 설계
  > 2026-07-27 Phase 1 설계
```

## 구현 완료 기준

| 범위 | 상태 | 기준 |
|---|---:|---|
| 기존 Task 1~13 | 구현됨 | `eced04f` |
| 최종 제품명 반영 | 설계 브랜치 반영 | `우리만의 여행 가이드북` |
| Task 14 | 미구현 | 여정 경계시각·단계 계산 |
| Task 15 | 미구현 | 여행 전·중·후 Today 홈 |
| Task 16 | 미구현 | 정보 신뢰도·지도 offline fallback |
| Task 17 | 미구현 | private 미디어·대표 사진 |
| Task 18 | 미구현 | 2분/3분 추억 쇼츠 편집 |
| Task 19 | 미구현 | 세로 player·라이선스 음악 |
| Task 20 | 미구현 | 전체 E2E·실기기 QA |

## 로컬 PC에서 시작

```bash
git fetch origin
git switch agent/final-travel-guide-spec
git pull --ff-only origin agent/final-travel-guide-spec
npm ci
git status --short
```

Node.js 24 이상을 사용한다.

기준 검사:

```bash
npm test
npm run test:worker
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Windows PowerShell에서는 build를 다음처럼 실행한다.

```powershell
$env:XDG_CONFIG_HOME=".tmp/wrangler"
npm run build
```

## Codex에 바로 입력할 시작 명령

```text
CODEX_HANDOFF.md,
docs/superpowers/specs/2026-07-29-final-product-design.md,
docs/superpowers/plans/2026-07-29-final-product-experience.md를 전부 읽어.

superpowers:executing-plans 절차로 계획을 검토한 뒤 Task 14만 TDD로 구현해.
기존 Task 1~13 기능과 4-tab 구조는 유지하고, 관련 검사와 전체 typecheck·lint가 통과하면 commit까지만 해.
push, merge, Cloudflare R2 생성, production migration, deploy는 내 승인 전 실행하지 마.
```

## 작업 규칙

- 한 번에 Task 하나만 구현한다.
- 각 Task는 실패 test → 최소 구현 → 관련 검사 → typecheck·lint → commit 순서로 진행한다.
- 기존 기능과 경쟁하는 새 페이지를 만들지 않는다.
- 개인 데이터 privacy, 예약번호 마스킹, version conflict 처리를 약화하지 않는다.
- private media는 공개 URL을 사용하지 않는다.
- 미디어 라이선스를 확인하지 않은 음원 파일은 저장소에 추가하지 않는다.
- Task 20 전에는 최종 완료라고 보고하지 않는다.
- 자동검증과 실기기 QA를 구분해 보고한다.
