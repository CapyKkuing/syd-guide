# PWA 오프라인 cold start 수정 — Codex Handoff

> 작성일: 2026-07-30
>
> 저장소: `CapyKkuing/syd-guide`
>
> 기준 브랜치: `main`
>
> 기능 수정 커밋: `f3dc80b` (`fix: allow offline read-only cold start`)
>
> 운영 주소: `https://couple-travel-guide.yeonuunim521.workers.dev`

## 결론

- 삼성 인터넷에 설치한 PWA에서 오프라인 재실행 시 `TypeError: Failed to fetch`가 노출되던 문제를 수정했다.
- 원인은 service worker 자체가 아니라, 저장된 여행 snapshot은 있지만 오프라인 principal(사용자 신원) 캐시가 없는 이전 설치 상태였다.
- 이 조건에서는 저장 snapshot을 익명 `offline-readonly` 모드로 열어 일정·예약·메모 등을 조회할 수 있다.
- principal이 복구되기 전에는 사용자 신원이 필요한 수정, 사진 연결·업로드, 기기 관리 기능을 비활성화한다.
- owner를 임의 추정하지 않으므로 파트너 기기에서 개인 데이터의 작성 주체나 권한이 잘못 적용되지 않는다.
- 온라인 snapshot 요청이 성공했는데 principal만 실패하면 기존 인증 오류를 유지한다. 인증 문제를 오프라인 fallback으로 숨기지 않는다.
- 수정본은 GitHub `main`과 Cloudflare Worker에 배포됐다.

## 재현 조건과 원인

```text
기존 설치 PWA 실행
→ IndexedDB에 여행 snapshot은 존재
→ 저장된 principal은 없음
→ 오프라인에서 /api/session 요청 실패
→ loadPrincipal()이 원래 네트워크 오류를 재전파
→ 화면에 TypeError: Failed to fetch 노출
```

기존 회귀 테스트는 `snapshot + principal`이 모두 저장된 정상 오프라인 상태만 검사해 이 조합을 놓쳤다.

## 수정 동작

```text
snapshot 요청 실패 + 사용 가능한 durable snapshot 존재
├─ principal 존재 → 기존 사용자 권한으로 오프라인 진입
└─ principal 없음 → offline-readonly로 안전하게 진입

snapshot 요청 성공 + principal 실패
└─ 인증 오류 유지
```

`offline-readonly`에서는 읽기만 허용한다. 사용자 신원이 필요한 제어를 활성화하거나 임의의 member ID를 넣으면 안 된다.

## 변경 파일

| 파일 | 역할 |
|---|---|
| `src/data/api/snapshotDataSource.ts` | principal 오류와 snapshot 오류를 분리하고 안전한 fallback 결정 |
| `src/data/api/snapshotDataSource.test.ts` | snapshot만 있고 principal이 없는 오프라인 회귀 테스트 |
| `src/data/api/snapshotMappers.ts` | principal 없는 workspace를 `offline-readonly`로 매핑 |
| `src/data/api/snapshotMappers.test.ts` | 새 viewer access 계약 검증 |
| `src/data/contracts.ts` | `full \| offline-readonly` 접근 모드 계약 |
| `src/data/fixture/fixtureDataSource.ts` | fixture viewer access 계약 반영 |
| `src/app/TripRoutePage.tsx` | 수정·사진·기기 관리 등 신원 의존 기능 비활성화 |
| `src/app/TripRoutePage.test.tsx` | 읽기 전용 화면 제어 회귀 테스트 |

## 검증 결과

기능 수정 커밋 `f3dc80b` 기준:

| 검사 | 결과 |
|---|---:|
| 앱 테스트 | 387/387 통과 |
| Worker 테스트 | 59/59 통과 |
| TypeScript typecheck | 통과 |
| ESLint | 통과 |
| production PWA build | 성공 |
| PWA precache | 17개 항목, 약 2.30 MiB |

기존 bundle size 500 kB 초과 안내와 실행환경 proxy 안내 외에 이번 변경으로 추가된 오류는 없다.

## GitHub·배포 상태

| 항목 | 값 |
|---|---|
| GitHub `main` | `f3dc80b3711b010ce302fca63c248404a6d35d57` |
| Cloudflare Version ID | `63ec8c5f-1924-424f-8cf7-18f83dbb7a13` |
| 배포된 새 번들 | `index-CodNF50A.js` |
| 서버 코드 표식 | `offline-readonly` 포함 확인 |

Wrangler 배포 결과:

```text
Uploaded couple-travel-guide
Deployed couple-travel-guide triggers
https://couple-travel-guide.yeonuunim521.workers.dev
Current Version ID: 63ec8c5f-1924-424f-8cf7-18f83dbb7a13
```

## 다음 Codex가 시작할 때

```bash
git fetch origin
git switch main
git pull --ff-only
git status --short
git log -3 --oneline
```

1. 이 문서를 먼저 읽는다.
2. `main`에 기능 수정 커밋 `f3dc80b`과 이 핸드오프 커밋이 포함됐는지 확인한다.
3. 같은 원인 분석이나 수정 구현을 반복하지 않는다.
4. 실기기 결과가 정상이라면 코드 변경 없이 이 이슈를 종료한다.
5. 오류가 남아 있으면 먼저 설치 PWA가 새 service worker와 `index-CodNF50A.js`를 쓰는지 확인한 뒤 새 증거를 수집한다.

## 남은 실기기 확인

서버 배포와 새 번들 존재는 확인됐다. 설치 PWA는 이전 service worker 캐시를 유지할 수 있으므로 아래 순서로 갱신한다.

1. 설치 앱을 최근 앱 목록에서 완전히 종료한다.
2. 삼성 인터넷 일반 탭에서 운영 주소를 온라인으로 연다.
3. 정상 화면이 뜬 뒤 새로고침 1회하고 삼성 인터넷을 종료한다.
4. 설치 앱을 다시 열어 온라인 로딩을 확인한다.
5. 비행기 모드에서 앱을 완전히 종료·재실행한다.
6. 저장된 여행이 열리고 신원 의존 기능이 읽기 전용인지 확인한다.

주의: 문제 재현만으로 앱 삭제나 사이트 데이터 초기화를 먼저 하지 않는다. IndexedDB의 여행 snapshot까지 삭제될 수 있다.

## 현재 문서 기준

- 현재 핸드오프는 이 파일 1개다.
- `docs/superpowers/plans/*`와 `docs/superpowers/specs/*`는 구현 이력 및 제품 설계 기록이며 핸드오프가 아니다.
- 전체 제품 기준은 `docs/superpowers/specs/2026-07-29-final-product-design.md`를 따른다.
