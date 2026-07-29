# Trip Control UI Task 4.5 Implementation Plan

> **2026-07-28 상태: 완료 (`c47f67f`).** 아래 미체크 항목은 승인 당시 실행 명세를 보존한 것이며 재실행 대상이 아니다. 현재 후속 작업은 `2026-07-28-couple-travel-guide-continuation.md`를 따른다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Task 1~4의 인증·기기 연결 기능을 보존하면서 `우리만의 여행 가이드북`을 승인된 Trip Control 디자인의 여행 서재와 여행 내부 4개 화면으로 교체한다.

**Architecture:** React 19 단일 페이지 앱의 브라우저 History 라우팅을 유지보수 가능한 경로 모델로 교체하고, `LibraryShell`과 `TripShell`을 분리한다. 화면은 `TravelGuideDataSource`가 제공하는 view model만 사용하며 Task 4.5에서는 비동기 fixture 구현체를 주입한다. Worker·D1·pairing API는 변경하지 않고 기존 React pairing UI만 새 디자인 시스템 안에 배치한다.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, CSS custom properties, vite-plugin-pwa

## Global Constraints

- Node.js 버전은 `>=24`를 유지한다.
- 제품명은 `우리만의 여행 가이드북`, 여행 내부 디자인 방향명은 `Trip Control`로 유지한다.
- 확정 경로는 `/library`, `/trip/:tripId/today`, `/trip/:tripId/schedule`, `/trip/:tripId/map`, `/trip/:tripId/tools`, `/pair`다.
- 여행 서재에는 여행 내부 4탭을 표시하지 않는다.
- 여행 내부 모바일에는 `오늘·일정·지도·도구` 하단 4탭, 데스크톱에는 같은 항목의 navigation rail을 표시한다.
- Task 4.5의 날씨·예산·일정·지도 데이터는 sample fixture이며 최신 실데이터처럼 표현하지 않는다.
- 실제 여행 CRUD, 일정 mutation, 실제 지도 interaction, 실제 날씨 API, 실제 지출 입력·정산은 구현하지 않는다.
- Worker, D1 schema, 인증, principal 권한, 10분 1회용 pairing token 동작은 변경하지 않는다.
- 화면 컴포넌트는 fixture 파일을 직접 import하지 않는다.
- 화면 문구는 direct·helpful·concrete·calm·practical 원칙을 따르며 과장된 여행 홍보 문구를 사용하지 않는다.
- 새로운 런타임·개발 dependency를 추가하지 않는다.
- 모바일 최소 폭은 `320px`, 디자인 검증 폭은 `390px`, `430px`, 데스크톱 콘텐츠 최대 폭은 약 `1180px`다.
- 터치 target은 최소 `44px`, 일반 텍스트 대비는 최소 `4.5:1`, 큰 텍스트와 UI 경계는 최소 `3:1`을 만족한다.
- `prefers-reduced-motion: reduce`, keyboard focus, `aria-current="page"`, dialog focus 복귀를 지원한다.
- `main` merge(병합), production resource 생성, deploy(배포)는 Task 4.5 범위에 포함하지 않는다.

---

## File Map

### App foundation

- `src/app/App.tsx`: route에 따라 여행 서재, 여행 내부, pairing, 오류 화면을 조합한다.
- `src/app/TripRoutePage.tsx`: 선택한 trip workspace를 불러오고 active tab 화면을 TripShell 안에 렌더링한다.
- `src/app/router.tsx`: pathname 파싱, URL 생성, History 이동, pair token 제거를 담당한다.
- `src/components/AppLink.tsx`: 내부 경로를 전체 새로고침 없이 History로 이동한다.
- `src/app/theme/ThemeProvider.tsx`: Light·Dark·System 선택, 저장, OS theme 구독, DOM 반영을 담당한다.
- `src/app/theme/theme.ts`: theme 해석과 DOM 적용의 순수 함수를 제공한다.
- `src/app/theme/types.ts`: theme 공용 타입을 정의한다.
- `src/app/theme/ThemeControl.tsx`: 3개 theme 선택 UI를 제공한다.
- `src/main.tsx`: 전역 CSS와 앱 mount만 담당한다.

### Data boundary

- `src/data/contracts.ts`: 화면이 소비하는 view model과 `TravelGuideDataSource` 계약을 정의한다.
- `src/data/fixture/fixtureDataSource.ts`: Task 4.5 sample data 구현체를 제공한다.
- `src/data/useTravelData.ts`: library와 trip workspace의 loading·ready·empty·error 상태를 관리한다.

### Layouts and shared UI

- `src/layouts/LibraryShell.tsx`: 제품 header와 library content 영역을 제공하며 trip navigation은 렌더링하지 않는다.
- `src/layouts/TripShell.tsx`: trip header, trip switcher, mobile bottom navigation, desktop rail을 제공한다.
- `src/components/Icon.tsx`: 장식용 emoji 대신 일관된 inline SVG icon을 제공한다.
- `src/components/BottomSheet.tsx`: 일정·장소 상세가 공유하는 dialog, focus trap, focus 복귀를 담당한다.
- `src/components/StatusPanel.tsx`: loading·empty·error·not-found·session-expired 상태를 제공한다.
- `src/components/OfflineBanner.tsx`: 브라우저 online 상태를 접근성 있게 알린다.

### Pages

- `src/pages/library/LibraryPage.tsx`: 상태 filter와 실용형 여행 카드 grid를 렌더링한다.
- `src/pages/today/TodayPage.tsx`: 예정·여행 중·완료 hero와 Today dashboard를 렌더링한다.
- `src/pages/today/TodayCards.tsx`: weather, movement, booking, budget 카드를 담당한다.
- `src/pages/schedule/SchedulePage.tsx`: 날짜 selector와 일정 timeline을 렌더링한다.
- `src/pages/schedule/ScheduleDetailSheet.tsx`: 읽기 전용 일정 상세 Bottom Sheet와 focus trap을 담당한다.
- `src/pages/map/MapPage.tsx`: filter, 정적 SVG map preview, 장소 list fallback을 렌더링한다.
- `src/pages/map/MapPlaceSheet.tsx`: 선택한 장소의 읽기 전용 상세를 렌더링한다.
- `src/pages/tools/ToolsPage.tsx`: 3개 도구 그룹과 기존 pairing 관리를 렌더링한다.

### Styles

- `src/styles/tokens.css`: 승인된 Light·Dark token과 spacing, radius, shadow를 정의한다.
- `src/styles/base.css`: reset, typography, focus, reduced motion을 정의한다.
- `src/styles/layout.css`: LibraryShell, TripShell, responsive grid를 정의한다.
- `src/styles/components.css`: button, card, chip, status, dialog 공통 스타일을 정의한다.
- `src/styles/navigation.css`: mobile bottom navigation과 desktop rail만 정의한다.
- `src/styles/library.css`, `today.css`, `schedule.css`, `map.css`, `tools.css`: 각 화면 전용 스타일을 분리한다.
- `src/styles/pairing.css`: 기존 pairing UI를 Trip Control token에 맞춘다.

### Retired preview files

- `src/app/AppShell.tsx`, `src/app/AppShell.test.tsx`, `src/app/PreviewPage.tsx`: 새 Shell과 실제 화면 연결이 끝난 뒤 삭제한다.

---

### Task 1: Light·Dark·System Theme Foundation

**Files:**

- Create: `src/app/theme/types.ts`
- Create: `src/app/theme/theme.ts`
- Create: `src/app/theme/ThemeProvider.tsx`
- Create: `src/app/theme/ThemeControl.tsx`
- Create: `src/app/theme/theme.test.tsx`
- Modify: `src/app/App.tsx:1-18`
- Modify: `src/styles/tokens.css:1-16`
- Modify: `src/styles/base.css:1-58`
- Modify: `src/main.tsx:1-16`
- Modify: `src/test/setup.ts:1-8`

**Interfaces:**

- Produces: `ThemePreference = "light" | "dark" | "system"`
- Produces: `ResolvedTheme = "light" | "dark"`
- Produces: `ThemeProvider`, `useTheme(): ThemeContextValue`, `ThemeControl`
- Produces: `resolveTheme(preference, systemDark)`, `applyResolvedTheme(resolvedTheme)`
- Consumes: `<meta name="theme-color">` from `index.html`

- [ ] **Step 1: Write failing theme tests**

```tsx
const themeListeners = new Set<(event: MediaQueryListEvent) => void>();
const matchMediaMock = {
  matches: false,
  media: "(prefers-color-scheme: dark)",
  onchange: null,
  addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
    themeListeners.add(listener),
  removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
    themeListeners.delete(listener),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn()
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => matchMediaMock));
});

describe("ThemeProvider", () => {
  it("uses system by default and applies the resolved theme", () => {
    matchMediaMock.matches = true;
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByText("system/dark")).toBeVisible();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("stores an explicit choice and updates theme-color", async () => {
    render(<ThemeProvider><ThemeControl /></ThemeProvider>);
    await userEvent.click(screen.getByRole("radio", { name: "라이트" }));
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]'))
      .toHaveAttribute("content", "#F6F7F8");
  });

  it("follows OS changes while System is selected", () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    act(() => {
      for (const listener of themeListeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/theme/theme.test.tsx
```

Expected: FAIL because `ThemeProvider`, `ThemeControl`, and theme functions do not exist.

- [ ] **Step 3: Implement exact theme types and pure functions**

```ts
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#F6F7F8",
  dark: "#081018"
};

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean
): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}
```

`applyResolvedTheme()`는 `<html data-theme>`와 `meta[name="theme-color"]`를 같은 resolved theme으로 갱신한다. 저장값이 세 허용값에 포함되지 않으면 `system`을 반환한다.

- [ ] **Step 4: Implement provider and segmented theme control**

`ThemeProvider`는 `matchMedia("(prefers-color-scheme: dark)")`의 `change` 이벤트를 구독하고 unmount 시 해제한다. `ThemeControl`은 `fieldset`과 세 radio를 사용하며 label은 `라이트`, `다크`, `시스템`으로 고정한다.

```ts
export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}
```

- [ ] **Step 5: Replace paper theme tokens and base typography**

`tokens.css`에 설계서의 `--bg`, `--surface`, `--text`, `--line`, `--accent`, `--warm`, `--success`, `--warning`, `--danger`, `--shadow-card`, `--shadow-soft` 값을 Light와 Dark 각각 그대로 정의한다. 공통 token은 아래로 고정한다.

```css
:root {
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 22px;
  --radius-pill: 999px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 28px;
  --text-3xl: 40px;
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-sheet: 220ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --mobile-nav-height: 72px;
}
```

`base.css`에서 Georgia, paper background, `--teal` 계열을 제거하고 `"Pretendard", "Inter", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`와 새 token을 사용한다. 한국어 본문 line-height는 `1.5~1.6`, 시간·금액은 `font-variant-numeric: tabular-nums`를 적용한다. reduced motion 규칙에 `animation-duration`, `animation-iteration-count`, `transition-duration`, `scroll-behavior`를 모두 포함한다.

`App.tsx`는 기존 route 내용을 private `AppContent`로 옮기고 public `App`이 `<ThemeProvider><AppContent /></ThemeProvider>`를 반환하게 한다. 모든 route와 `/pair`가 같은 theme을 사용하며 개별 test에서 provider를 반복하지 않는다.

`src/test/setup.ts`에는 jsdom 기본값으로 `window.matchMedia` mock을 추가한다. `matches`는 `false`, `addEventListener`, `removeEventListener`, `addListener`, `removeListener`, `dispatchEvent`는 no-op mock으로 정의해 theme을 사용하지 않는 기존 test도 깨지지 않게 한다.

- [ ] **Step 6: Run tests and static checks**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/theme/theme.test.tsx
npm run typecheck
npm run lint
```

Expected: all PASS with exit code `0`.

- [ ] **Step 7: Commit**

```bash
git add src/app/App.tsx src/app/theme src/styles/tokens.css src/styles/base.css src/main.tsx src/test/setup.ts
git commit -m "feat: add Trip Control theme system"
```

---

### Task 2: View Model Contract and Fixture Data Source

**Files:**

- Create: `src/data/contracts.ts`
- Create: `src/data/fixture/fixtureDataSource.ts`
- Create: `src/data/fixture/fixtureDataSource.test.ts`
- Reuse assets: `public/images/sydney_harbour_bridge.jpg`, `public/images/bondi_beach.jpg`, `public/images/blue_mountains.jpg`

**Interfaces:**

- Produces: `TripSummaryViewModel`, `TripContextViewModel`, `TodayViewModel`, `ScheduleViewModel`, `MapPreviewViewModel`, `ToolsViewModel`, `TripWorkspace`
- Produces: `TravelGuideDataSource`, `FixtureTravelGuideDataSource`, `fixtureTravelGuideDataSource`
- Consumed later by: `App`, `LibraryPage`, `TodayPage`, `SchedulePage`, `MapPage`, `ToolsPage`

- [ ] **Step 1: Define the exact screen-facing contract**

```ts
export type TripPhase = "upcoming" | "active" | "completed";
export type ScheduleKind =
  | "movement"
  | "meal"
  | "attraction"
  | "booking"
  | "note";

export interface TripSummaryViewModel {
  id: string;
  title: string;
  country: string;
  destination: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  phase: TripPhase;
  coverImageUrl: string;
  travelerCount: number;
  bookingCount: number;
  updatedAt: string;
}

export interface TripContextViewModel {
  trip: TripSummaryViewModel;
  trips: TripSummaryViewModel[];
  localDate: string;
  dayLabel: string;
  viewer: {
    displayName: string;
    role: "owner" | "partner";
  };
  partnerStatus: "connected" | "not-connected";
}

export interface ScheduleItemView {
  id: string;
  startsAt: string;
  endsAt: string | null;
  title: string;
  place: string;
  description: string;
  kind: ScheduleKind;
  travelMode: "walk" | "transit" | "drive" | "ferry" | null;
  travelNote: string | null;
  bookingStatus: "confirmed" | "pending" | null;
  isDone: boolean;
  mapUrl: string | null;
}

export interface ScheduleDayView {
  date: string;
  dayLabel: string;
  headline: string;
  items: ScheduleItemView[];
}

export interface TodayViewModel {
  phase: TripPhase;
  localDate: string;
  dayLabel: string;
  greeting: string;
  headline: string;
  dDay: number | null;
  weather: {
    location: string;
    condition: string;
    temperatureC: number;
    uvIndex: number;
    isSample: true;
  };
  nextMovement: {
    departureTime: string;
    countdownLabel: string;
    origin: string;
    destination: string;
    mode: "walk" | "transit" | "drive" | "ferry";
    routeSummary: string;
    mapUrl: string | null;
  } | null;
  booking: {
    place: string;
    time: string;
    type: string;
    status: "confirmed" | "pending";
  } | null;
  budget: {
    spentAud: number;
    limitAud: number;
    isSample: true;
  };
  schedule: ScheduleItemView[];
  summary: {
    visitedPlaceCount: number;
    completedItemCount: number;
  } | null;
}

export interface MapPlaceView {
  id: string;
  name: string;
  category: "restaurant" | "cafe" | "attraction" | "lodging" | "transport";
  status: "saved" | "maybe" | "visited";
  dayDate: string;
  x: number;
  y: number;
  address: string;
  mapUrl: string | null;
}

export interface ScheduleViewModel {
  days: ScheduleDayView[];
}

export interface MapPreviewViewModel {
  places: MapPlaceView[];
}

export interface ToolItemView {
  id: string;
  label: string;
  description: string;
  status: "available" | "preview";
}

export interface ToolGroupView {
  id: "essentials" | "places" | "planning";
  title: "Travel Essentials" | "Places" | "Planning & Settings";
  items: ToolItemView[];
}

export interface ToolsViewModel {
  groups: ToolGroupView[];
}

export interface TripWorkspace {
  context: TripContextViewModel;
  today: TodayViewModel;
  schedule: ScheduleViewModel;
  mapPreview: MapPreviewViewModel;
  tools: ToolsViewModel;
}

export interface TravelGuideDataSource {
  listTrips(): Promise<TripSummaryViewModel[]>;
  getTripContext(tripId: string): Promise<TripContextViewModel | null>;
  getToday(tripId: string): Promise<TodayViewModel | null>;
  getSchedule(tripId: string): Promise<ScheduleViewModel | null>;
  getMapPreview(tripId: string): Promise<MapPreviewViewModel | null>;
  getTools(tripId: string): Promise<ToolsViewModel | null>;
}
```

- [ ] **Step 2: Write failing fixture contract tests**

```ts
it("returns multiple trips covering all three phases", async () => {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const trips = await dataSource.listTrips();
  expect(trips.map((trip) => trip.phase)).toEqual(
    expect.arrayContaining(["upcoming", "active", "completed"])
  );
});

it("returns a complete Sydney workspace through the data source", async () => {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const [context, today, schedule, mapPreview, tools] = await Promise.all([
    dataSource.getTripContext("sydney-2026"),
    dataSource.getToday("sydney-2026"),
    dataSource.getSchedule("sydney-2026"),
    dataSource.getMapPreview("sydney-2026"),
    dataSource.getTools("sydney-2026")
  ]);
  expect(context?.trip.id).toBe("sydney-2026");
  expect(today?.weather.isSample).toBe(true);
  expect(schedule?.days.length).toBeGreaterThan(1);
  expect(mapPreview?.places.length).toBeGreaterThan(2);
  expect(tools?.groups).toHaveLength(3);
});

it("returns null for an unknown trip", async () => {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  await expect(
    dataSource.getTripContext("missing")
  ).resolves.toBeNull();
});
```

- [ ] **Step 3: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/data/fixture/fixtureDataSource.test.ts
```

Expected: FAIL because the fixture implementation does not exist.

- [ ] **Step 4: Implement clock-injected sample trips**

Implement `FixtureTravelGuideDataSource implements TravelGuideDataSource` with `constructor(private readonly clock: () => Date = () => new Date())`. Create three trips with IDs `sydney-2026`, `bondi-weekend`, `blue-mountains-memory`. Relative to the injected clock, Sydney is active, Bondi is upcoming, and Blue Mountains is completed. `TripContextViewModel`과 `TodayViewModel`의 `localDate`, `dayLabel`, phase, D-day, active trip의 출발시각과 countdown은 injected clock과 각 trip의 IANA time zone으로 계산한다. Tests therefore stay deterministic while the default app reflects the actual destination date and time context.

The Sydney fixture includes Meriton Sussex Street, at least three schedule days, six schedule items, four map places, one confirmed booking, sample weather, sample AUD budget, and one Google Maps URL. Do not call weather, map tile, currency, or other network services.

`getTools()`는 정확히 세 group을 반환한다. Essentials는 예약·바우처, 환율, 교통, 비상 연락처; Places는 맛집, 카페, 저장 장소; Planning은 체크리스트, 여행 메모, 주의사항, AI 앱 연결, 파트너 연결, 연결 기기 관리, 테마, 오프라인·동기화 상태를 포함한다. Theme·offline·device management만 `available`, 나머지는 `preview`다.

The module exports only `FixtureTravelGuideDataSource` and its default instance `fixtureTravelGuideDataSource = new FixtureTravelGuideDataSource()`; pages receive the `TravelGuideDataSource` interface and never import this fixture module.

- [ ] **Step 5: Run tests and checks**

Run:

```bash
npx vitest run --config vitest.config.ts src/data/fixture/fixtureDataSource.test.ts
npm run typecheck
npm run lint
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data
git commit -m "feat: add Trip Control fixture data source"
```

---

### Task 3: Path Routing and Pair Token Compatibility

**Files:**

- Modify: `src/app/router.tsx:1-51`
- Create: `src/components/AppLink.tsx`
- Create: `src/app/router.test.tsx`
- Modify: `src/features/auth/pairing.test.tsx:1-118`

**Interfaces:**

- Produces: `TripTab`, `Route`, `parseRoute()`, `pathForTrip()`, `navigate()`, `useRoute()`, `AppLink`
- Preserves: `consumePairTokenFromUrl()`, `navigateToLibrary()`
- Consumed later by: `App`, `LibraryPage`, `TripShell`, `PairDevicePage`

- [ ] **Step 1: Write failing path-routing tests**

```tsx
function RouteProbe() {
  const route = useRoute();
  if (route.name !== "trip") return <span>{route.name}</span>;
  return <span>{`${route.name}/${route.tripId}/${route.tab}`}</span>;
}

it.each([
  ["/", { name: "root" }],
  ["/library", { name: "library" }],
  ["/trip/sydney-2026/today",
    { name: "trip", tripId: "sydney-2026", tab: "today" }],
  ["/trip/sydney-2026/schedule",
    { name: "trip", tripId: "sydney-2026", tab: "schedule" }],
  ["/trip/sydney-2026/map",
    { name: "trip", tripId: "sydney-2026", tab: "map" }],
  ["/trip/sydney-2026/tools",
    { name: "trip", tripId: "sydney-2026", tab: "tools" }],
  ["/pair", { name: "pair" }]
])("parses %s", (pathname, expected) => {
  expect(parseRoute(pathname)).toEqual(expected);
});

it("marks unknown paths as not found", () => {
  expect(parseRoute("/unknown")).toEqual({ name: "not-found" });
});

it("uses History navigation for an internal AppLink", async () => {
  window.history.replaceState(null, "", "/library");
  render(
    <>
      <AppLink href="/trip/sydney-2026/today">시드니 여행</AppLink>
      <RouteProbe />
    </>
  );
  await userEvent.click(screen.getByRole("link", { name: "시드니 여행" }));
  expect(screen.getByText("trip/sydney-2026/today")).toBeVisible();
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/router.test.tsx
```

Expected: FAIL because the current router only recognizes hash pages.

- [ ] **Step 3: Replace the page union with a discriminated route**

```ts
export type TripTab = "today" | "schedule" | "map" | "tools";
export type Route =
  | { name: "root" }
  | { name: "library" }
  | { name: "trip"; tripId: string; tab: TripTab }
  | { name: "pair" }
  | { name: "not-found" };

export function pathForTrip(tripId: string, tab: TripTab): string {
  return `/trip/${encodeURIComponent(tripId)}/${tab}`;
}

export function navigate(path: string, replace = false): void {
  window.history[replace ? "replaceState" : "pushState"](null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
```

`parseRoute()`는 `/`를 `{ name: "root" }`로 구분해 App이 `/library`로 replace할 수 있게 한다. Trailing slash 하나를 허용하고, `tripId`는 `decodeURIComponent()`로 복원한다. 잘못 인코딩된 ID는 `{ name: "not-found" }`를 반환한다. `useRoute()`는 `useSyncExternalStore()`의 snapshot으로 pathname string을 반환하고 `useMemo(() => parseRoute(pathname), [pathname])`로 route object를 만든다. Snapshot에서 새 object를 직접 만들지 않는다.

`AppLink`는 standard anchor props를 받고 `href`가 `/`로 시작하는 same-app path이며 좌클릭·modifier 없음·`target` 없음일 때만 `preventDefault()` 후 `navigate(href)`를 호출한다. 외부 URL, 새 탭, download, Ctrl·Cmd click은 browser 기본 동작을 유지한다. `navigate()`는 URL에 hash가 있으면 route render 다음 frame에 같은 ID를 찾아 `scrollIntoView({ block: "start" })`한다. Tasks 5~10의 내부 route link는 raw `<a>` 대신 `AppLink`를 사용한다.

- [ ] **Step 4: Preserve secure pair URL consumption**

`consumePairTokenFromUrl()`는 `/pair?token=...`에서 token을 메모리로 반환한 직후 주소를 `/pair`로 replace한다. `navigateToLibrary()`는 `/library`로 replace하고 기존 `PairDevicePage` 호출부를 그대로 지원한다.

기존 hash test는 다음 path test로 교체한다.

```tsx
it("keeps path navigation working after the pair redirect", () => {
  window.history.replaceState(null, "", "/library");
  render(<RouteProbe />);
  act(() => navigate("/trip/sydney-2026/tools"));
  expect(screen.getByText("trip/sydney-2026/tools")).toBeVisible();
});
```

- [ ] **Step 5: Run router and pairing regression tests**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/router.test.tsx src/features/auth/pairing.test.tsx
npm run typecheck
npm run lint
```

Expected: all PASS; pair token is absent from `window.location.search`.

- [ ] **Step 6: Commit**

```bash
git add src/app/router.tsx src/app/router.test.tsx src/components/AppLink.tsx src/features/auth/pairing.test.tsx
git commit -m "feat: add Trip Control path routing"
```

---

### Task 4: Async Resource and Status Components

**Files:**

- Create: `src/data/useTravelData.ts`
- Create: `src/data/useTravelData.test.tsx`
- Create: `src/components/StatusPanel.tsx`
- Create: `src/components/OfflineBanner.tsx`
- Create: `src/components/status.test.tsx`
- Modify: `src/styles/components.css:1-179`

**Interfaces:**

- Produces: `Loadable<T>`
- Produces: `useTravelLibrary(dataSource)`, `useTripWorkspace(dataSource, tripId)`
- Produces: `StatusPanel`, `OfflineBanner`
- Consumes: `TravelGuideDataSource`, `TripSummaryViewModel`, `TripWorkspace`

- [ ] **Step 1: Write failing async-state tests**

```tsx
function TripResourceProbe({
  dataSource,
  tripId
}: {
  dataSource: TravelGuideDataSource;
  tripId: string;
}) {
  const result = useTripWorkspace(dataSource, tripId);
  if (result.status !== "ready") return <span role="status">{result.status}</span>;
  return <span>{`ready:${result.data.context.trip.id}`}</span>;
}

it("moves a trip resource from loading to ready", async () => {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  render(<TripResourceProbe dataSource={dataSource} tripId="sydney-2026" />);
  expect(screen.getByRole("status")).toHaveTextContent("loading");
  expect(await screen.findByText("ready:sydney-2026")).toBeVisible();
});

it("distinguishes a missing trip from a request error", async () => {
  const nullSource: TravelGuideDataSource = {
    listTrips: async () => [],
    getTripContext: async () => null,
    getToday: async () => null,
    getSchedule: async () => null,
    getMapPreview: async () => null,
    getTools: async () => null
  };
  render(<TripResourceProbe dataSource={nullSource} tripId="missing" />);
  expect(await screen.findByText("empty")).toBeVisible();
});

it("reserves a distinct session-expired recovery state", () => {
  render(
    <StatusPanel
      kind="session-expired"
      title="세션이 만료되었습니다"
      description="작성 중인 내용은 이 화면에 보존됩니다."
      action={{ label: "다시 로그인", onClick: vi.fn() }}
    />
  );
  expect(screen.getByRole("alert")).toHaveTextContent("세션이 만료되었습니다");
  expect(screen.getByRole("button", { name: "다시 로그인" })).toBeVisible();
});
```

- [ ] **Step 2: Define the loadable state and hooks**

```ts
export type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "empty"; retry: () => void }
  | { status: "error"; message: string; retry: () => void };

export function useTravelLibrary(
  dataSource: TravelGuideDataSource
): Loadable<TripSummaryViewModel[]>;

export function useTripWorkspace(
  dataSource: TravelGuideDataSource,
  tripId: string
): Loadable<TripWorkspace>;
```

각 hook은 `retryGeneration` state와 effect cleanup flag를 사용한다. `retry()`는 generation을 증가시켜 같은 요청을 다시 실행하고, cleanup flag는 unmount 이후 state update를 차단한다. `useTripWorkspace()`는 `getTripContext()`, `getToday()`, `getSchedule()`, `getMapPreview()`, `getTools()`를 `Promise.all()`로 읽어 `TripWorkspace`로 조합한다. 결과 중 하나라도 `null`이면 `empty`, rejected promise는 `error`, 빈 library 배열은 `empty`로 변환한다.

- [ ] **Step 3: Implement accessible status UI**

`StatusPanel` props는 아래로 고정한다.

```ts
interface StatusPanelProps {
  kind: "loading" | "empty" | "error" | "not-found" | "session-expired";
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
```

loading은 `role="status"`와 `aria-live="polite"`, error와 session-expired는 `role="alert"`, 나머지는 heading과 설명을 사용한다. Error 사용처는 `retry`를 `다시 시도` action으로 연결한다. Session-expired는 작성 내용 보존 안내 영역, 관리자 `다시 로그인`, 파트너 `새 초대 요청` 설명을 렌더링할 수 있어야 한다. `OfflineBanner`는 `window`의 `online`·`offline` 이벤트를 구독하고 offline일 때만 `role="status"`로 `오프라인 — 저장된 샘플 정보를 표시합니다`를 보여준다.

- [ ] **Step 4: Replace old decorative component styling**

`components.css`에서 radial gradient, glass background, `backdrop-filter`, paper variables를 제거한다. `.surface-card`, `.primary-button`, `.secondary-button`, `.chip`, `.status-panel`, `.offline-banner`, `.sheet-backdrop`, `.sheet`를 새 token으로 정의한다. Pill radius는 status chip과 segmented control에만 사용하고 일반 button·card에는 `10px~22px`의 계층형 radius를 사용한다.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run --config vitest.config.ts src/data/useTravelData.test.tsx src/components/status.test.tsx
npm run typecheck
npm run lint
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/useTravelData.ts src/data/useTravelData.test.tsx src/components src/styles/components.css
git commit -m "feat: add travel data loading states"
```

---

### Task 5: Library Shell and Travel Library

**Files:**

- Create: `src/layouts/LibraryShell.tsx`
- Create: `src/pages/library/LibraryPage.tsx`
- Create: `src/pages/library/LibraryPage.test.tsx`
- Create: `src/styles/layout.css`
- Create: `src/styles/library.css`
- Modify: `src/app/App.tsx:1-18`
- Modify: `src/main.tsx:1-16`
- Delete after replacement: `src/app/AppShell.tsx`
- Delete after replacement: `src/app/AppShell.test.tsx`
- Delete after replacement: `src/app/PreviewPage.tsx`

**Interfaces:**

- Consumes: `TravelGuideDataSource`, `useTravelLibrary()`, `ThemeControl`, `navigate()`, `pathForTrip()`
- Produces: `LibraryShell`, `LibraryPage`
- App prop remains: `pairToken?: string | null`
- App adds optional prop: `dataSource?: TravelGuideDataSource`

- [ ] **Step 1: Write failing library behavior tests**

```tsx
it("shows practical trip cards without trip navigation", async () => {
  render(<LibraryPage dataSource={fixtureTravelGuideDataSource} />);
  expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
  expect(screen.getByRole("link", { name: /시드니 여행/ }))
    .toHaveAttribute("href", "/trip/sydney-2026/today");
  expect(screen.queryByRole("navigation", { name: "여행 메뉴" }))
    .not.toBeInTheDocument();
});

it("filters trips by status", async () => {
  render(<LibraryPage dataSource={fixtureTravelGuideDataSource} />);
  await userEvent.click(await screen.findByRole("button", { name: "예정" }));
  expect(screen.getByText("본다이 주말")).toBeVisible();
  expect(screen.queryByText("시드니 여행")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/library/LibraryPage.test.tsx
```

Expected: FAIL because the library page and shell do not exist.

- [ ] **Step 3: Implement `LibraryShell`**

Header content is limited to product name, `ThemeControl`, and existing `InstallPrompt`. The library page heading row provides `연결 기기` entry; trips가 준비된 뒤 첫 trip의 `/trip/{id}/tools#devices`로 연결한다. The content wrapper uses `max-width: 1180px`. No `TripNavigation`, bottom nav, or rail import is allowed in this file.

- [ ] **Step 4: Implement library filters and cards**

Filter values are `all`, `upcoming`, `active`, `completed`; visible labels are `전체`, `예정`, `여행 중`, `완료`. Each card displays cover image, country·city, trip title, date range, traveler count, Korean status text, booking count, recent update time. Card link target is always `pathForTrip(id, "today")`.

`새 여행 만들기`는 disabled button으로 표시하고 바로 아래 `실제 여행 만들기는 Task 5에서 연결됩니다` 설명을 제공한다. 클릭 가능한 가짜 CRUD를 만들지 않는다.

`useTravelLibrary()`의 loading은 숫자 없는 skeleton, empty는 `저장된 여행이 없습니다`와 `다시 불러오기` action 및 disabled 새 여행 안내, error는 `다시 시도` action이 있는 `StatusPanel`로 렌더링한다.

- [ ] **Step 5: Route App to the library**

```tsx
interface AppProps {
  pairToken?: string | null;
  dataSource?: TravelGuideDataSource;
}

function RootRedirect() {
  useEffect(() => navigateToLibrary(), []);
  return (
    <StatusPanel
      kind="loading"
      title="여행 서재로 이동 중"
      description="잠시만 기다려 주세요."
    />
  );
}

function AppContent({
  pairToken = null,
  dataSource = fixtureTravelGuideDataSource
}: AppProps) {
  const route = useRoute();
  if (route.name === "root") return <RootRedirect />;
  if (route.name === "pair") return <PairDevicePage token={pairToken} />;
  if (route.name === "library") {
    return (
      <LibraryShell>
        <LibraryPage dataSource={dataSource} />
      </LibraryShell>
    );
  }
  return (
    <StatusPanel
      kind="not-found"
      title="화면을 찾을 수 없습니다"
      description="주소를 확인하거나 여행 서재로 돌아가세요."
      action={{ label: "여행 서재로 이동", onClick: navigateToLibrary }}
    />
  );
}

export function App(props: AppProps) {
  return (
    <ThemeProvider>
      <AppContent {...props} />
    </ThemeProvider>
  );
}
```

App 연결 후 old preview files 세 개를 삭제한다.

- [ ] **Step 6: Add responsive library styles**

`main.tsx`에서 `layout.css`와 `library.css`를 import한다. 390px는 단일 column, 700px 이상은 2열, 1040px 이상은 3열이다. Cover는 `aspect-ratio: 16 / 9`, `object-fit: cover`; card 전체를 확대하지 않고 hover는 border·shadow만 미세하게 변경한다.

- [ ] **Step 7: Run tests and checks**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/library/LibraryPage.test.tsx
npm run typecheck
npm run lint
npm run build
```

Expected: all PASS; build output contains no missing import from retired preview files.

- [ ] **Step 8: Commit**

```bash
git add src/app/App.tsx src/main.tsx src/layouts/LibraryShell.tsx src/pages/library src/styles/layout.css src/styles/library.css
git add -u src/app/AppShell.tsx src/app/AppShell.test.tsx src/app/PreviewPage.tsx
git commit -m "feat: build the travel library"
```

---

### Task 6: Trip Shell, Header, Switcher, and Four-Tab Navigation

**Files:**

- Create: `src/components/Icon.tsx`
- Create: `src/app/TripRoutePage.tsx`
- Create: `src/layouts/TripShell.tsx`
- Create: `src/layouts/TripShell.test.tsx`
- Modify: `src/app/App.tsx`
- Replace: `src/styles/navigation.css:1-85`
- Modify: `src/styles/layout.css`

**Interfaces:**

- Consumes: `TripContextViewModel`, `TripTab`, `pathForTrip()`, `navigate()`, `ThemeControl`
- Produces: `IconName`, `Icon`, `TripShell`
- Produces: `TripRoutePage({ dataSource, tripId, activeTab })`
- `TripShell` props: `context`, `activeTab`, `children`

- [ ] **Step 1: Write failing Shell tests**

```tsx
async function renderTripShell(activeTab: TripTab) {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const context = await dataSource.getTripContext("sydney-2026");
  if (!context) throw new Error("fixture context missing");
  return render(
    <ThemeProvider>
      <TripShell context={context} activeTab={activeTab}>
        <p>여행 내용</p>
      </TripShell>
    </ThemeProvider>
  );
}

it("shows exactly four trip navigation items", async () => {
  await renderTripShell("today");
  const nav = screen.getByRole("navigation", { name: "여행 메뉴" });
  expect(within(nav).getAllByRole("link")).toHaveLength(4);
  expect(within(nav).getByRole("link", { name: "오늘" }))
    .toHaveAttribute("aria-current", "page");
});

it("opens a compact trip switcher from the trip label", async () => {
  await renderTripShell("schedule");
  await userEvent.click(screen.getByRole("button", { name: "여행 전환" }));
  expect(screen.getByRole("link", { name: /본다이 주말/ }))
    .toHaveAttribute("href", "/trip/bondi-weekend/today");
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/layouts/TripShell.test.tsx
```

Expected: FAIL because `TripShell` does not exist.

- [ ] **Step 3: Implement the shared SVG icon component**

`IconName`은 `library`, `today`, `schedule`, `map`, `tools`, `weather`, `movement`, `booking`, `budget`, `chevron`, `close`로 고정한다. `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">`를 사용하고 호출부가 label을 제공하므로 `aria-hidden="true"`를 기본값으로 한다. Unicode symbol과 emoji는 navigation icon으로 사용하지 않는다.

- [ ] **Step 4: Implement Trip header and compact switcher**

Header에 `/library` 뒤로가기, `DESTINATION · DAY NN`, 현지 날짜, viewer initials avatar, partner 연결 상태, `ThemeControl`을 표시한다. 여행지 label은 `button aria-label="여행 전환"`이며 `aria-expanded`와 `aria-controls="trip-switcher-menu"`를 갱신한다. Compact menu에는 전체 trip을 표시하고 각 목적지는 `/trip/{id}/today`로 연결한다. `Escape`, 바깥 영역 click, trip 선택으로 menu를 닫고 닫힌 뒤 trigger에 focus를 복귀한다.

- [ ] **Step 5: Implement one navigation DOM for two responsive modes**

Navigation data:

```ts
const tripNavItems: Array<{
  tab: TripTab;
  label: string;
  icon: IconName;
}> = [
  { tab: "today", label: "오늘", icon: "today" },
  { tab: "schedule", label: "일정", icon: "schedule" },
  { tab: "map", label: "지도", icon: "map" },
  { tab: "tools", label: "도구", icon: "tools" }
];
```

현재 tab link만 `aria-current="page"`를 갖는다. CSS에서 760px 이하 fixed bottom navigation, 761px 이상 좌측 rail로 바꾸며 blur와 floating glass를 사용하지 않는다.

- [ ] **Step 6: Connect trip routes in App**

`AppContent`는 route switch만 수행하며 `route.name === "trip"`일 때 `<TripRoutePage dataSource={dataSource} tripId={route.tripId} activeTab={route.tab} />`를 반환한다. Hook을 App의 조건문 안에서 호출하지 않는다.

`TripRoutePage`가 `useTripWorkspace()`를 호출한다. loading은 숫자 없는 상태 UI, error는 `다시 시도`, empty는 `여행을 찾을 수 없습니다`와 `여행 서재로 이동` action으로 처리한다. Ready이면 `<TripShell context={workspace.context} activeTab={activeTab}>` 안에 tab별 semantic heading(`오늘`, `일정`, `지도`, `도구`)과 승인된 한 줄 설명을 렌더링한다. Tasks 7~10은 이 heading을 유지한 채 각 tab 본문을 완성형 화면으로 교체한다.

- [ ] **Step 7: Run Shell and route tests**

Run:

```bash
npx vitest run --config vitest.config.ts src/layouts/TripShell.test.tsx src/app/router.test.tsx
npm run typecheck
npm run lint
```

Expected: all PASS; library test still finds no `여행 메뉴`.

- [ ] **Step 8: Commit**

```bash
git add src/components/Icon.tsx src/app/App.tsx src/app/TripRoutePage.tsx src/layouts/TripShell.tsx src/layouts/TripShell.test.tsx src/styles/navigation.css src/styles/layout.css
git commit -m "feat: add the Trip Control shell"
```

---

### Task 7: Today Dashboard for Upcoming, Active, and Completed Trips

**Files:**

- Create: `src/pages/today/TodayPage.tsx`
- Create: `src/pages/today/TodayCards.tsx`
- Create: `src/pages/today/TodayPage.test.tsx`
- Create: `src/styles/today.css`
- Modify: `src/app/TripRoutePage.tsx`
- Modify: `src/main.tsx`

**Interfaces:**

- Consumes: `TripSummaryViewModel`, `TodayViewModel`, `Icon`
- Produces: `TodayPage({ trip, today })`
- Produces: `WeatherCard`, `MovementCard`, `BookingCard`, `BudgetCard`

- [ ] **Step 1: Write failing state tests**

```tsx
it.each([
  ["bondi-weekend", "여행까지", "첫날 미리보기"],
  ["sydney-2026", "NEXT UP", "오늘 일정"],
  ["blue-mountains-memory", "여행 완료", "일정 다시 보기"]
] as const)("renders the Today state for %s", async (tripId, marker, action) => {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const [context, today] = await Promise.all([
    dataSource.getTripContext(tripId),
    dataSource.getToday(tripId)
  ]);
  if (!context || !today) throw new Error("fixture Today data missing");
  render(<TodayPage trip={context.trip} today={today} />);
  expect(screen.getByText(marker, { exact: false })).toBeVisible();
  expect(screen.getByText(action, { exact: false })).toBeVisible();
});

it("labels weather and budget as samples", async () => {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const [context, today] = await Promise.all([
    dataSource.getTripContext("sydney-2026"),
    dataSource.getToday("sydney-2026")
  ]);
  if (!context || !today) throw new Error("fixture Today data missing");
  render(<TodayPage trip={context.trip} today={today} />);
  expect(screen.getAllByText("샘플").length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/today/TodayPage.test.tsx
```

Expected: FAIL because Today components do not exist.

- [ ] **Step 3: Implement phase-specific hero**

- upcoming: D-day, 첫날 headline, 첫 일정, 예약·준비 상태
- active: 현지 날짜, 오늘 목적지, 다음 출발 정보
- completed: 여행 기간, 방문 장소 수, 완료 일정 수, trip cover를 사용한 마지막 대표 장면, `일정 다시 보기` link

Hero에는 목적지·상태·핵심 action만 두고 decorative gradient와 사진 위 text overlay를 사용하지 않는다.

- [ ] **Step 4: Implement dashboard cards**

Weather는 지역, 상태, 섭씨 온도, UV, `샘플` badge를 표시한다. Movement는 `NEXT UP`, 출발시각, countdown, 출발지→목적지, 교통수단, route summary를 표시하고 `mapUrl`이 있을 때만 외부 길찾기 link를 렌더링한다. Booking은 장소·시간·종류·상태와 `/trip/{id}/tools#bookings`의 `예약 상세` link를 표시한다. Budget은 AUD 지출·한도·사용률을 표시하고 사용률은 `Math.min(100, spentAud / limitAud * 100)`으로 제한한다.

- [ ] **Step 5: Implement Today schedule**

시간순 item의 시간, 장소, 한 줄 설명, kind, done 상태를 표시한다. 첫 번째 미완료 일정을 `다음 일정` text와 icon으로 강조하며 색상만으로 구분하지 않는다.

Today 일정 아래에 `지도 보기`, `예약·바우처`, `비상 연락처` Quick Tools를 실제 내부 route link로 제공한다. 존재하지 않는 데이터 기능을 성공한 것처럼 표시하지 않는다.

- [ ] **Step 6: Connect the Today route and styles**

`TripRoutePage`의 `today` 본문을 `<TodayPage trip={workspace.context.trip} today={workspace.today} />`로 교체한다. Mobile은 stacked cards, 760px 이상 summary 2열, desktop은 hero 전체 폭 + 2열 dashboard grid를 사용한다.

- [ ] **Step 7: Run tests and checks**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/today/TodayPage.test.tsx
npm run typecheck
npm run lint
```

Expected: all PASS; live weather·budget fetch는 발생하지 않는다.

- [ ] **Step 8: Commit**

```bash
git add src/pages/today src/styles/today.css src/app/TripRoutePage.tsx src/main.tsx
git commit -m "feat: build the Today dashboard"
```

---

### Task 8: Schedule Timeline and Read-Only Detail Bottom Sheet

**Files:**

- Create: `src/pages/schedule/SchedulePage.tsx`
- Create: `src/pages/schedule/ScheduleDetailSheet.tsx`
- Create: `src/components/BottomSheet.tsx`
- Create: `src/pages/schedule/SchedulePage.test.tsx`
- Create: `src/styles/schedule.css`
- Modify: `src/app/TripRoutePage.tsx`
- Modify: `src/main.tsx`

**Interfaces:**

- Consumes: `ScheduleDayView`, `ScheduleItemView`, `Icon`
- Produces: `BottomSheet`
- Produces: `SchedulePage({ days })`
- Produces: `ScheduleDetailSheet({ item, onClose, returnFocusTo })`

- [ ] **Step 1: Write failing date and dialog tests**

```tsx
async function getScheduleDays() {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const schedule = await dataSource.getSchedule("sydney-2026");
  if (!schedule) throw new Error("fixture schedule missing");
  return schedule.days;
}

it("switches fixture schedule dates", async () => {
  const days = await getScheduleDays();
  render(<SchedulePage days={days} />);
  await userEvent.click(screen.getByRole("button", { name: /DAY 02/ }));
  expect(screen.getByRole("heading", { name: days[1].headline }))
    .toBeVisible();
});

it("opens a read-only sheet and restores focus", async () => {
  const days = await getScheduleDays();
  render(<SchedulePage days={days} />);
  const opener = screen.getByRole("button", { name: /오페라 하우스/ });
  await userEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "일정 상세" });
  expect(within(dialog).getByText("예약 확정")).toBeVisible();
  expect(screen.queryByRole("button", { name: "저장" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/schedule/SchedulePage.test.tsx
```

Expected: FAIL because schedule components do not exist.

- [ ] **Step 3: Implement date selector and timeline**

Date buttons use `aria-pressed`; selected day summary includes day label, date, headline, item count. Each timeline card is a button containing startsAt, title, place, description, kind text, done state. It opens detail but exposes no edit, reorder, save, or completion mutation.

- [ ] **Step 4: Implement the approved Bottom Sheet**

```ts
interface ScheduleDetailSheetProps {
  item: ScheduleItemView;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}
```

공통 `BottomSheet`는 `ariaLabel`, `onClose`, `returnFocusTo`, `children` props를 받는다. Root는 `role="dialog"`, `aria-modal="true"`, `aria-label={ariaLabel}`을 사용한다. On mount it stores the previous `document.body.style.overflow`, sets it to `hidden`, and focuses `닫기`; `Escape` closes it; backdrop closes only when `event.target === event.currentTarget`; `Tab` and `Shift+Tab` wrap between focusable elements. Cleanup restores the previous overflow value and returns focus to `returnFocusTo`.

`ScheduleDetailSheet`는 `BottomSheet ariaLabel="일정 상세"`를 조합한다. Visible fields: time range, place, kind, description, travel mode·note, booking status. `mapUrl`이 있을 때만 `지도에서 열기` external link를 제공한다.

- [ ] **Step 5: Connect the route and responsive style**

`TripRoutePage`의 `schedule` branch를 `<SchedulePage days={workspace.schedule.days} />`로 교체한다. Mobile sheet는 화면 하단, desktop sheet는 중앙 폭 `min(560px, calc(100vw - 48px))`이며 배경 scroll을 잠근다.

- [ ] **Step 6: Run tests and checks**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/schedule/SchedulePage.test.tsx
npm run typecheck
npm run lint
```

Expected: all PASS including `Escape` close and focus restoration.

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomSheet.tsx src/pages/schedule src/styles/schedule.css src/app/TripRoutePage.tsx src/main.tsx
git commit -m "feat: add schedule timeline and detail sheet"
```

---

### Task 9: Static Map Preview and Accessible Place Fallback

**Files:**

- Create: `src/pages/map/MapPage.tsx`
- Create: `src/pages/map/MapPlaceSheet.tsx`
- Create: `src/pages/map/MapPage.test.tsx`
- Create: `src/styles/map.css`
- Modify: `src/app/TripRoutePage.tsx`
- Modify: `src/main.tsx`

**Interfaces:**

- Consumes: `MapPlaceView`, `ScheduleDayView`, `Icon`, `BottomSheet`
- Produces: `MapPage({ places, days })`
- Produces: `MapPlaceSheet({ place, onClose, returnFocusTo })`
- Does not consume: `maplibre-gl`, network map tiles, geolocation

- [ ] **Step 1: Write failing filter and fallback tests**

```tsx
async function getMapFixtures() {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const [mapPreview, schedule] = await Promise.all([
    dataSource.getMapPreview("sydney-2026"),
    dataSource.getSchedule("sydney-2026")
  ]);
  if (!mapPreview || !schedule) throw new Error("fixture map data missing");
  return { places: mapPreview.places, days: schedule.days };
}

it("filters the accessible place list by category", async () => {
  const { places, days } = await getMapFixtures();
  render(<MapPage places={places} days={days} />);
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(screen.getByText("Sample Coffee")).toBeVisible();
  expect(screen.queryByText("Sydney Opera House")).not.toBeInTheDocument();
});

it("renders a labelled static preview and a list fallback", async () => {
  const { places, days } = await getMapFixtures();
  render(<MapPage places={places} days={days} />);
  expect(screen.getByRole("img", { name: "선택한 장소의 정적 경로 미리보기" }))
    .toBeVisible();
  expect(screen.getByRole("list", { name: "장소 목록" })).toBeVisible();
});

it("opens a read-only place Bottom Sheet", async () => {
  const { places, days } = await getMapFixtures();
  render(<MapPage places={places} days={days} />);
  await userEvent.click(screen.getByRole("button", { name: /Sydney Opera House/ }));
  const dialog = screen.getByRole("dialog", { name: "장소 상세" });
  expect(within(dialog).getByText("Sydney Opera House")).toBeVisible();
  expect(within(dialog).getByRole("link", { name: "Google 지도 열기" }))
    .toBeVisible();
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/map/MapPage.test.tsx
```

Expected: FAIL because `MapPage` does not exist.

- [ ] **Step 3: Implement filters**

Search는 장소명·주소를 case-insensitive로 검사한다. Day filter는 `전체`와 fixture dates, category는 `전체·맛집·카페·관광·숙소·교통`, status는 `전체·저장·고민·방문`이다. 모든 filter는 button 또는 labelled input으로 구현하고 결과 개수를 text로 알린다.

- [ ] **Step 4: Implement a non-interactive SVG preview**

`<svg role="img" aria-label="선택한 장소의 정적 경로 미리보기">` 안에 neutral grid와 accent polyline을 그린다. 같은 relative container 위에 native marker button을 absolute 배치하고 `left: ${x}%`, `top: ${y / 0.7}%`, `aria-label="${name} 상세 보기"`를 사용한다. Zoom, pan, tile request, geolocation은 구현하지 않는다.

- [ ] **Step 5: Implement the list fallback**

SVG 아래에 항상 semantic list를 제공한다. 장소 card는 이름, category, status, address를 표시하는 button이며 marker와 card 선택은 같은 읽기 전용 `MapPlaceSheet`를 연다. Sheet는 공통 `BottomSheet ariaLabel="장소 상세"`를 사용해 이름, category, status, address를 표시하고 `mapUrl`이 있을 때만 `Google 지도 열기` link를 제공한다. 결과가 없으면 `조건에 맞는 장소가 없습니다`와 `필터 초기화` action을 표시한다.

- [ ] **Step 6: Connect route and styles**

`TripRoutePage`의 `map` branch를 `<MapPage places={workspace.mapPreview.places} days={workspace.schedule.days} />`로 교체한다. Mobile은 map→list, desktop은 map과 list 2열이다.

- [ ] **Step 7: Run tests and checks**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/map/MapPage.test.tsx
npm run typecheck
npm run lint
```

Expected: all PASS and no map network request.

- [ ] **Step 8: Commit**

```bash
git add src/pages/map src/styles/map.css src/app/TripRoutePage.tsx src/main.tsx
git commit -m "feat: add the static trip map preview"
```

---

### Task 10: Tools Groups and Pairing UI Integration

**Files:**

- Create: `src/pages/tools/ToolsPage.tsx`
- Create: `src/pages/tools/ToolsPage.test.tsx`
- Create: `src/styles/tools.css`
- Modify: `src/features/auth/PairDevicePage.tsx:1-55`
- Modify: `src/features/auth/PairingManager.tsx:1-47`
- Modify: `src/styles/pairing.css:1-164`
- Modify: `src/app/TripRoutePage.tsx`
- Modify: `src/main.tsx`

**Interfaces:**

- Consumes: `ToolsViewModel`, `PairingManager`, `ThemeControl`, `OfflineBanner`, `Icon`
- Produces: `ToolsPage({ tools, deviceManagement })`
- Preserves: auth API calls and owner·partner rendering decisions

- [ ] **Step 1: Write failing tools tests**

```tsx
async function renderToolsPage() {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const tools = await dataSource.getTools("sydney-2026");
  if (!tools) throw new Error("fixture tools missing");
  return render(
    <ThemeProvider>
      <ToolsPage
        tools={tools}
        deviceManagement={<p>기기 관리 테스트</p>}
      />
    </ThemeProvider>
  );
}

it("groups tools into the three approved sections", async () => {
  await renderToolsPage();
  expect(screen.getByRole("heading", { name: "Travel Essentials" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Places" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Planning & Settings" })).toBeVisible();
});

it("marks unavailable data features as previews", async () => {
  await renderToolsPage();
  expect(screen.getByText("환율")).toBeVisible();
  expect(screen.getByText("AI 앱 연결")).toBeVisible();
  expect(screen.getAllByText("준비 중").length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/tools/ToolsPage.test.tsx
```

Expected: FAIL because `ToolsPage` does not exist.

- [ ] **Step 3: Implement the three tool groups**

- Travel Essentials: 예약·바우처, 환율, 교통, 비상 연락처
- Places: 맛집, 카페, 저장 장소
- Planning & Settings: 체크리스트, 여행 메모, 주의사항, AI 앱 연결, 파트너 연결, 연결 기기 관리, 테마, 오프라인·동기화 상태

Task 4.5에서 데이터 기능이 없는 item은 button처럼 보이는 link로 만들지 않고 `준비 중` badge와 설명을 가진 article로 렌더링한다. 예약·바우처 article은 `id="bookings"`, 기기 관리는 `id="devices"`를 사용해 Today와 library의 hash entry가 정확히 도착하게 한다. Theme는 실제 `ThemeControl`, 오프라인은 실제 `OfflineBanner`, 기기 관리는 `deviceManagement` slot을 렌더링한다.

`ToolsPage` mount 시 `window.location.hash`가 `#bookings` 또는 `#devices`이면 해당 element를 찾아 `scrollIntoView({ block: "start" })`한다. 비동기 workspace loading 뒤 처음 mount되는 경우에도 deep link가 동작해야 한다.

- [ ] **Step 4: Restyle pairing without changing security logic**

`PairDevicePage`의 copy와 structure는 유지하되 새 surface, typography, button class를 적용한다. `PairingManager`, `InvitePanel`, `DeviceList`의 fetch 함수·권한 분기·token 처리 코드는 변경하지 않는다. `pairing.css`에서 paper, Georgia, pill-only button, transparent glass 표현을 제거하고 새 token을 사용한다.

- [ ] **Step 5: Connect Tools route**

`TripRoutePage`의 `tools` branch를 `<ToolsPage tools={workspace.tools} deviceManagement={<PairingManager />} />`로 교체한다. Pair route는 Shell 없는 집중형 claim 화면을 유지하되 Light·Dark token을 공유한다.

- [ ] **Step 6: Run tools and pairing regressions**

Run:

```bash
npx vitest run --config vitest.config.ts src/pages/tools/ToolsPage.test.tsx src/features/auth/pairing.test.tsx
npm run test:worker
npm run typecheck
npm run lint
```

Expected: frontend tests PASS, all existing Worker pairing tests PASS, partner에게 관리자 action이 노출되지 않는다.

- [ ] **Step 7: Commit**

```bash
git add src/pages/tools src/features/auth/PairDevicePage.tsx src/features/auth/PairingManager.tsx src/styles/tools.css src/styles/pairing.css src/app/TripRoutePage.tsx src/main.tsx
git commit -m "feat: integrate tools and device management"
```

---

### Task 11: PWA Theme Metadata, Full Regression, and Responsive QA

**Files:**

- Modify: `index.html:1-15`
- Modify: `vite.config.ts:1-49`
- Modify: `src/app/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/base.css`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/components.css`
- Modify: `src/styles/navigation.css`
- Modify: `src/styles/library.css`
- Modify: `src/styles/today.css`
- Modify: `src/styles/schedule.css`
- Modify: `src/styles/map.css`
- Modify: `src/styles/tools.css`
- Modify: `src/styles/pairing.css`
- Test: all `src/**/*.test.{ts,tsx}`
- Test: all `test/worker/*.test.ts`

**Interfaces:**

- Consumes: all previous tasks
- Produces: Task 4.5 acceptance-ready frontend build
- Does not produce: deployment, production resources, backend mutations

- [ ] **Step 1: Add top-level app regression tests**

Replace the retired AppShell test with `src/app/App.test.tsx`:

```tsx
vi.mock("../features/auth/PairingManager", () => ({
  PairingManager: () => <p>기기 관리 테스트</p>
}));

it("renders the library at root without trip navigation", async () => {
  window.history.replaceState(null, "", "/");
  render(<App dataSource={fixtureTravelGuideDataSource} />);
  expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
  expect(window.location.pathname).toBe("/library");
  expect(screen.queryByRole("navigation", { name: "여행 메뉴" }))
    .not.toBeInTheDocument();
});

it("renders all four trip routes in the TripShell", async () => {
  for (const tab of ["today", "schedule", "map", "tools"] as const) {
    window.history.replaceState(null, "", `/trip/sydney-2026/${tab}`);
    const view = render(<App dataSource={fixtureTravelGuideDataSource} />);
    expect(await screen.findByRole("navigation", { name: "여행 메뉴" }))
      .toBeVisible();
    view.unmount();
  }
});

it("offers a library return action for an unknown trip", async () => {
  window.history.replaceState(null, "", "/trip/missing/today");
  render(<App dataSource={fixtureTravelGuideDataSource} />);
  expect(await screen.findByText("여행을 찾을 수 없습니다")).toBeVisible();
  expect(screen.getByRole("button", { name: "여행 서재로 이동" })).toBeVisible();
});
```

- [ ] **Step 2: Update PWA metadata**

`index.html` initial values:

```html
<meta name="theme-color" content="#F6F7F8">
<meta
  name="description"
  content="둘만의 여행을 오늘 중심으로 확인하는 개인용 여행 가이드북"
>
```

`vite.config.ts` manifest는 `background_color: "#F6F7F8"`, `theme_color: "#0C7892"`로 교체한다. App 실행 후에는 `ThemeProvider`가 resolved theme에 맞춰 meta를 갱신한다. Existing service worker, icon, `NetworkOnly` API caching rule은 유지한다.

- [ ] **Step 3: Run the complete automated verification**

Run:

```bash
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
```

Expected: five commands all exit `0`; existing auth·pairing tests remain green.

- [ ] **Step 4: Scan for retired design residue and fixture leaks**

Run:

```bash
rg -n --glob 'src/**' 'paper|paper-deep|Georgia|backdrop-filter|glass|radial-gradient|linear-gradient|#f7f3ea|#eee7da'
rg -n --glob 'src/pages/**' 'data/fixture|fixtureDataSource'
```

Expected: both commands return no matches. Product-visible `샘플` and `준비 중` text is allowed because it prevents fixture data from appearing live.

- [ ] **Step 5: Perform keyboard and viewport QA**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Verify this checklist in both Light and Dark:

- 390px and 430px: no horizontal overflow; trip bottom nav remains visible above safe area.
- PWA install prompt와 trip bottom navigation이 겹치지 않는다.
- 760px: only one navigation mode is visible.
- 1180px and 1440px: left rail and central single·2-column dashboard render; no right contextual panel.
- Library: no trip navigation.
- Trip header: library return and trip switcher work.
- Tab order: skip link → header actions → page content → trip nav.
- Schedule sheet: opener → close focus, Tab trap, Shift+Tab trap, Escape close, opener focus restore.
- Offline event: banner appears and disappears without hiding content.
- Reduced motion: transitions and animations complete within `0.01ms`.
- Light and Dark: secondary text is readable; focus outline is visible; status is not color-only.

Stop the dev server after the checklist.

- [ ] **Step 6: Review git scope**

Run:

```bash
git status --short
git diff --check
git diff --stat origin/feat/couple-travel-pwa...HEAD
```

Expected:

- no changes under `worker/`, `migrations/`, `test/worker/` except pre-existing files;
- `.superpowers/` remains untracked and is not staged;
- no whitespace errors;
- no production credential, `.dev.vars`, token, or generated build directory is staged.

- [ ] **Step 7: Commit final integration fixes**

Stage only reviewed Task 4.5 files:

```bash
git add \
  index.html \
  vite.config.ts \
  src/app/App.tsx \
  src/app/TripRoutePage.tsx \
  src/app/router.tsx \
  src/app/theme \
  src/components/AppLink.tsx \
  src/components/BottomSheet.tsx \
  src/components/Icon.tsx \
  src/components/OfflineBanner.tsx \
  src/components/StatusPanel.tsx \
  src/data \
  src/features/auth/PairDevicePage.tsx \
  src/features/auth/PairingManager.tsx \
  src/layouts \
  src/pages \
  src/styles \
  src/main.tsx \
  src/test/setup.ts
git commit -m "test: verify the Trip Control redesign"
```

If Step 3–6 required no file change, do not create an empty commit.

- [ ] **Step 8: Stop at the approval gate**

Report the exact commit range, automated test counts, build result, known limitations, and screenshots or browser QA findings. Do not push, open a pull request, merge to `main`, create Cloudflare resources, or deploy until the user explicitly approves that external action.

---

## Final Acceptance Checklist

- [ ] 여행 서재에 실용형 여행 카드와 상태 filter가 있고 여행 내부 navigation은 없다.
- [ ] 여행 선택 후 Today로 이동하고 여행 내부에 4개 tab만 있다.
- [ ] Upcoming·Active·Completed Today 상태가 fixture로 모두 검증된다.
- [ ] Weather와 Budget이 sample임을 명확히 표시한다.
- [ ] Schedule date 전환과 읽기 전용 Bottom Sheet가 동작한다.
- [ ] Bottom Sheet의 keyboard focus trap·Escape·focus 복귀가 동작한다.
- [ ] Map은 network 없는 정적 preview이며 장소 list fallback을 제공한다.
- [ ] Map marker와 장소 card에서 읽기 전용 장소 Bottom Sheet가 열린다.
- [ ] Tools가 3개 승인 그룹으로 구성되고 기존 pairing 관리가 포함된다.
- [ ] Light·Dark·System 선택이 저장되고 System 변경을 반영한다.
- [ ] Loading·empty·error·not-found·offline 상태가 구분된다.
- [ ] Worker·D1·인증·pairing 코드와 tests가 유지된다.
- [ ] 390px에서 가로 넘침이 없고 desktop navigation rail이 동작한다.
- [ ] `npm test`, `npm run test:worker`, `npm run typecheck`, `npm run lint`, `npm run build`가 모두 성공한다.
- [ ] `main` merge와 production deploy는 수행하지 않는다.
