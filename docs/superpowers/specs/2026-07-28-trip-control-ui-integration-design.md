# 우리만의 여행 가이드북 Task 4.5 통합 UI 설계

- 작성일: 2026-07-28
- 상태: 사용자 승인 설계
- 대상 저장소: `syd-guide`
- 대상 브랜치: `feat/couple-travel-pwa`
- 작업명: Task 4.5 — 기존 Phase 1 설계와 Trip Control 디자인 통합
- 제품명: `우리만의 여행 가이드북`
- 디자인 방향명: `Trip Control`

## 1. 문서의 역할

이 문서는 다음 두 설계를 통합한 Task 4.5의 공식 UI 기준이다.

1. `2026-07-27-couple-travel-guide-phase-1-design.md`
   - 여러 여행을 보관하는 커플 여행 앱
   - 여행 서재, 공동 편집, 인증, 기기 연결, 오프라인, 동기화
2. 사용자 승인 `Sydney Guide PWA Design Spec`
   - Today-first
   - 실행 중심 Trip Control
   - Light·Dark·System 테마
   - `오늘·일정·지도·도구` 4탭
   - 낮은 시각 소음과 빠른 정보 파악

두 문서가 충돌할 경우 UI·정보 구조·시각 규칙은 이 문서를 우선한다.

기존 Phase 1 설계의 다음 항목은 그대로 유지한다.

- 여러 여행을 저장하는 여행 서재
- 관리자와 파트너의 권한 구분
- 10분 1회용 QR·링크 기기 연결
- Worker·D1·세션 보안 경계
- 일정·장소·예약·준비물·메모·투표의 기능 범위
- 오프라인·동기화·충돌 처리 계획
- 비용 정산·AI 추천·사진 기능의 후속 단계 구분

기존 설계의 다음 시각 방향은 폐기한다.

- 따뜻한 종이색 중심 배경
- 편집형 여행 잡지 분위기
- 겹쳐진 카드
- 과한 그라데이션
- 반투명 glassmorphism
- 강한 blur와 큰 floating navigation
- 여행 내부 5탭 구성

## 2. 확정된 사용자 결정

### 2.1 제품 구조

- 앱은 시드니 전용이 아니라 여러 여행을 보관하는 `우리만의 여행 가이드북`이다.
- `Trip Control`은 제품명이 아니라 여행 내부 UI의 디자인 방향명이다.
- 앱을 열면 여행 서재를 표시한다.
- 여행을 선택하면 해당 여행의 Trip Control로 진입한다.

### 2.2 여행 서재

- 작은 대표 이미지가 포함된 실용형 여행 카드를 사용한다.
- 카드의 핵심 정보는 여행지, 날짜, 상태, 예약 수, 최근 수정 시간이다.
- 여행 서재에는 여행 내부 하단 4탭을 표시하지 않는다.
- 여행 서재에서 여행을 선택한 뒤에만 `오늘·일정·지도·도구`를 표시한다.

### 2.3 Task 4.5 범위

- 새 디자인 시스템과 App Shell을 실제 코드에 적용한다.
- 여행 서재와 여행 내부 4개 화면을 완성형 UI로 제작한다.
- 여행 데이터 기능은 샘플 fixture로 표시한다.
- 실제 여행 CRUD, 동기화, 일정·장소·예약 API 연결은 기존 Task 5 이후에 진행한다.
- Task 1~4의 Worker·D1·인증·기기 연결 코드는 보존한다.

### 2.4 오늘 화면의 여행 상태

- 예정 여행: D-day와 첫날 일정 미리보기
- 여행 중: 여행지 시간대 기준 실제 오늘 일정
- 완료 여행: 여행 요약과 다시 보기

### 2.5 예산과 날씨

- Task 4.5에서는 예산 카드 UI와 샘플 데이터만 제공한다.
- 실제 지출 입력·정산은 Phase 2에서 연결한다.
- Task 4.5에서는 날씨 카드 UI와 데이터 계약만 제공한다.
- 실제 날씨 API는 후속 단계에서 연결한다.

## 3. 성공 기준

Task 4.5의 성공 조건은 다음과 같다.

1. 여행 서재와 여행 내부가 서로 다른 목적의 Shell로 명확히 구분된다.
2. 여행 내부 첫 화면에서 3초 안에 목적지, 출발 시간, 다음 이동, 예약을 파악할 수 있다.
3. Light·Dark가 단순 색상 반전이 아니라 각각 완성된 테마로 보인다.
4. 기존 종이색·glass·잡지형 표현이 남지 않는다.
5. 모바일에서 하단 4탭으로 주요 화면에 한 번에 이동한다.
6. 데스크톱에서는 모바일 화면을 늘리지 않고 navigation rail과 넓은 콘텐츠 영역을 사용한다.
7. Task 1~4의 인증과 기기 연결 기능이 그대로 동작한다.
8. Task 5 이후 실제 데이터로 교체할 수 있도록 fixture와 UI가 분리된다.

## 4. 범위

### 4.1 포함

- 통합 디자인 token
- Light·Dark·System 테마
- 테마 저장과 System 변경 반영
- 여행 서재 Shell
- 여행 내부 Trip Shell
- 모바일 하단 4탭
- 데스크톱 navigation rail
- 여행 서재 완성형 UI
- 오늘 완성형 UI
- 일정 완성형 UI
- 지도 완성형 정적 preview UI
- 도구 완성형 UI
- 예정·여행 중·완료 상태 UI
- 로딩·빈 화면·오류·오프라인 상태
- 기존 기기 연결 UI의 새 디자인 적용
- 샘플 fixture와 view model 경계
- 단위 테스트, 접근성 검사, 빌드 검증

### 4.2 제외

- 실제 여행 생성·수정·삭제·복구 API
- 실제 일정·장소·예약·준비물·메모 mutation
- 실제 날씨 API
- 실제 지출 입력·정산
- 실시간 교통·이동시간
- 실제 MapLibre 지도 interaction
- IndexedDB outbox와 15초 동기화
- 기존 시드니 콘텐츠의 D1 import
- Cloudflare production 리소스 생성
- `main` 병합과 production 배포

## 5. 정보 구조

### 5.1 전역 구조

```text
우리만의 여행 가이드북
├─ 여행 서재
│  ├─ 여행 상태 filter
│  ├─ 여행 카드
│  ├─ 새 여행 만들기
│  └─ 테마 선택
└─ 선택한 여행
   ├─ 오늘
   ├─ 일정
   ├─ 지도
   └─ 도구
```

### 5.2 여행 내부 보조 기능

`도구`는 기능 창고처럼 나열하지 않고 3개 그룹으로 구성한다.

#### Travel Essentials

- 예약·바우처
- 환율
- 교통
- 비상 연락처

#### Places

- 맛집
- 카페
- 저장 장소

#### Planning & Settings

- 체크리스트
- 여행 메모
- 주의사항
- 파트너 연결
- 연결 기기 관리
- 테마
- 오프라인·동기화 상태

## 6. 라우팅

### 6.1 확정 경로

```text
/library
/trip/:tripId/today
/trip/:tripId/schedule
/trip/:tripId/map
/trip/:tripId/tools
/pair
```

### 6.2 기본 이동

- 앱 root는 `/library`로 이동한다.
- 여행 카드 선택은 `/trip/:tripId/today`로 이동한다.
- 여행 내부 헤더의 뒤로 가기는 `/library`로 이동한다.
- 여행 내부 Header의 여행지 label을 누르면 compact trip switcher를 연다.
- `/pair`는 기존 1회용 초대 token 처리 흐름을 유지한다.
- 존재하지 않는 여행 ID는 오류 화면 후 여행 서재 이동 액션을 제공한다.

## 7. 프런트엔드 구조

### 7.1 Shell

```text
App
├─ ThemeProvider
├─ LibraryShell
│  └─ LibraryPage
├─ TripShell
│  ├─ TripHeader
│  ├─ TripOutlet
│  └─ TripNavigation
└─ PairDevicePage
```

### 7.2 책임

#### `ThemeProvider`

- `light`, `dark`, `system` 선택을 관리한다.
- 사용자 선택값을 `localStorage`에 저장한다.
- System 선택 시 `prefers-color-scheme` 변경을 구독한다.
- `<html data-theme>`과 PWA `theme-color`를 동기화한다.

#### `LibraryShell`

- 제품명과 여행 서재 context를 표시한다.
- 여행 내부 navigation을 렌더링하지 않는다.
- 테마 선택과 새 여행 액션을 제공한다.

#### `TripShell`

- 선택한 여행 context를 제공한다.
- 모바일에서는 하단 4탭을 표시한다.
- 데스크톱에서는 navigation rail을 표시한다.
- 여행 서재 이동과 여행 전환 액션을 제공한다.

#### 화면 컴포넌트

- 데이터 요청이나 mutation 로직을 직접 소유하지 않는다.
- view model을 받아 화면을 조립한다.
- 로딩·빈 화면·오류·오프라인 상태를 명시적으로 렌더링한다.

## 8. 데이터 경계

Task 4.5의 샘플 데이터가 후속 API 구현과 섞이지 않도록 provider 경계를 둔다.

```ts
export interface TravelGuideDataSource {
  listTrips(): Promise<TripSummaryViewModel[]>;
  getTripContext(tripId: string): Promise<TripContextViewModel>;
  getToday(tripId: string): Promise<TodayViewModel>;
  getSchedule(tripId: string): Promise<ScheduleViewModel>;
  getMapPreview(tripId: string): Promise<MapPreviewViewModel>;
  getTools(tripId: string): Promise<ToolsViewModel>;
}
```

### 8.1 Task 4.5

- `FixtureTravelGuideDataSource`를 사용한다.
- 기존 시드니 콘텐츠와 Meriton Sussex Street 등 실제 여행 context를 대표 샘플로 사용한다.
- 샘플 데이터는 UI 파일에 직접 하드코딩하지 않는다.

### 8.2 후속 Task

- Task 5 이후 `ApiTravelGuideDataSource`를 구현한다.
- 화면 컴포넌트의 구조는 유지하고 provider만 교체한다.
- 실제 API가 아직 없는 기능은 클릭 시 성공한 것처럼 가장하지 않는다.
- 비활성 기능은 `준비 중` 상태 또는 preview 설명을 제공한다.

## 9. 테마 시스템

### 9.1 Mode

- Light
- Dark
- System

기본값은 `System`이다.

```js
localStorage.setItem("theme", "light" | "dark" | "system");
```

```js
document.documentElement.dataset.theme = resolvedTheme;
```

### 9.2 Light token

```css
:root[data-theme="light"] {
  color-scheme: light;

  --bg: #F6F7F8;
  --bg-elevated: #FFFFFF;
  --bg-muted: #EEF2F4;

  --surface: #FFFFFF;
  --surface-2: #F8FAFB;
  --surface-3: #EEF3F5;

  --text: #14212B;
  --text-2: #43515D;
  --text-3: #73808C;
  --text-on-accent: #FFFFFF;

  --line: #DCE4E8;
  --line-soft: #E9EEF1;

  --accent: #0C7892;
  --accent-strong: #0A647A;
  --accent-soft: #DDF4F8;

  --warm: #F08A5D;
  --warm-soft: #FFF0E8;

  --success: #1D8F6A;
  --success-soft: #E6F6F0;

  --warning: #E7A23A;
  --danger: #D95C5C;

  --shadow-card: 0 8px 24px rgba(17, 32, 43, 0.08);
  --shadow-soft: 0 2px 10px rgba(17, 32, 43, 0.05);
}
```

### 9.3 Dark token

```css
:root[data-theme="dark"] {
  color-scheme: dark;

  --bg: #081018;
  --bg-elevated: #0C1721;
  --bg-muted: #10202C;

  --surface: #0F1B26;
  --surface-2: #132330;
  --surface-3: #182B39;

  --text: #F4F8FB;
  --text-2: #C6D1D9;
  --text-3: #92A2AF;
  --text-on-accent: #FFFFFF;

  --line: #213646;
  --line-soft: #1B2D3A;

  --accent: #33C2D9;
  --accent-strong: #1AA6BE;
  --accent-soft: rgba(51, 194, 217, 0.16);

  --warm: #FF835E;
  --warm-soft: rgba(255, 131, 94, 0.14);

  --success: #38C98D;
  --success-soft: rgba(56, 201, 141, 0.16);

  --warning: #F2B84B;
  --danger: #F26A6A;

  --shadow-card: 0 10px 28px rgba(0, 0, 0, 0.28);
  --shadow-soft: 0 4px 16px rgba(0, 0, 0, 0.18);
}
```

### 9.4 색상 규칙

- accent는 active navigation, 핵심 CTA, 시간·경로 강조에 사용한다.
- warm은 출발 임박 등 시간 민감 상태에만 사용한다.
- success는 예약 완료와 저장 완료에 사용한다.
- warning과 danger는 텍스트 또는 아이콘을 함께 표시한다.
- dark theme에서 cyan을 장식용 neon으로 사용하지 않는다.
- pure black과 pure white 대면적 배경을 사용하지 않는다.

## 10. Typography

```css
--font-body:
  "Pretendard",
  "Inter",
  "Noto Sans KR",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

```css
--text-xs: 12px;
--text-sm: 13px;
--text-base: 15px;
--text-md: 16px;
--text-lg: 18px;
--text-xl: 22px;
--text-2xl: 28px;
--text-3xl: 40px;
```

규칙:

- 한국어 본문 line-height는 1.5~1.6이다.
- headline은 두 줄 이내다.
- 영어 micro label은 필요한 곳에만 uppercase를 사용한다.
- 장소명, 시간, 금액, 행동을 설명보다 먼저 보여준다.
- 시간과 금액에는 tabular numeral을 사용한다.

## 11. Spacing·Radius·Depth

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

```css
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-xl: 22px;
--radius-pill: 999px;
```

규칙:

- 메인 카드는 `18px` 또는 `22px` radius를 사용한다.
- 작은 도구 카드는 `14px`를 사용한다.
- 모든 요소를 pill로 만들지 않는다.
- 그림자보다 border와 surface 단계로 위계를 만든다.
- glass backdrop blur를 사용하지 않는다.
- 장식용 gradient를 사용하지 않는다.
- 대표 이미지의 텍스트 가독성을 위한 제한적 overlay는 허용한다.

## 12. 여행 서재 화면

### 12.1 Header

- 제품명 `우리만의 여행 가이드북`
- 화면 제목 `여행 서재`
- 짧은 설명
- Theme selector
- 사용자·기기 관리 진입점

### 12.2 Status filter

- 전체
- 예정
- 여행 중
- 완료

filter는 한 줄 segmented control 또는 compact tabs로 제공한다.

### 12.3 여행 카드

필수 정보:

- 작은 대표 이미지
- 국가·도시
- 여행 제목
- 시작일·종료일
- 인원
- 상태
- D-day 또는 진행 Day
- 예정 일정 수
- 예약 수
- 최근 수정 시간

행동:

- 카드 선택 → 해당 여행 Today
- overflow menu → 수정·휴지통
- Task 4.5에서는 수정·휴지통을 실제로 처리하지 않고 준비 상태를 명시한다.

### 12.4 새 여행

- 카드 목록 뒤에 dashed border action을 제공한다.
- Task 4.5에서는 실제 생성 form을 연결하지 않는다.
- 클릭 시 Task 5에서 제공될 기능임을 명확하게 안내한다.

### 12.5 Navigation

- 여행 서재에는 여행 내부 하단 navigation을 표시하지 않는다.

## 13. 여행 내부 Header와 Navigation

### 13.1 Header

표시:

- 여행지
- Day count
- 현지 날짜
- 여행 서재로 돌아가기
- 여행 전환
- 사용자 또는 partner 상태

예시:

```text
SYDNEY · DAY 03
2026년 9월 12일 토요일
```

### 13.2 모바일 Bottom Navigation

1. 오늘
2. 일정
3. 지도
4. 도구

규칙:

- icon과 label을 함께 표시한다.
- active tab은 accent surface와 text로 강조한다.
- `aria-current="page"`를 사용한다.
- 최소 터치 영역은 44px다.
- safe area를 포함한다.
- blur 기반 floating glass bar를 사용하지 않는다.

### 13.3 데스크톱 Navigation Rail

- 동일한 4개 항목을 좌측 rail에 표시한다.
- 콘텐츠 최대 폭은 약 1180px다.
- Task 4.5에서는 navigation rail과 중앙 dashboard만 사용한다.
- 우측 contextual panel은 후속 기능에서 필요성이 확인될 때 별도 설계한다.
- 모바일 카드를 단순 확대하지 않는다.

## 14. 오늘 화면

### 14.1 공통 우선순위

1. 오늘 목적지 또는 여행 상태
2. 다음 이동
3. 예약
4. 예산 preview
5. 오늘 일정
6. 빠른 도구

### 14.2 여행 전

- D-day
- 첫날 headline
- 첫날 sample weather context
- 첫 일정 또는 공항 이동
- 확인 필요한 예약
- 미완료 준비물

### 14.3 여행 중

- 여행지 시간대의 오늘 날짜
- 오늘 목적지 headline
- 날씨 context
- 다음 이동과 출발 countdown
- 다음 예약
- 예산 preview
- 시간순 오늘 일정

### 14.4 여행 완료

- 여행 기간
- 방문 장소 수
- 완료 일정 수
- 마지막 대표 장면
- 일정 다시 보기
- 추억 기능은 Phase 3 예고만 제공한다.

### 14.5 Weather Context

Task 4.5 표시:

- 지역명
- 상태
- 기온
- UV 지수
- `샘플` 또는 preview임을 개발 환경에서 식별 가능하게 한다.

실제 API 연결 전에는 최신 정보라고 표현하지 않는다.

### 14.6 Next Movement

표시:

- `NEXT UP`
- 출발 시간
- 출발까지 남은 시간
- 출발지와 목적지
- 교통수단
- 주요 정류장·환승
- 길찾기 액션

Task 4.5의 길찾기 액션은 기존 Google 지도 링크가 있을 때만 실제 링크를 연다.

### 14.7 Booking

- 장소
- 시간
- 종류
- 예약 상태
- 예약 상세 진입

예약번호 masking과 실제 booking data는 Task 9에서 연결한다.

### 14.8 Budget

- 오늘 지출
- 오늘 예산
- 사용률
- progress bar

Task 4.5에서는 sample fixture만 표시하며 입력과 수정 기능은 제공하지 않는다.

### 14.9 Today Schedule

- 시간
- 장소
- 한 줄 설명
- 이동·식사·관광·예약 상태
- 현재 또는 다음 일정 강조

## 15. 일정 화면

### 15.1 구성

- 날짜 selector
- Day summary
- 시간순 timeline
- 이동·식사·관광·예약·메모 구분
- 완료 여부
- 현재 날짜와 다음 일정 강조

### 15.2 Task 4.5 동작

- fixture 날짜 전환은 동작한다.
- fixture 일정 카드를 누르면 읽기 전용 상세 Bottom Sheet를 연다.
- Bottom Sheet에는 시간, 장소, 분류, 설명, 이동 정보, 예약 상태를 표시한다.
- 닫기 버튼, 바깥 영역 누르기, `Escape` 키로 닫을 수 있으며 열린 동안 focus를 내부에 유지한다.
- 실제 저장·순서 변경·완료 mutation은 제공하지 않는다.
- 수정 action은 Task 7 준비 상태를 명시한다.

## 16. 지도 화면

### 16.1 구성

- 검색
- 날짜 filter
- category filter
- 장소 상태 filter
- 정적 map preview
- route line과 marker
- 장소 bottom sheet
- 지도 불가 시 장소 list fallback

### 16.2 Task 4.5 동작

- 지도 형태의 정적 preview와 fixture marker를 표시한다.
- filter는 fixture 장소 목록에 반영한다.
- pan·zoom·geolocation·실제 map tile은 연결하지 않는다.
- 실제 MapLibre interaction은 Task 8에서 연결한다.

## 17. 도구 화면

### 17.1 Travel Essentials

- 예약·바우처
- 환율
- 교통
- 비상 연락처

### 17.2 Places

- 맛집
- 카페
- 저장 장소

### 17.3 Planning & Settings

- 체크리스트
- 여행 메모
- 주의사항
- AI 앱 연결
- 테마
- 오프라인 상태

### 17.4 Device Management

- 관리자는 새 10분 초대 생성, QR·링크 확인, 연결 기기 조회·해제를 할 수 있다.
- 파트너는 기기 관리가 관리자 전용임을 확인한다.
- 기존 Task 4의 API와 보안 경계를 변경하지 않는다.
- UI만 새 token과 component 규칙으로 교체한다.

## 18. 상태와 오류

모든 주요 화면은 다음 상태를 가진다.

### Loading

- skeleton을 제한적으로 사용한다.
- 실제 정보처럼 보이는 임의 숫자를 표시하지 않는다.

### Empty

- 빈 이유를 한 문장으로 설명한다.
- 가능한 다음 행동을 하나 제공한다.

### Error

- 오류 원인과 재시도 action을 제공한다.
- 인증 만료는 일반 오류와 구분한다.

### Offline

- 현재 오프라인임을 text와 icon으로 표시한다.
- 마지막 저장 시각을 표시할 수 있다.
- Task 4.5에서는 실제 IndexedDB 변경 queue를 구현하지 않는다.

### Session expired

- 작성 중인 내용 보존 안내를 위한 UI 영역을 예약한다.
- 관리자는 재로그인, 파트너는 새 초대 필요 여부를 안내한다.

## 19. Content Style

원칙:

- Direct
- Helpful
- Concrete
- Calm
- Practical

사용:

```text
출발 18분 전
본다이 구역 저장됨
예약 시간 12:00
오프라인에서 확인 가능
첫날 일정 미리보기
```

사용하지 않음:

```text
완벽한 시드니 여행
꿈같은 하루가 시작됩니다
잊지 못할 특별한 경험
당신만을 위한 완벽한 가이드
```

## 20. Motion

```css
--motion-fast: 120ms;
--motion-base: 180ms;
--motion-sheet: 220ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
```

허용:

- fade
- 짧은 slide-up
- 작은 scale
- progress transition
- bottom sheet transition

사용하지 않음:

- bounce
- 긴 parallax
- heavy glow
- decorative loop

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 21. 접근성

- WCAG 기준 명도 대비를 확보한다.
- dark theme secondary text를 명확하게 식별할 수 있어야 한다.
- 터치 target은 최소 44px다.
- 색상만으로 상태를 전달하지 않는다.
- icon button에 `aria-label`을 제공한다.
- active tab에 `aria-current="page"`를 사용한다.
- keyboard focus를 숨기지 않는다.
- 오류·경고를 text로 표시한다.
- screen reader에 loading·offline·sync 상태를 전달한다.
- 대표 이미지에는 의미 있는 alt 또는 decorative 처리를 적용한다.

## 22. 반응형

### Mobile

- 기준 폭 390~430px
- 단일 column
- 좌우 padding 16px
- 카드 간격 12~16px
- 여행 내부 fixed bottom navigation
- safe area 대응

### Tablet

- 일부 summary 카드 2열
- 일정과 detail 또는 지도와 list split view 가능
- navigation은 bottom bar 또는 rail 중 viewport에 맞는 하나만 표시

### Desktop

- 최대 폭 약 1180px
- 좌측 navigation rail
- 중앙 dashboard
- Task 4.5에서는 우측 panel 없이 중앙 콘텐츠의 단일·2열 grid로 구성
- 여행 서재는 실용형 카드 grid

## 23. PWA

- 기존 PWA manifest와 service worker를 유지한다.
- 제품명은 `우리만의 여행 가이드북`으로 표시한다.
- theme에 따라 `theme-color`를 변경한다.
- install prompt는 여행 서재 또는 도구에 배치한다.
- 하단 navigation과 install UI가 겹치지 않아야 한다.
- Task 4.5에서는 production install QA를 완료 조건으로 삼지 않는다.

## 24. 테스트

### 24.1 Theme

- 기본값이 System이다.
- Light·Dark 선택을 저장한다.
- System 선택 시 OS theme 변경을 반영한다.
- `<html data-theme>`과 `theme-color`가 동기화된다.

### 24.2 Routing

- root가 여행 서재로 이동한다.
- 여행 선택 시 해당 Today로 이동한다.
- 여행 내부 4탭이 올바른 경로로 이동한다.
- 여행 서재에는 여행 내부 navigation이 없다.
- 현재 tab에 `aria-current="page"`가 있다.

### 24.3 Today states

- 예정 여행은 D-day와 첫날 preview를 표시한다.
- 여행 중은 여행지 시간대 기준 Today를 표시한다.
- 완료 여행은 summary를 표시한다.

### 24.4 Schedule detail

- fixture 일정 카드를 누르면 읽기 전용 상세 Bottom Sheet가 열린다.
- 닫기 버튼, 바깥 영역 누르기, `Escape` 키로 닫힌다.
- Bottom Sheet가 열리면 keyboard focus가 내부로 이동하고 닫히면 원래 일정 카드로 돌아온다.
- 수정·저장·완료 mutation은 노출하지 않는다.

### 24.5 Fixture boundary

- 화면 컴포넌트가 fixture 파일을 직접 import하지 않는다.
- data source를 교체해도 동일 view model을 렌더링한다.

### 24.6 Regression

- 관리자와 파트너 principal 구분이 유지된다.
- 초대 생성·claim·만료·재사용 차단 test가 유지된다.
- 연결 기기 조회·해제가 유지된다.
- pair token이 주소에서 제거된다.

### 24.7 전체 검증

```bash
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
```

모든 명령은 exit code `0`이어야 한다.

## 25. 구현 파일 경계

권장 구조:

```text
src/
  app/
    App.tsx
    routes.tsx
    theme/
  layouts/
    LibraryShell.tsx
    TripShell.tsx
  pages/
    library/
    today/
    schedule/
    map/
    tools/
  components/
    navigation/
    status/
    cards/
  data/
    contracts.ts
    fixture/
  features/
    auth/
  styles/
    tokens.css
    base.css
    layout.css
    components.css
```

규칙:

- 화면은 업무 로직을 소유하지 않는다.
- 공통 컴포넌트는 실제 두 곳 이상에서 사용할 때 만든다.
- CSS 파일 하나에 모든 화면을 넣지 않는다.
- Task 1~4의 Worker 파일은 Task 4.5에서 기능 변경하지 않는다.

## 26. Task 4.5 완료 조건

### Design

- [ ] 여행 서재가 승인 목업 방향과 일치한다.
- [ ] Today Light가 승인 목업 방향과 일치한다.
- [ ] Today Dark가 승인 목업 방향과 일치한다.
- [ ] 일정·지도·도구가 같은 디자인 언어를 사용한다.
- [ ] 종이색·glass·잡지형 잔재가 없다.

### UX

- [ ] 여행 서재에는 여행 내부 4탭이 없다.
- [ ] 여행 선택 후 4탭이 표시된다.
- [ ] Today 핵심 정보를 3초 안에 파악할 수 있다.
- [ ] 예정·여행 중·완료 상태가 구분된다.
- [ ] 일정 카드에서 읽기 전용 상세 Bottom Sheet를 열고 닫을 수 있다.
- [ ] Light·Dark·System 설정이 저장된다.

### Technical

- [ ] Worker·D1·인증·pairing 동작이 유지된다.
- [ ] fixture와 UI가 data source로 분리된다.
- [ ] 모바일 390px에서 가로 넘침이 없다.
- [ ] desktop navigation rail이 동작한다.
- [ ] reduced motion과 keyboard focus를 지원한다.
- [ ] test·Worker test·typecheck·lint·build가 통과한다.

## 27. 후속 작업 순서

Task 4.5가 승인·검증된 뒤 기존 계획으로 복귀한다.

1. Task 5 — 여행 서재 CRUD와 30일 휴지통
2. Task 6 — snapshot, 멱등 mutation, version conflict
3. Task 7 — 날짜별 일정과 실제 Today
4. Task 8 — 장소, MapLibre 지도, 커플 투표
5. Task 9 — 예약 편집과 예약번호 보호
6. Task 10 — 준비물, 메모, 검색, 활동 기록
7. Task 11 — IndexedDB outbox와 15초 sync
8. Task 12 — AI 앱 연결, 환율, 기존 시드니 데이터 import
9. Task 13 — E2E, 실기기 QA, Cloudflare 승인 gate와 배포

## 28. 최종 정의

`우리만의 여행 가이드북`은 여러 여행을 보관하는 커플 여행 PWA다.

여행 서재에서는 다음 여행을 선택하고, 여행 내부에서는 Trip Control을 통해 오늘 해야 할 일, 다음 이동, 예약, 일정, 지도, 도구를 빠르게 실행한다.

Task 4.5는 이 제품 구조를 실제 UI 코드로 확정하는 단계이며, 실제 여행 데이터 기능을 앞당겨 구현하는 단계가 아니다.
