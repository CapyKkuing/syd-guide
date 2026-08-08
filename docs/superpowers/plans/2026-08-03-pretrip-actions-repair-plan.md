# 여행 전 준비 바로가기·관리자 복구 수정계획

> 상태: 2026-08-03 로컬 구현·대상 테스트·Android/iPhone 모바일 화면 검증 완료. 커밋·푸시·운영 migration·배포는 미승인.
> 기준 계획: `docs/superpowers/plans/2026-08-03-v1-completion-plan.md`

## 목표

여행 전 `오늘` 화면의 준비 항목을 누르면 목적에 맞는 입력 화면이 바로 열리게 하고,
관리자 화면의 `Failed to fetch`를 Access 로그인 복구 화면으로 일관되게 처리한다.
빈 체크리스트에는 사용자가 수정 가능한 기본 준비 항목을 제공한다.

## 기존 계획과의 대조

기존 V1 계획의 Phase 1C·1D에는 예약·체크리스트·관리 화면을 연다는 넓은 회귀 기준만 있다.
다음의 구체적인 사용자 흐름과 빈 상태 초기화 규칙은 명시되어 있지 않아 이 계획으로 추가한다.

| ID | 현재 동작 | 승인 후 목표 동작 |
|---|---|---|
| GAP-19 | `항공편 확인`이 `/library`만 열어 여행 서재로 돌아간다. | 해당 여행의 편집 창을 열고 항공편 입력 영역을 바로 보여 준다. |
| GAP-20 | `숙소 예약`은 예약 목록만 열거나 일반 `예약 추가`를 열며, 긴 폼이 화면을 넘긴다. | `예약 추가` 창을 바로 열고 예약 종류를 `숙소`로 미리 선택한다. 시트는 가로 넘침 없이 세로로 스크롤된다. |
| GAP-21 | `여권 확인`은 체크리스트 목록으로만 이동한다. | 여권 항목의 추가 또는 수정 창을 바로 열고 `필수 준비 / 여권`을 미리 선택한다. |
| GAP-22 | 새·빈 체크리스트는 모든 카테고리가 비어 있다. | 승인한 기본 템플릿을 넣고, 이후 체크·추가·수정·삭제를 모두 허용한다. |
| GAP-23 | 관리자 Access 세션 문제에서 일부 화면이 원문 `Failed to fetch`를 표시할 수 있다. | 관리자 API와 여행 snapshot 요청에서 Access 만료를 감지해 `관리자 다시 로그인`과 원래 주소 복귀를 제공한다. |

## 구현 방향

### 1. URL 기반 준비 액션

상태만으로 창을 열지 않고 URL에 안전한 일회성 액션을 둔다. 새로고침, PWA 재실행,
Access 재로그인 후에도 원래 목적을 잃지 않기 위해서다.

- 항공편: `/library?edit=<tripId>&focus=flights`
- 숙소 예약: `/trip/<tripId>/tools/bookings?action=create-lodging`
- 여권: `/trip/<tripId>/tools/checklist?action=edit-passport`

액션을 처리해 시트가 열리면, URL에서는 액션 파라미터만 제거한다. 이로써 뒤로 가기와
새로고침이 같은 창을 반복해서 열지 않는다.

### 2. 예약 입력 시트

- `BookingEditorDialog`에 초기 예약 종류를 전달한다.
- 숙소 바로가기는 `lodging`으로 시작한다. 사용자는 다른 종류로 바꿀 수 있다.
- 공통 `BottomSheet`의 가로 넘침 원인을 고친다. 시트·폼·입력 요소의 최소 너비를
  부모 폭 안으로 제한하고, 320·390·786px에서 세로 스크롤만 허용한다.
- 이 수정은 모든 BottomSheet에 영향을 주므로 예약, 비용, 일정, 장소 편집 시트를 함께 회귀 확인한다.

### 3. 항공편과 여권 바로가기

- 항공편은 기존 `TripForm`을 재사용하고 항공편 영역으로 키보드 초점과 화면 위치를 이동한다.
- 여권은 기존 체크리스트 생성 폼을 재사용한다. 기존 미완료 여권 항목이 있으면 그 항목을 수정하고,
  없으면 새 항목 생성 폼을 연다.
- 항공편·여권 값은 자동 완료하지 않는다. 사용자가 입력·저장·체크해야 한다.

### 4. 기본 체크리스트

초기 데이터 삽입 규칙과 항목은 2026-08-03 승인됐다.

- 신규 여행에는 한 번만 기본 항목을 만든다.
- 기존 여행은 체크리스트가 완전히 비어 있을 때만 한 번 생성한다.
- 이후 항목은 사용자가 자유롭게 체크·추가·수정·삭제한다.
- 기존 여행용 migration은 체크리스트가 비어 있는 여행만 한 번 처리한다. 사용자가 나중에
  항목을 삭제해도 migration이 다시 실행되지 않으므로 자동 재생성되지 않는다.

승인된 기본 항목:

- 필수 준비: 참여자별 여권, 해외 결제수단, 여행자 보험·긴급 연락처 확인
- 예약·바우처: 항공권 확인, 숙소 예약 확인
- 개인 짐: 충전기, eSIM·로밍
- 여행 중: 매일 비용 정리

### 5. 관리자 `Failed to fetch`

- `PairingManager`, `ParticipantSetupGate`, 여행 snapshot 로더의 관리자 요청을 같은 Access 오류 분류로 처리한다.
- 네트워크·오프라인 오류와 Access 만료를 구별한다.
- Access 만료면 현재 경로를 `continue` 값으로 보존한 재로그인 버튼을 제공한다.
- 로그인 완료 후 참여자·초대·기기 관리 또는 기존 여행 화면으로 되돌아오는 회귀 테스트를 추가한다.

## 예상 수정 파일

- `src/app/router.tsx`, `src/pages/today/BeforeTripHome.tsx`, `src/pages/today/homeSelectors.ts`
- `src/features/trips/LibraryPage.tsx`, `src/features/trips/TripForm.tsx`
- `src/pages/tools/bookings/BookingsPanel.tsx`, `src/pages/tools/bookings/BookingEditorDialog.tsx`
- `src/pages/tools/checklist/ChecklistPanel.tsx` 및 체크리스트 초기화가 필요한 데이터·mutation 파일
- `src/components/BottomSheet.tsx`, `src/styles/components.css`, 관련 도구 스타일
- `src/features/auth/PairingManager.tsx`, `src/features/auth/ParticipantSetup.tsx`, `src/data/api/snapshotDataSource.ts`
- 관련 단위·통합·모바일 E2E 테스트

정확한 체크리스트 저장 방식이 기존 데이터 모델로 충분한지 확인한 후에만 migration을 추가한다.
현재 목표는 새 항목 데이터만 저장하는 것이므로, 별도 schema migration 없이 구현할 수 있는지를 우선 검토한다.

## 완료 기준

1. 항공편 확인은 해당 여행의 항공편 입력 창으로 바로 이동한다.
2. 숙소 예약은 숙소가 선택된 예약 추가 창으로 바로 열리고, 가로 스크롤·잘림이 없다.
3. 여권 확인은 여권 전용 입력 또는 수정 창을 바로 연다.
4. 기본 체크리스트는 승인한 항목만 한 번 생성되며 모든 항목을 수정·삭제할 수 있다.
5. 관리자 Access 만료는 원문 `Failed to fetch` 대신 재로그인·원래 화면 복귀 흐름을 보인다.
6. 320·390·786px에서 BottomSheet, 항공편, 예약, 체크리스트의 가로 넘침이 없다.
7. typecheck, lint, 대상 Vitest, 대상 Playwright, production build가 통과한다.

## 완료 근거

- 라우팅·예약·체크리스트·관리자 오류 단위 테스트: 95개 통과
- Worker 여행·기본 체크리스트 테스트: 24개 통과
- Android Chromium·iPhone WebKit 직접 입력/가로 넘침 E2E: 2개 통과
- typecheck, lint, production build 통과
- 로컬 D1에 `0019_default_checklist.sql` 적용 완료. 운영 D1에는 미적용
- 로컬 화면에서 항공편 2개 입력 영역, 숙소가 선택된 예약 창, 개인 여권 편집 창을 직접 확인

## 승인 경계

- 로컬 코드·테스트·모바일 화면 검증은 승인됐다.
- 운영 migration, commit, push, 사용자·관리자 Worker 배포는 각각 별도 승인이다.
