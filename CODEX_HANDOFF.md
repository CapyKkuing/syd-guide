# 우리만의 여행 가이드북 — Codex Handoff

> 기준일: 2026-07-30
>
> Task 20 전 기준 코드: `488ab16`
>
> 현재 작업 브랜치: `agent/final-travel-guide-spec`

## 결론

- Task 14~19 구현과 Task 20 자동 회귀 검증이 이 브랜치에 완료돼 있다.
- 제품명은 **우리만의 여행 가이드북**이다.
- 항공편은 외부 API 없이 사용자가 직접 입력하며, 출국 예정 출발과 귀국 예정 도착을 여정 경계로 사용한다.
- 여행 사진 원본은 Google Drive에 두고, 앱에는 허용된 메타데이터와 기기 내 미리보기만 저장한다.
- 추억 릴은 사진 전용·무음이며 자동 최대 2분, 편집 최대 3분이다.
- 남은 Task 20 항목은 배포 후 실제 Android·iPhone PWA 설치 검수다.
- production migration·push·merge·deploy는 사용자 승인 전 실행하지 않는다.

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
| Task 14 | 구현됨 | 수동 항공편·여정 경계 |
| Task 15 | 구현됨 | 여행 전·중·후 Today 홈 |
| Task 16 | 구현됨 | 정보 신뢰도·지도 offline fallback |
| Task 17 | 구현됨 | Google Drive 사진·기기 내 AI·대표 사진 |
| Task 18 | 구현됨 | 사진 전용 2분/3분 릴 편집 |
| Task 19 | 구현됨 | 무음 세로 사진 릴 player |
| Task 20 자동검증 | 완료 | 앱 385·Worker 59·E2E 24 통과 |
| Task 20 실기기 QA | 대기 | 배포 후 Android·iPhone PWA 설치 검수 |

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

## 다음 작업

```text
CODEX_HANDOFF.md와 docs/qa/phase-1-manual-checklist.md를 읽어.
현재 브랜치의 전체 검증 상태를 확인한 뒤, 사용자 승인 없이는 push·merge·production
migration·deploy를 실행하지 마. 배포 승인을 받으면 production 설정을 검증하고
배포한 다음 실제 Android·iPhone에서 PWA 설치·standalone·offline 동작을 확인해.
```

## 작업 규칙

- 한 번에 승인받은 작업 하나만 진행한다.
- 변경은 실패 test → 최소 구현 → 관련 검사 → typecheck·lint → commit 순서로 진행한다.
- 기존 기능과 경쟁하는 새 페이지를 만들지 않는다.
- 개인 데이터 privacy, 예약번호 마스킹, version conflict 처리를 약화하지 않는다.
- 사진 원본은 공개 URL을 사용하지 않는다.
- 미디어 라이선스를 확인하지 않은 음원 파일은 저장소에 추가하지 않는다.
- 자동검증과 실기기 QA를 구분해 보고한다.
