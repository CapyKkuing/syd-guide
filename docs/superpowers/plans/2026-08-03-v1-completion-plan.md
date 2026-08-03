# V1 완성 구현계획서

> 작성일: 2026-08-03
> 기준 브랜치: `main`
> 기준 커밋: `d4d561b`
> 목표: 모바일 여행 중 상시 사용하는 V1을 Android와 iPhone에서 설치·오프라인·운영 복구까지 검증한다.

## 1. 확정된 제품 범위

- V1 지원 기기: Android와 iPhone 모두.
- 날씨: 샘플이 아닌 실제 날씨를 Today 화면에 제공한다.
- 운영 주소: 사용자·관리자 Cloudflare Workers만 사용한다.
- GitHub Pages: Workers 운영 검증 후 자동 배포를 중지한다.
- 운영 백업: D1 백업 파일을 암호화해 비공개 Google Drive 폴더에 보관한다.
- 복원 검증: 운영 D1이 아닌 별도 테스트 D1에서 수행한다.
- 핵심 여행 기능: 오늘, 일정, 장소, 저장한 맛집·카페, 예약, 비용, 체크리스트, 교통, 비상 연락처, 주의사항을 여행 중 바로 사용할 수 있어야 한다.
- V1 제외: 공개 상용화용 결제, 다중 관리자 권한 이전, 항공편 자동 조회 API, 여러 장소·날씨 공급업체 동시 연결.

## 2. 현재 확인된 기준 상태

### 이미 구현된 기반

- React·Vite PWA, Cloudflare Workers, D1, IndexedDB 오프라인 snapshot과 outbox.
- 관리자·참여자·초대·기기 관리, 여행 편집, 수동 항공편, 비용·정산, 예약·Drive 문서, 체크리스트.
- MapLibre 지도와 Google Maps 길찾기, Google Places 실제 사진·평점·영업정보, 추천·저장 장소 구분과 무료 하드 리밋.
- 교통, 비상 연락처, 주의사항 전용 화면.
- Android 설치 버튼과 iPhone 홈 화면 추가 안내.
- 자동 테스트와 브라우저 기반 모바일 QA 기반.

### 아직 V1 완료로 인정하지 않는 항목

- 관리자 Cloudflare Access 세션 만료 복구 수정의 운영 배포·검증.
- 실제 날씨 공급업체 선정·연동·캐시·무료 한도 차단.
- Android와 iPhone 실제 설치폰의 비행기 모드 cold start(완전 종료 후 재실행) 검증.
- D1 암호화 백업·Drive 업로드·별도 D1 복원 리허설.
- GitHub Pages 자동 배포 중지와 Workers 단일 운영 확인.
- 모든 핵심 화면의 모바일 넘침·잘림·터치·오류 상태 최종 회귀 QA.

### 엄격한 V1 진행률 기준

현재는 약 **40%**로 본다. 기능 코드 개수보다 운영 증거를 우선한 수치다.

| 완성 게이트 | 배점 | 현재 인정 | 100% 조건 |
|---|---:|---:|---|
| 관리자 인증 복구 | 8 | 6 | 사용자·관리자 운영 주소에서 재로그인 후 원래 화면 복귀 확인 |
| 핵심 여행 기능·모바일 UI | 28 | 19 | 핵심 화면 전부 실데이터·390px·실기기에서 사용 가능 |
| 실제 날씨 | 10 | 0 | 실시간·캐시·오프라인·한도 초과 상태 확인 |
| Android·iPhone PWA 오프라인 | 20 | 5 | 두 기기에서 설치·cold start·읽기·재연결 동기화 통과 |
| D1 백업·복원 | 18 | 4 | 암호화 Drive 백업과 별도 D1 복원·데이터 대조 통과 |
| Workers 단일 운영 | 6 | 3 | Pages 자동 배포 중지 후 두 Worker 정상 |
| 최종 회귀·출시 판정 | 10 | 3 | 자동·수동·보안·복구 체크리스트 전부 통과 |
| 합계 | 100 | 40 | 모든 증거가 문서에 기록됨 |

## 3. Phase 0: 관리자 인증 오류 복구

### 문제

- 관리자 Worker의 정적 화면은 열려도 Cloudflare Access 세션이 만료되면 `/api/*` 요청이 로그인 주소로 이동한다.
- 브라우저 `fetch`에서는 이 이동이 CORS 오류가 되어 단순 `Failed to fetch`로 보였다.
- 여행 직접 주소에서는 관리자 인증 오류까지 참여자 세션 만료로 처리해 `/pair`로 잘못 이동할 수 있었다.
- 참여자 명단 Promise 거절이 잡히지 않아 로딩이 끝나지 않는 경로가 있었다.

### 로컬 수정 완료 파일

- `src/features/auth/api.ts`
- `src/features/auth/ParticipantSetup.tsx`
- `src/features/auth/PairingManager.tsx`
- `src/components/StatusPanel.tsx`
- `src/data/api/snapshotDataSource.ts`
- `src/data/useTravelData.ts`
- `src/data/contracts.ts`
- `src/app/TripRoutePage.tsx`
- `worker/routes/session.ts`
- 관련 frontend·Worker 회귀 테스트

### 배포 전 완료 기준

- `Failed to fetch` 대신 `관리자 로그인이 필요합니다`와 `관리자 다시 로그인` 버튼이 보인다.
- 로그인 후 `continue`에 기록된 여행 편집 또는 관리 화면으로 돌아온다.
- 참여자·초대·기기 관리가 다시 로드된다.
- 관리자 인증 오류가 참여자 `/pair` 화면으로 이동하지 않는다.
- 외부 URL은 `continue` 값으로 허용하지 않는다.

### 검증

- 대상 frontend 테스트 49개.
- Worker 인증 테스트 11개.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- 운영 사용자·관리자 Worker에서 여행 편집, 참여자, 초대, 기기 관리 수동 QA.

## 4. Phase 1: 핵심 여행 기능과 모바일 UI 마감

### 목표

여행 중 하단 탭만으로 오늘 일정, 일정 변경, 저장 장소, 길찾기, 예약·비용·체크리스트·안전 정보를 빠르게 찾는다.

### 작업 1.1: 하단 장소 허브 최종 연결

- `장소` 탭에서 저장한 맛집·카페와 최신 추천을 함께 제공한다.
- 추천과 저장이 같은 Google Place이면 카드 하나만 보이고 `내가 저장` 상태를 표시한다.
- 필터: 전체, 맛집, 카페.
- 보기: 저장, 추천.
- 정렬: 인기순, 리뷰 많은순, 평점순.
- 실제 사진·평점·영업정보·주소를 표시하고 상세 길찾기만 Google Maps로 연다.
- Google Places 무료 하드 리밋을 넘으면 저장 장소와 캐시만 보이고 유료 호출은 하지 않는다.

주요 확인 파일:

- `src/pages/map/PlaceHubPanel.tsx`
- `src/pages/tools/places/PlaceDiscoveryCard.tsx`
- `src/services/places/api.ts`
- `worker/routes/places.ts`
- `worker/services/google-places.ts`
- `worker/db/place-provider.ts`

### 작업 1.2: 일정 모바일 상호작용 회귀

- 320px·390px·430px에서 화면 전체 가로 스크롤이 생기지 않는다.
- 날짜 탭은 좌우 스와이프로 이동할 수 있다.
- 모바일에서도 일정 카드를 길게 눌러 드래그 순서 변경할 수 있다.
- 화살표 이동은 접근성용 보조 수단으로 유지한다.
- 연속 순서 변경은 직전 응답을 기다리는 직렬 처리 또는 한 번의 최종 저장으로 묶어 충돌 팝업이 반복되지 않게 한다.
- 카드 테두리·내용이 잘리지 않고 하단 탭이 화면 아래에 고정된다.

주요 확인 파일:

- `src/pages/schedule/SchedulePage.tsx`
- `src/pages/schedule/ScheduleReorderList.tsx`
- `src/domain/scheduleOrder.ts`
- `src/services/sync/SyncProvider.tsx`
- `src/styles/schedule.css`
- `src/styles/navigation.css`

### 작업 1.3: 필수 도구 실제 사용 검증

- 교통: 공식 실시간 정보 링크, 일정 이동 구간, 저장한 교통 장소.
- 비상 연락처: 모든 전화 버튼이 `tel:`로 즉시 연결되고 공식 출처를 제공한다.
- 주의사항: 오프라인에서 저장된 내용이 보이고 체크리스트·비상 연락처로 이동한다.
- 예약: 파일 선택 UI, Drive 미리보기, 오프라인 메타데이터 상태를 공통 UI로 맞춘다.
- 비용: 이름, 결제자, 개인·함께·개인 대상, 현금·카드, 천 단위 쉼표, 정산 결과를 회귀 확인한다.

주요 확인 파일:

- `src/pages/tools/transport/TransportPanel.tsx`
- `src/pages/tools/emergency/EmergencyPanel.tsx`
- `src/pages/tools/tips/TipsPanel.tsx`
- `src/pages/tools/bookings/*`
- `src/pages/today/ExpensePanel.tsx`
- `src/pages/today/SettlementPanel.tsx`

### Phase 1 완료 기준

- 핵심 화면이 실데이터·빈 상태·오류·오프라인 상태에서 깨지지 않는다.
- Android Chrome과 iPhone Safari에서 주요 동작의 터치 영역이 최소 44px이다.
- 320px 이상에서 의도하지 않은 가로 스크롤이 없다.
- `typecheck`, `lint`, 대상 테스트, responsive E2E, production build가 통과한다.
- UI 수정은 `design-workflow`와 Astryx 규칙으로 화면별 승인을 받는다.

## 5. Phase 2: 실제 날씨

### 설계 원칙

- 공급업체 응답을 앱·D1에 직접 저장하지 않는다.
- Worker에 `WeatherProvider` 경계를 두고 앱은 공통 `WeatherSnapshot`만 사용한다.
- API key가 필요하면 Worker Secret에만 저장한다.
- 한도 초과 시 호출을 차단하고 마지막 캐시와 갱신 시각을 표시한다.
- 오프라인에서는 마지막 저장 날씨만 표시하고 `저장된 정보`라고 명확히 표시한다.

### 승인 전 조사

- 공식 날씨 API 후보 2~3개를 최신 공식 문서로 비교한다.
- 비교 항목: 호주 지원, 현재 날씨·시간별 예보, 상업 이용, 무료 한도, 초과 과금, 저장·캐시 제한, API key, 장애 정책.
- 공급업체와 비용·라이선스가 승인되기 전에는 외부 연동을 구현하지 않는다.

### 예상 데이터 계약

```ts
interface WeatherSnapshot {
  location: { name: string; latitude: number; longitude: number; timeZone: string };
  observedAt: string;
  fetchedAt: string;
  source: "live" | "cached";
  temperatureC: number;
  conditionCode: string;
  conditionLabel: string;
  precipitationChance?: number;
  windKph?: number;
}
```

### 예상 파일

- Add: `src/shared/weather.ts`
- Add: `src/services/weather/api.ts`
- Add: `worker/services/weather-provider.ts`
- Add: `worker/routes/weather.ts`
- Add: `migrations/0017_weather_cache.sql`
- Modify: `worker/app.ts`, `worker/env.ts`
- Modify: `src/data/contracts.ts`, `src/data/api/snapshotMappers.ts`
- Modify: `src/pages/today/DuringTripHome.tsx`, `src/pages/today/TodayCards.tsx`
- Add/Modify: frontend·Worker 날씨 테스트

### 완료 기준

- 여행지 좌표·시간대를 기준으로 실제 날씨가 보인다.
- live, cached, offline, quota exceeded, provider error 상태가 각각 검증된다.
- 새로고침 연타·여러 기기 접속에도 하드 리밋을 넘지 않는다.
- 샘플 날씨를 운영 화면에 표시하지 않는다.

## 6. Phase 3: Android·iPhone PWA와 오프라인

### 자동 검증

- manifest 이름·아이콘·start URL·scope 확인.
- 서비스 워커가 앱 shell을 캐시하고 `/api/*`는 캐시하지 않는지 확인.
- 최신 snapshot이 있으면 비행기 모드 cold start에서 마지막 여행으로 진입.
- 오프라인 읽기 전용에서는 일정·예약 메타데이터·메모·저장 장소·주의사항을 볼 수 있다.
- 오프라인 편집 허용 항목은 outbox에 한 번만 저장되고 재연결 후 한 번만 반영된다.

### 실기기 검증

Android Chrome:

1. 사용자 앱 설치.
2. 관리자 앱 설치.
3. 온라인 로그인·여행 열기.
4. 앱 완전 종료, 비행기 모드, 아이콘으로 재실행.
5. 읽기·금지된 관리 동작·재연결 동기화 확인.

iPhone Safari:

1. 공유 → 홈 화면에 추가.
2. 사용자 앱과 관리자 앱을 각각 standalone으로 실행.
3. Android와 같은 cold start·재연결 시나리오 확인.
4. safe area, 키보드, 하단 탭, 파일·사진 선택 확인.

### 예상 파일

- `vite.config.ts`
- `src/app/App.tsx`
- `src/app/rootStart.ts`
- `src/components/InstallPrompt.tsx`
- `src/components/OfflineBanner.tsx`
- `src/services/offline/*`
- `test/e2e/offline-conflict.spec.ts`
- `test/e2e/responsive.spec.ts`
- `docs/qa/v1-installed-device-checklist.md`

### 완료 기준

- 두 운영 주소를 Android와 iPhone에 설치할 수 있다.
- 비행기 모드에서 앱 자체가 열리고 마지막 여행 핵심 정보가 보인다.
- 오프라인 관리 기능은 안전하게 차단된다.
- 재연결 후 중복 저장·충돌 팝업 반복·데이터 소실이 없다.

## 7. Phase 4: D1 암호화 백업과 복원

### 권장 V1 방식

- `wrangler d1 export --remote`로 운영 D1 SQL을 로컬 임시 폴더에 내보낸다.
- 파일을 로컬에서 암호화한 뒤 비공개 Google Drive의 전용 `Backups/<database>` 폴더에 업로드한다.
- 평문 SQL은 업로드하지 않고 작업 후 안전하게 제거한다.
- 복원은 새 테스트 D1에만 수행한다.
- 운영 DB에는 복원 명령을 실행하지 않는다.

### 구현 전 별도 승인 항목

- 암호화 방식과 복구키 보관 위치. 권장: `age` 공개키 암호화, 개인키는 Drive 밖에 보관.
- 백업 실행 방식. 권장 순서: 수동 검증 → Windows 작업 스케줄러 자동화.
- Google Drive OAuth 범위와 전용 백업 폴더.
- 별도 Cloudflare D1 테스트 DB 생성.

### 예상 파일

- Add: `scripts/backup-d1.ps1`
- Add: `scripts/restore-d1-test.ps1`
- Add: `docs/operations/d1-backup-restore.md`
- Add: `docs/operations/incident-runbook.md`
- Modify: `.gitignore`는 임시 백업 경로만 정확히 추가할 때 별도 승인 후 변경.

### 검증

1. 운영 D1 export 성공과 파일 크기 기록.
2. 암호화 파일만 Drive에 존재하는지 확인.
3. 새 테스트 D1에 migration 적용 후 복원.
4. 핵심 테이블 row count와 표본 여행·일정·참여자·예약·장소를 원본과 대조.
5. 테스트 DB 앱 연결 또는 읽기 쿼리로 복원 가능성을 확인.
6. 평문 임시 파일이 남지 않았는지 확인.

### 완료 기준

- 최근 백업 1개를 선택해 별도 D1에 끝까지 복원할 수 있다.
- 복구키 없이 Drive 파일만으로 내용을 읽을 수 없다.
- 운영 DB는 변경되지 않았다.
- 실행일·백업 파일·복원 DB·검증 결과가 runbook에 기록된다.

## 8. Phase 5: Cloudflare Workers 단일 운영

### 순서

1. 사용자 Worker와 관리자 Worker의 동일 commit 배포를 확인한다.
2. 사용자 로그인·관리자 Access 로그인·여행 편집·기기 관리·Google Places·날씨·Drive를 smoke QA한다.
3. GitHub Pages URL이 운영 문서·초대 링크·PWA scope에서 사용되지 않는지 검색한다.
4. `.github/workflows/deploy-pages.yml` 자동 실행을 중지한다.
5. `vite.config.ts`의 `github-pages` fixture mode는 테스트 소비자가 있으면 유지하고, 없을 때만 별도 승인 후 제거한다.

### 완료 기준

- `main` push가 GitHub Pages를 배포하지 않는다.
- 사용자·관리자 앱은 Workers 주소에서만 설치·업데이트된다.
- 두 Worker의 version ID와 commit SHA가 배포 기록에 남는다.
- Pages 중지 후에도 PWA 업데이트와 deep link가 정상이다.

## 9. Phase 6: 최종 QA와 V1 출시 판정

### 자동 게이트

```text
npm run typecheck
npm run lint
npm test
npm run test:worker
npm run test:e2e
npm run build
```

### 수동 게이트

- Android 사용자·관리자 PWA.
- iPhone 사용자·관리자 PWA.
- 온라인·느린 네트워크·오프라인·재연결.
- 관리자 Access 만료 후 원래 화면 복귀.
- 초대·기기 연결·해제·해제 기기 삭제.
- 여행 생성·편집·삭제·복원.
- 일정 조회·스와이프·순서 변경·지도 동선.
- 저장 맛집·카페·추천·길찾기·무료 한도 차단.
- 예약 파일·Drive·비용·정산·체크리스트.
- 교통·비상 전화·주의사항.
- 실제 날씨 live·cached·offline.
- D1 백업·별도 DB 복원.

### 출시 기준

- P0·P1 미해결 오류 0개.
- 핵심 흐름 실패 0개.
- 미완료 항목은 V1 범위 밖이라는 사용자 승인이 문서에 있어야 한다.
- `TASKS.md`의 Task 20을 실제 설치폰 검증 후에만 완료 처리한다.
- V1 tag와 최종 handoff는 모든 운영 증거가 모인 뒤 생성한다.

## 10. 실행 순서와 승인 게이트

| 순서 | 작업 | 로컬 작업 | 별도 승인 필요 |
|---:|---|---|---|
| 0 | 관리자 인증 오류 배포 | 완료된 수정 재검증 | commit, push, 사용자·관리자 deploy |
| 1 | 핵심 기능·모바일 UI | 코드·테스트·목업 QA | 화면안 확정, phase commit, push, deploy |
| 2 | 날씨 후보 조사 | 공식 문서 비교 | 공급업체·비용·라이선스·Secret·D1 migration·deploy |
| 3 | 날씨 구현 | provider 경계·UI·테스트 | 외부 API 연결과 운영 설정 |
| 4 | PWA 실기기 | 자동 테스트·체크리스트 | 사용자의 Android·iPhone 수동 확인 |
| 5 | 백업·복원 | 스크립트·runbook | 암호화 방식, OAuth, 테스트 D1 생성, 운영 export·Drive upload |
| 6 | Workers 단일 운영 | 참조 검색·변경 초안 | Pages workflow 중지, push, deploy |
| 7 | 최종 출시 | 전체 QA·보고 | V1 tag·최종 배포 승인 |

## 11. 위험과 차단 기준

| 위험 | 방지책 | 차단 조건 |
|---|---|---|
| 관리자 Access 만료 | 동일 origin 재로그인 URL과 `continue` 복귀 | 운영 QA 전 기능 완료 주장 금지 |
| 날씨·Places 비용 | Worker cache와 D1 hard limit | 자동 유료 전환 가능하면 연동 금지 |
| 공급업체 라이선스 | 공식 문서와 저장 제한 기록 | 상업·공개 앱 허용 불명확 시 V1 운영 연동 보류 |
| 오프라인 데이터 충돌 | 직렬 sync, idempotency, conflict 회귀 테스트 | 데이터 소실·중복 재현 시 출시 금지 |
| D1 복원 실수 | 별도 DB ID 확인과 운영 DB 거부 guard | 대상 DB가 불명확하면 명령 실행 금지 |
| 백업 평문 노출 | 임시 경로 제한, 암호화 후 업로드, 평문 제거 | 암호화·키 보관 승인 전 export 자동화 금지 |
| 두 배포 경로 혼선 | Workers 단일 주소와 Pages workflow 중지 | 초대·PWA 링크에 Pages가 남으면 중지 금지 |

## 12. 다음 실행 단위

다음 승인 후 진행할 범위는 **Phase 0 배포 게이트**다.

1. 현재 인증 오류 수정 diff와 비밀정보를 최종 검토한다.
2. phase commit을 만든다.
3. `main`에 push한다.
4. 사용자·관리자 Worker를 같은 commit으로 배포한다.
5. 운영 내부 브라우저에서 여행 편집, 참여자, 초대, 기기 관리를 확인한다.
6. 성공하면 Phase 1 모바일 UI 회귀로 넘어간다.

Phase 0 운영 검증이 끝나기 전에는 실제 날씨·백업·Pages 중지 작업을 섞지 않는다.

## 13. 컨텍스트 압축 후 복구 체크리스트

컨텍스트가 압축되거나 작업이 이어질 때마다 구현을 재개하기 전에 다음을 확인한다.

1. `caveman ultra` 말투와 보고 방식이 유지되는가.
2. 최신 사용자 요구사항과 현재 코드·계획이 달라진 부분이 있는가.
3. 현재 Phase, 완료 항목, 미완료 항목, 승인받은 외부 작업 범위가 무엇인가.
4. commit, push, migration, Secret, 배포, 외부 API 비용 승인이 각각 분리되어 있는가.
5. 사용자가 해야 할 일과 다음 작업의 권장 모델·reasoning 단계가 표시되어 있는가.
6. 현재 작업을 안전하게 나눌 수 있는 read-only 검수·조사·QA가 있으면 서브에이전트를 활용했는가.
7. 같은 worktree의 코드 작성자는 한 명으로 유지하고, 서브에이전트가 사용자 변경을 수정·되돌리지 않게 했는가.
8. 압축 전 요구사항과 불일치가 발견되면 구현 전에 사용자에게 보고했는가.
