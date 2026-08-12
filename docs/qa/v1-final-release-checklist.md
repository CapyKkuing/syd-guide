# V1 최종 출시 통합 QA 체크리스트

기준 문서: docs/superpowers/plans/2026-08-03-v1-completion-plan.md
적용 범위: Phase 2~5 구현 묶음 이후의 Phase 6 최종 통합·출시 준비
작성 기준일: 2026-08-12

> 이 문서는 마지막 일괄 QA를 실행할 때 사용하는 체크리스트다. 이 문서를 작성하는
> 동안에는 운영 호출, 원격 D1 변경, Secret 변경, 브라우저 운영 검증, 실제 기기 입력,
> 전체 E2E를 실행하지 않는다. 아래의 빈 체크박스는 현재 미실행을 뜻하며, 직접 수집한
> 증거가 있을 때만 체크한다.

## 0. 판정 원칙

### 현재 결정

- 남은 운영·브라우저·실기기 검증은 구현 묶음 사이에 나누지 않고 Phase 6에서 한 번에 수행한다.
- 각 구현 묶음에서는 변경 경계의 대상 테스트, typecheck, lint, production build만 수행한다.
- Phase 1의 실기기·운영 잔여 항목, Phase 2의 실제 Open-Meteo 운영, Phase 4의 운영
  export·복원, Phase 5의 Workers-only·PWA deep-link를 모두 같은 최종 증거 묶음으로
  판정한다.
- iPhone 실기기 QA는 V1 완료 기준이 아니라 상용 출시 단계로 이동했다.
- 오프라인 동기화는 폐기된 요구다. 날씨의 기기 오프라인 제공도 하지 않는다.

### 상태 표기

| 상태 | 의미 | 체크 조건 |
| --- | --- | --- |
| 구현됨 | 코드·문서·스크립트가 계획 범위에 존재 | diff와 관련 파일로 확인 |
| 자동 검증 | 로컬 명령의 직접 출력이 성공 | 명령, 시각, SHA, 결과 로그 기록 |
| 화면 검증 | 로컬 또는 운영 브라우저에서 직접 확인 | viewport, 경로, 콘솔·overflow 기록 |
| 실기기 검증 | 설치 Android에서 직접 입력·재실행 | 기기, OS, 앱 모드, 증거 기록 |
| 운영 검증 | Cloudflare·Open-Meteo·Drive·D1 등 실제 경계 확인 | 실행 승인과 비밀정보 없는 증거 |
| 사용자 승인 | 해당 단계의 명시적 승인 확인 | 승인 일시·범위·기록 위치 |
| 완료 | 위 상태가 계획서 기준으로 모두 충족 | GAP 원장·TASKS·dashboard 동기화 후 판정 |

상태를 추정해서 완료로 올리지 않는다. 과거 계획서나 대시보드에 남은 성공 기록은
참고용 이력일 뿐 최종 SHA의 현재 증거가 아니다. 과거 자동 게이트의 기록에는
frontend 69개 파일 489건, Worker 102건, Playwright 46건이 있으며, 2026-08-12
Phase 6에서 현재 소스 기준으로 다시 실행했다.

### 최종 일괄 QA 순서

- [x] A. 제품 SHA와 문서 SHA 분리, worktree·승인 범위·비밀정보 노출 사전 확인
- [x] B. 로컬 자동 게이트 전체 실행
- [ ] C. 승인된 Phase 2 운영 순서 실행
- [ ] D. 승인된 Phase 4 백업·복원 순서 실행
- [ ] E. Phase 5 Pages 정책·동일 제품 SHA는 확인, stale PWA smoke는 재검증 필요
- [ ] F. Phase 1 잔여 운영·브라우저·Android 실기기 항목 실행
- [ ] G. P0/P1·핵심 흐름·보안·계획 동기화·출시 승인 판정

앞 단계의 필수 증거가 없으면 다음 단계로 넘어가지 않는다. 이 문서의 체크박스를
채우기 위해 원격 명령이나 외부 호출을 임의로 실행하지 않는다.

## 1. 최종 SHA와 로컬 자동 게이트

### 1-1. 사전 고정

- [x] 최종 구현 범위가 계획서의 현재 실행 단위와 일치한다.
- [x] 브랜치와 HEAD를 기록했다: `main`, 문서 HEAD `8fc2f5f4`.
- [x] 배포 제품 SHA `c602239c`와 문서 SHA `8fc2f5f4`를 분리해 기록했다.
- [x] 승인 파일 밖 로컬 사진·목업·`.omo`·`.superpowers`·`src/dev`를 release 범위에서 제외했다.
- [x] 운영 migration·provider 호출·배포 승인과 로컬 검증 승인을 분리했다.
- [x] 전체 Playwright가 격리된 4173 포트와 local D1에서 완료됐다.

사전 확인에 사용할 읽기 전용 명령:

~~~powershell
git branch --show-current
git rev-parse HEAD
git status --short
~~~

위 명령의 출력에 포함된 개인 경로·계정·토큰은 증거 문서에 복사하지 않는다.

### 1-2. 명령 순서

다음 순서는 package.json의 현재 스크립트와 V1 계획서의 자동 게이트를 따른다.
아직 실행하지 않은 명령에는 체크하지 않는다.

| 순서 | 명령 | 직접 통과 기준 | 상태 |
| --- | --- | --- | --- |
| 1 | npm run typecheck | TypeScript 오류 0, 종료 코드 0 | [x] |
| 2 | npm run lint | ESLint 오류·warning 0, 종료 코드 0 | [x] |
| 3 | npm test | frontend 69개 파일 489건 성공 | [x] |
| 4 | npm run test:worker | Worker 11개 파일 102건 성공 | [x] |
| 5 | npm run test:e2e | Playwright 5개 프로젝트 46/46 성공 | [x] |
| 6 | npm run build | production build 성공, 산출물 누락 없음 | [x] |
| 7 | git diff --check | 공백 오류 0 | [x] |

Playwright의 test:e2e는 별도의 local webServer를 시작한다. 현재 설정은 production
build, local D1 migration, local Wrangler dev를 순서대로 실행하고 localhost:4173의
health endpoint를 기다린다. 따라서 이 단계는 원격 D1이나 운영 Worker를 검증하는
명령이 아니다. 이미 4173 포트를 점유한 서버를 재사용하지 말고, 실패하면 실제
원인을 확인한 뒤에만 재실행한다.

### 1-3. 자동 게이트 증거

- [x] 각 명령의 종료 코드, 제품 SHA, 테스트 수와 실패 수를 기록했다.
- [x] test:e2e의 desktop Chromium, Android-like Chromium, compact 320px, WebKit
      responsive 프로젝트 결과를 구분해 기록했다.
- [x] local D1 상태와 .tmp 결과 폴더가 운영 데이터나 Git 추적 파일을 변경하지 않았다.
- [x] production build 산출물과 network-only service worker 자동 경계를 검증했다.
- [x] 자동 통과만으로 운영·실기기·사용자 승인 상태를 완료로 올리지 않았다.

### 1-4. Windows 실행 주의

- PowerShell 명령은 한 단계씩 실행한다. Bash 전용 연결 연산자나 임의의
  destructive cleanup을 사용하지 않는다.
- Playwright, Vite, Wrangler가 남긴 dist, .tmp, .wrangler 파일은 프로세스가 종료된
  뒤에만 확인한다. Windows 파일 잠금이 있으면 Node·브라우저 프로세스와 포트 4173을
  확인하고, git clean으로 우회하지 않는다.
- ESLint가 .worktrees나 로컬 산출물을 다시 순회하면 무시 규칙과 실제 변경을 먼저
  확인한다. 무관한 전역 ignore나 파일을 임의로 되돌리지 않는다.
- jsdom 또는 WebGL 관련 stderr가 보이더라도 종료 코드와 테스트 assertion을 먼저
  판정한다. 실제 실패·console error·trace를 “환경 소음”으로 숨기지 않는다.
- 한국어 경로에서는 명령의 파일 경로를 따옴표로 감싼다. 평문 SQL·개인키·토큰은
  명령 인자, 로그, 스크린샷에 넣지 않는다.

## 2. Phase 2 운영 날씨 게이트

이 절은 로컬 테스트가 아니라 운영 승인 후의 순서다. 운영 migration, 실제
provider 호출과 두 Worker 배포를 지금 실행하지 않는다. Open-Meteo Free에는 API
Secret 설정 단계가 없다.

### 2-1. 고정 조건

- [x] Open-Meteo Free의 비공개·비상업 사용 조건과 Best Match 사용 승인이 확인됐다.
- [x] 제품 자체 월 hard limit이 10,000회로 기록돼 있다.
- [x] current 서버 캐시 60분, forecast 서버 캐시 24시간이 기록돼 있다.
- [x] `Open-Meteo · Best Match` 출처와 일반 정보용 면책 문구가 구현돼 있다.
- [x] Open-Meteo Free에는 API key·결제수단·자동 유료 전환이 없고, 상업 공개 전에는 별도 라이선스 검토가 필요함을 확인했다.
- [x] 제품 SHA `c602239c`, 두 Worker version과 additive migration 롤백 원칙을 기록했다.

### 2-2. 반드시 이 순서로 실행

| 순서 | 작업 | 통과 기준 | 승인·증거 |
| --- | --- | --- | --- |
| 1 | 운영 승인·제품 SHA·migration 파일 확인 | 승인 범위와 배포 산출물이 동일 | 완료, `c602239c` |
| 2 | D1에 0023_weather_snapshots.sql 적용 | 적용 성공, schema·migration drift 없음 | 완료, pending 0 |
| 3 | 같은 제품 SHA를 두 Worker에 배포 | 두 version ID와 SHA가 서로 일치 | 완료, 100%·동일 annotation |
| 4 | 실제 날씨 QA 실행 | 아래 2-3의 모든 시나리오 통과 | 운영 브라우저·API 증거 |
| 5 | 운영 상태·승인·롤백 정보를 plan/TASKS/dashboard에 동기화 | 불일치 0 | 문서 diff·사용자 승인 |

### 2-3. 실제 날씨 시나리오

- [ ] 최초 live 응답이 정규화된 current와 forecast로 표시된다.
- [ ] current 60분 이내 재조회는 서버 cache를 사용한다.
- [ ] current가 만료돼도 유효한 forecast cache는 유지되고 current만 갱신된다.
- [ ] forecast 24시간 cache가 만료되는 경계를 확인한다.
- [ ] 월 사용량이 10,000회에 도달하면 provider 호출 전에 차단된다.
- [ ] provider 오류·timeout·잘못된 응답에서 사용자용 unavailable 상태가 표시된다.
- [ ] provider 불가 상태에서 raw provider body와 내부 오류 정보가 노출되지 않는다.
- [ ] 날씨 실패가 여행·일정·메모리 snapshot 저장을 실패시키지 않는다.
- [ ] 출처와 면책 문구가 live·cached·unavailable 상태에서 필요한 위치에 남는다.
- [ ] 기기 오프라인 날씨를 제공한다고 오판하게 만드는 UI나 문구가 없다.
- [ ] 운영 데이터에 raw provider response가 저장되지 않는다.

### 2-4. 즉시 중단 조건

- [ ] migration이 다른 schema를 변경하거나 rollback 방법이 확인되지 않음
- [ ] 두 Worker가 다른 SHA/version으로 배포됨
- [ ] provider 호출이 hard limit 차단보다 먼저 발생함
- [ ] 무료 플랜 범위를 넘는 과금·자동 upgrade 징후가 있음
- [ ] Secret, raw response, 개인 데이터가 로그·화면·증거에 나타남

하나라도 해당하면 provider 호출을 더 진행하지 않고 승인자에게 보고한다.

## 3. Phase 4 D1 암호화 백업·복원 게이트

운영 export와 테스트 D1 생성·복원은 서로 다른 원격 승인이다. 운영 D1에는 복원
명령을 실행하지 않는다. 이 절의 순서는 export → age → 비공개 Drive → 새 빈
test D1 restore → row/sample 대조다.

### 3-1. 사전 승인

- [x] 운영 export 1회 승인이 있다.
- [x] age 공개 recipient와 비밀번호 암호화 identity의 보관 위치를 확인했다.
- [x] recipient·identity·작업 폴더가 Git 프로젝트 밖의 승인된 드라이브에 있다.
- [x] 평문 SQL이 잠시 생성되는 잔여 위험과 안전 삭제 미보장 사실을 승인받았다.
- [x] test D1 생성·원격 복원·읽기 전용 대조 승인이 각각 있다.
- [x] 백업 파일·폴더·경로 검사에서 평문 SQL·개인키 marker가 없음을 확인했다.

실행 시 백업 스크립트의 원격 export 확인 스위치와 복원 스크립트의 두 테스트
복원 확인 스위치를 모두 별도로 검토한다. unencrypted temporary file 위험을
명시하는 AcceptUnencryptedTemporaryFiles 사용은 실제 실행 승인에만 포함하며,
현재 문서 작업에서는 명령을 실행하지 않는다.

### 3-2. 운영 export와 암호화

- [x] Wrangler remote export를 Git 프로젝트 밖에서 한 번 실행한 암호화 산출물이 존재한다.
- [x] 암호화 산출물이 0바이트가 아니며 age header가 유효하다.
- [x] age 공개 recipient로 암호화된 `.sql.age` 형식이다.
- [x] 완성된 `.sql.age`는 136,447 bytes이며 SHA-256을 기록했다.
- [x] 결과 폴더에 `.sql`, `.partial`, 개인키, 비밀번호가 남지 않았다.
- [x] 평문 잔존 0을 확인했으며 물리적 복구 불가를 주장하지 않았다.

### 3-3. 비공개 Drive 보관

- [ ] 비공개 전용 Drive 폴더에 완성된 .sql.age 하나만 수동 업로드했다.
- [ ] 링크 공유·외부 공개·조직 외 권한이 꺼져 있다.
- [ ] Drive에서 다시 받은 파일의 SHA-256이 로컬 파일과 일치한다.
- [ ] Drive에는 평문 SQL, 부분 파일, identity, recipient 비밀값이 없다.
- [ ] 자동 OAuth·refresh token 보관을 추가하지 않았다.

### 3-4. 새 빈 test D1 복원

- [x] 운영과 다른 이름이며 restore-test 표식이 있는 D1을 만들었다.
- [x] 복원 전 앱 테이블 0개를 read-only query로 확인했다.
- [ ] age로 복호화한 평문은 Git 프로젝트 밖 전용 임시 폴더에만 존재한다.
- [ ] 두 복원 확인 스위치와 unencrypted temporary file 위험 승인을 확인했다.
- [ ] 복원 대상이 운영 D1이 아님을 이름·config·로그에서 재확인했다.
- [ ] 복원 후 평문과 부분 파일을 정리했고, 잔존 여부를 확인했다.

### 3-5. row/sample 대조

- [ ] `_cf_KV`, `d1_migrations`, `sqlite_*`를 제외한 사용자 테이블 27개의 운영·복원 row count가 모두 일치한다.
- [ ] members, settlement, storage, usage, weather 테이블도 누락 없이 대조했다.
- [ ] trip_media와 대표사진·릴 metadata 참조의 row count와 연결이 일치한다.
- [ ] 표본 여행의 날짜, 일정 순서, 참여자, 예약, 장소, 미디어 참조가 일치한다.
- [ ] 대조는 test D1 읽기만 수행했고 운영 D1에는 쓰기가 0회다.
- [ ] export 시각, 암호화 파일 SHA, Drive 공유 상태, test D1, 대조 결과를 기록했다.

## 4. Phase 5 Workers-only·Pages·PWA 게이트

### 4-1. Pages 자동 push 중지와 fixture 보존

- [x] .github/workflows/deploy-pages.yml에 자동 push 트리거가 없다.
- [x] 필요한 수동 workflow_dispatch만 남아 있고, 사용 시 별도 승인으로 실행한다.
- [x] vite.config.ts의 github-pages mode와 /syd-guide/ base fixture가 보존돼 있다.
- [x] test가 소비하는 GitHub Pages fixture 참조는 제품 runtime 경로와 분리돼 있다.
- [x] trigger 제거 뒤 main 제품·문서 push에서 Pages workflow 실행 0건을 확인했다.

Pages 정책을 확인하기 위해 운영 Pages 배포를 임의로 실행하지 않는다. workflow
변경은 commit·push 승인과 별도로 기록한다.

### 4-2. 동일 SHA 두 Worker 배포

- [x] 사용자 Worker가 제품 SHA `c602239c`로 배포됐다.
- [x] 관리자 Worker가 같은 제품 SHA로 배포됐다.
- [x] 두 version ID, 배포 시각, 대상 표면(user/admin)을 기록했다.
- [x] Pages URL이 제품 runtime, invite, manifest, service worker의 운영 URL로
      사용되지 않는다.
- [ ] 서로 다른 bundle·service worker가 섞이지 않는지 SHA로 확인했다.

### 4-3. HTTP PWA deep-link smoke

최종 배포 뒤 실제 HTTP 응답을 기록한다. 아래는 기대 결과이며 현재 실행 결과가 아니다.

- [ ] 사용자 root, health, manifest, service worker, bundle이 정상 응답한다.
- [ ] 관리자 root와 health는 보호 정책에 맞는 Access 응답을 보인다.
- [ ] 관리자 Access 인증 뒤 /library가 새 HTML·bundle로 열리고 stale service
      worker가 이전 앱을 되살리지 않는다.
- [ ] /library, /trip/<id>, /pair, 일정·장소·예약·도구 경로를 직접 새로 열어도
      SPA fallback과 인증 경계가 정상이다.
- [ ] 새로고침·PWA 설치·업데이트 후 동일 SHA의 service worker가 활성화된다.
- [ ] 초기 로드·deep-link·로그인 실패에서 raw Failed to fetch, Secret, PII가
      사용자 화면에 노출되지 않는다.
- [ ] 운영 root와 관리자 root의 HTTP 상태·location·bundle SHA를 각각 기록한다.

## 5. Phase 1 잔여 최종 운영·브라우저·Android QA

이 절은 최종 통합 시 실제 설치 Android와 승인된 운영 계정으로 실행한다. local
Playwright 통과만으로 체크하지 않는다.

### 5-1. Places

- [ ] 운영 Places hard limit 800에서 요청이 정확히 차단된다.
- [ ] 800회 한도에 도달한 뒤 provider 호출이 0회다.
- [ ] 사용자는 재시도·상태·다음 행동을 이해할 수 있고 raw provider body가 없다.

### 5-2. Android 설치 앱의 장소·지도·편집

- [ ] 설치 standalone 모드에서 장소 목록·상세·지도 경계를 확인한다.
- [ ] 장소 추가·수정·취소·재진입이 올바른 상태를 유지한다.
- [ ] 터치 viewport에서 overflow, clipped control, scroll lock, overflow menu를
      확인한다.
- [ ] 지도나 provider 실패가 여행·일정 편집을 망가뜨리지 않는다.

### 5-3. 온라인 일정·메모 저장

- [ ] 설치 Android에서 온라인 일정과 메모를 직접 저장한다.
- [ ] 같은 기기에서 재편집 후 저장하고, 다른 기기에서 5초 안에 반영되는지 확인한다.
- [ ] 연결이 없는 상태에서는 connection-required 안내가 나타나며 거짓 성공을
      표시하지 않는다.
- [ ] 수동 reload가 필요한 승인된 예외는 안내·복구 절차와 함께 기록한다.
- [ ] stale service worker 제거 뒤에도 저장·재조회·로그인이 일관되다.

### 5-4. PDF·미디어·EXIF

- [ ] Google Drive PDF가 운영 미리보기에서 열리고 다운로드·실패 상태가 분명하다.
- [ ] 실제 Android 카메라 JPEG 업로드의 capturedAt이 유효한 EXIF 촬영시각과
      일치한다.
- [ ] EXIF가 없거나 유효한 timezone offset이 없으면 createdAt 업로드시각 fallback이
      적용된다.
- [ ] 원본 JPEG와 앱 미리보기 WebP 폴더 분리가 운영 화면에서 의도대로 보인다.
- [ ] 완전 빈 캐시의 다른 설치 기기에서 미리보기 전송량·첫 로딩 시간을 기록한다.
- [ ] QA 사진·여행은 승인된 범위에서만 정리하고, 기존 여행·기존 Drive 원본을
      변경하지 않는다.

### 5-5. 관리자·대표자·PWA 회귀

- [ ] 관리자 Access stale service worker를 정리한 뒤 로그인·/library·재로그인이
      정상이다.
- [ ] 최초 대표자 선택, 대표자 변경, 기존 대표자 유지가 운영 데이터와 화면에
      일치한다.
- [ ] 설치 PWA에서 편집 후 complete/restart와 edit-return 흐름이 끊기지 않는다.
- [ ] desktop, Android-like, compact, 승인된 운영 viewport에서 가로 overflow와
      console error가 0이다.
- [ ] empty, loading, unavailable, provider error, connection-required 상태가
      서로 섞이지 않는다.

### 5-6. V1 범위 밖 명시

- [ ] iPhone 실기기 증거는 상용 출시 단계로 이동했음을 기록했다.
- [ ] 폐기된 offline sync를 V1 미완료로 다시 열지 않았다.
- [ ] V1 범위 밖 항목을 통과·실패 판정에 섞지 않았다.

## 6. 최종 릴리스 판정

### 6-1. P0/P1과 핵심 흐름

- [ ] 미해결 P0 = 0
- [ ] 미해결 P1 = 0
- [ ] 로그인·초대·기기 연결·여행 CRUD 핵심 흐름 실패 = 0
- [ ] 일정·장소·예약·지출·체크리스트·미디어·릴·관리자 흐름의 차단 실패 = 0
- [ ] Open-Meteo hard limit·cache·unavailable 계약 위반 = 0
- [ ] D1 export/restore row 또는 sample mismatch = 0
- [ ] 동일 SHA가 아닌 Worker 배포 = 0
- [ ] Pages 자동 push 배포 = 0

P2 또는 알려진 잔여 이슈는 숨기지 말고 severity, 영향, 완화, 사용자 승인 여부를
함께 기록한다. P0/P1이 남아 있거나 핵심 흐름이 실패하면 출시 판정을 중지한다.

### 6-2. 개인정보·보안·외부 경계

- [ ] API key, token, password, 개인키, 평문 SQL이 문서·로그·스크린샷·Drive에 없다.
- [ ] raw provider response, 내부 Access 정보, PII가 사용자 화면과 오류 body에 없다.
- [ ] 비공개 Drive 공유 상태가 유지된다.
- [ ] 운영 D1은 backup restore QA 중 변경되지 않았다.
- [ ] 승인하지 않은 외부 API, 비용 발생, 계정·권한 변경이 0회다.
- [ ] rollback 또는 중단 기준과 담당자가 기록돼 있다.

### 6-3. 계획·TASKS·dashboard 동기화

- [ ] V1 계획서의 현재 Phase, 다음 실행 단위, 완료·진행·미완료 상태를 실제 증거와
      맞췄다.
- [ ] GAP-01~GAP-40 원장에서 구현됨·자동 검증·화면·운영·사용자 승인·완료를
      구분했다. 증거가 없는 GAP은 완료로 바꾸지 않았다.
- [ ] 운영·실기기 증거가 모두 확보된 뒤에만 TASKS.md Task 20을 체크한다.
- [ ] .codex-progress/index.html을 계획서와 맞췄다. dashboard는 진행 표시용이며
      기준 문서가 아니고, 이 QA 문서와 함께 자동으로 커밋하지 않는다.
- [ ] 계획서와 TASKS 또는 dashboard가 다르면 계획서를 기준으로 차이를 보고하고,
      사용자 승인 뒤에만 상태를 고쳤다.

## 7. commit·push·deploy·tag·handoff 승인 경계

각 행은 독립된 승인이다. 한 행의 승인이 다음 행의 승인을 포함한다고 추정하지 않는다.

| 작업 | 필요한 승인 | 증거 | 현재 상태 |
| --- | --- | --- | --- |
| 로컬 코드·문서·자동 게이트 | 로컬 작업 범위 승인 | diff, 명령 로그 | [ ] |
| 최종 commit | 명시적 commit 승인 | commit SHA, diff check | [ ] |
| main push | 명시적 push 승인 | remote SHA 비교 | [ ] |
| D1 0023 migration | 운영 migration 승인 | migration 로그·schema 확인 | [ ] |
| Open-Meteo 실제 호출·비용 경계 | provider 사용 승인 | 호출 수·cache·quota | [ ] |
| 사용자·관리자 Worker deploy | 두 대상 배포 승인 | 같은 SHA·version ID | [ ] |
| Pages workflow 정책 변경 | workflow commit/push 승인 | push trigger 부재 증거 | [ ] |
| 수동 Pages dispatch | 별도 Pages 배포 승인 | workflow run | [ ] |
| V1 tag | 명시적 tag 승인 | tag와 commit SHA | [ ] |
| 최종 handoff·출시 보고 | 사용자 최종 승인 | evidence bundle·잔여 원장 | [ ] |

운영 migration, Secret, 외부 provider 호출, 원격 D1 export/restore, commit, push,
deploy, tag, handoff는 이 문서를 작성하거나 로컬 diff-check하는 동안 실행하지 않는다.

## 8. 증거 묶음과 종료 보고

최종 handoff에는 아래 항목을 한 폴더 또는 링크 묶음으로 남긴다. 비밀값과 PII는
제외한다.

- [ ] FINAL_SHA, branch, commit·push·tag 상태
- [ ] 자동 게이트 명령별 종료 코드·테스트 수·실패 수·실행 시각
- [ ] Playwright viewport·경로·스크린샷·trace·console 결과
- [ ] Android 기기·앱 모드·입력·재조회·PWA 업데이트 결과
- [ ] Phase 2 migration·Open-Meteo·두 Worker 배포·weather 시나리오 결과
- [ ] Phase 4 암호화 파일 크기·SHA-256·비공개 Drive·test D1 row/sample 대조
- [ ] Phase 5 workflow 정적 확인·동일 SHA·HTTP PWA deep-link 결과
- [ ] GAP 원장, P0/P1 판정, TASKS·dashboard·plan 동기화 결과
- [ ] 미완료·상용 단계 이관·명시적 승인 대기 항목

### 최종 종료 조건

- [ ] 위 필수 체크가 모두 증거와 함께 완료됐다.
- [ ] 중단 조건이 하나도 남지 않았다.
- [ ] 사용자 최종 승인 전에는 “출시 완료” 또는 “V1 완료”라고 보고하지 않았다.
- [ ] commit, push, deploy, tag, handoff 각각의 승인과 실제 결과를 구분해 보고했다.
