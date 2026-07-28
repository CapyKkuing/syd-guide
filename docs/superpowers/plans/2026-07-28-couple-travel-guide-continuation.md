# Couple Travel Guide Tasks 7–13 Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완료된 인증·여행 서재·snapshot/mutation API와 재설계된 4-tab UI를 연결해 두 사람이 실제 여행 데이터를 공동 편집하고 오프라인에서도 안전하게 사용할 수 있는 Phase 1 PWA를 완성한다.

**Architecture:** `src/pages/today`, `src/pages/schedule`, `src/pages/map`, `src/pages/tools`의 승인된 UI를 유지하고 fixture 경계를 production snapshot adapter로 교체한다. 모든 쓰기는 Task 6의 `ApiClient.mutate()`와 versioned entity 계약을 사용하며, Task 11에서 IndexedDB outbox를 그 아래에 추가한다. GitHub Pages는 fixture read-only preview로 남기고 Cloudflare production은 Task 13 승인 gate 뒤에만 전환한다.

**Tech Stack:** npm, React 19, TypeScript 6, Vite 8, Hono, Zod, Cloudflare Workers, D1, Vitest, Testing Library, Playwright, MapLibre GL, IndexedDB via `idb`, `vite-plugin-pwa`.

## Global Constraints

- 기준 checkout과 완료 이력은 `CODEX_HANDOFF.md`다.
- 제품 UI 기준은 `docs/superpowers/specs/2026-07-28-trip-control-ui-integration-design.md`와 `DESIGN.md`다.
- 기능·보안 기준은 `docs/superpowers/specs/2026-07-27-couple-travel-guide-phase-1-design.md`다.
- 이 문서는 옛 `2026-07-27-couple-travel-guide-phase-1.md`의 Task 7~13 구현 경로를 대체한다.
- 기존 4-tab route `today | schedule | map | tools`와 `src/pages/*` 화면을 유지한다.
- `src/features/schedule/SchedulePage.tsx`처럼 기존 화면과 경쟁하는 새 페이지를 만들지 않는다.
- GitHub Pages는 fixture read-only preview를 유지한다.
- 실제 API는 로컬 Worker와 Cloudflare Worker에서만 사용한다.
- 쓰기는 `MutationRequest`, `ApiClient.mutate()`, `baseVersion`, `idempotencyKey`를 반드시 사용한다.
- 충돌은 자동 덮어쓰지 않고 `내 수정 유지` 또는 `최신 내용 사용`을 사용자가 선택한다.
- 개인 준비물과 개인 메모는 상대 snapshot·검색·activity에 노출하지 않는다.
- 예약번호는 기본 마스킹하며 사용자가 누른 동안만 공개한다.
- 외부 URL은 검증된 HTTPS만 새 탭에서 열고 `noopener noreferrer`를 유지한다.
- 기능 파일은 100~250줄을 목표로 하며 250줄을 넘기기 전에 책임별로 분리한다.
- Task마다 관련 검증이 모두 통과하면 commit한다.
- Task별 commit 후 push·merge는 사용자 승인 전 실행하지 않는다.
- Cloudflare production 리소스·migration·deploy는 Task 13 승인 gate 전 실행하지 않는다.

---

## Current File Map

| 경로 | 현재 책임 | 연속 작업에서의 처리 |
|---|---|---|
| `src/data/contracts.ts` | 재설계 UI view model | snapshot mapper 입력에 맞게 확장 |
| `src/data/fixture/fixtureDataSource.ts` | GitHub Pages·test fixture | 삭제하지 않고 read-only preview로 유지 |
| `src/data/useTravelData.ts` | library/workspace async load | workspace reload 계약 추가 |
| `src/app/App.tsx` | fixture/API library 선택 | production snapshot data source 선택 추가 |
| `src/app/TripRoutePage.tsx` | 4-tab 조립 | mutation·reload 경계 전달 |
| `src/pages/today/*` | Today read-only UI | real selector와 mutation 결과 반영 |
| `src/pages/schedule/*` | Schedule read-only UI | create/edit/delete dialog 연결 |
| `src/pages/map/*` | 정적 지도·filter UI | CRUD·vote·MapLibre progressive enhancement |
| `src/pages/tools/ToolsPage.tsx` | preview tool card | booking/checklist/note/search/activity 실제 패널 연결 |
| `src/services/api/client.ts` | snapshot·mutation HTTP | Task 7에서 session helper, Task 11에서 transport 주입 |
| `src/shared/entities.ts` | D1 entity 계약 | 그대로 사용 |
| `src/shared/mutations.ts` | mutation payload 계약 | 그대로 사용 |
| `worker/db/snapshot.ts` | privacy-filtered coherent snapshot | 읽기 기준; Task 6 Minor 수정 시 공통 privacy helper 사용 |

## Shared Continuation Interfaces

Task 7에서 다음 계약을 만들고 Task 8~12에서 이름을 바꾸지 않는다.

```ts
export interface WorkspaceReload {
  reload(): void;
}

export type TripWorkspaceResource =
  | { status: "loading"; reload: () => void }
  | { status: "ready"; data: TripWorkspace; reload: () => void }
  | { status: "empty"; retry: () => void; reload: () => void }
  | { status: "error"; message: string; retry: () => void; reload: () => void };

export interface MutableTravelGuideDataSource extends TravelGuideDataSource {
  invalidateTrip(tripId: string): void;
}

export interface MutationTransport {
  mutate<K extends MutationRequest>(
    tripId: string,
    mutation: K
  ): Promise<MutationSuccess>;
}

export interface TripMutationController {
  submit<K extends EntityKind>(
    entity: K,
    action: MutationRequest<K>["action"],
    entityId: string,
    baseVersion: number | null,
    payload: MutationPayloadMap[K] | null
  ): Promise<MutationSuccess>;
}
```

`TripMutationController.submit()`은 `crypto.randomUUID()`로 `idempotencyKey`를 만들고 mutation 성공 후 `dataSource.invalidateTrip(tripId)`와 `reload()`를 호출한다. 동일 사용자 동작을 재시도할 때는 Task 11 outbox가 같은 key를 유지한다.

---

### Task 7: Production Snapshot Adapter, Editable Schedule, and Real Today

**Files:**
- Create: `src/data/api/snapshotMappers.ts`
- Create: `src/data/api/snapshotMappers.test.ts`
- Create: `src/data/api/snapshotDataSource.ts`
- Create: `src/data/api/snapshotDataSource.test.ts`
- Create: `src/services/mutations/controller.ts`
- Create: `src/services/mutations/controller.test.ts`
- Create: `src/pages/schedule/ScheduleEditorDialog.tsx`
- Create: `src/pages/schedule/ScheduleEditorDialog.test.tsx`
- Modify: `src/data/contracts.ts`
- Modify: `src/data/useTravelData.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/TripRoutePage.tsx`
- Modify: `src/pages/schedule/SchedulePage.tsx`
- Modify: `src/pages/schedule/SchedulePage.test.tsx`
- Modify: `src/pages/today/TodayPage.tsx`
- Modify: `src/pages/today/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `TripSnapshot`, `SessionPrincipal`, `ApiClient`, current `TravelGuideDataSource`
- Produces: `SnapshotTravelGuideDataSource`, `TripWorkspaceResource`, `TripMutationController`

- [ ] **Step 1: snapshot mapper와 cache 실패 test 작성**

```ts
it("maps one snapshot into the current four-tab workspace", () => {
  const workspace = mapSnapshotToWorkspace(snapshot, principal, now);
  expect(workspace.context.trip.id).toBe(snapshot.trip.id);
  expect(workspace.schedule.days[0]?.items[0]?.id)
    .toBe(snapshot.scheduleItems[0]?.id);
  expect(workspace.context.viewer.role).toBe(principal.role);
});

it("deduplicates concurrent snapshot reads for one trip", async () => {
  const client = fakeSnapshotClient(snapshot);
  const source = new SnapshotTravelGuideDataSource(client, getPrincipal, clock);
  await Promise.all([
    source.getTripContext(snapshot.trip.id),
    source.getToday(snapshot.trip.id),
    source.getSchedule(snapshot.trip.id),
    source.getMapPreview(snapshot.trip.id),
    source.getTools(snapshot.trip.id),
  ]);
  expect(client.getTripSnapshot).toHaveBeenCalledTimes(1);
});
```

Run:

```bash
npm test -- src/data/api/snapshotMappers.test.ts src/data/api/snapshotDataSource.test.ts
```

Expected: FAIL because mapper and production data source do not exist.

- [ ] **Step 2: snapshot → 승인 UI view model mapper 구현**

`mapSnapshotToWorkspace(snapshot, principal, now)`는 다음 규칙을 지킨다.

- trip phase는 `snapshot.trip.status`를 사용한다.
- local date는 `Intl.DateTimeFormat(..., { timeZone: trip.timeZone })`로 계산한다.
- `trip_days.position`, `schedule_items.position` 순으로 정렬한다.
- schedule place는 `placeId`로, booking은 `bookingId`로 같은 snapshot에서 join한다.
- schedule kind 우선순위는 `travelMode → movement`, `bookingId → booking`, restaurant/cafe place → meal, attraction place → attraction, 나머지 → note다.
- Today는 active면 local date, upcoming이면 첫날, completed면 마지막 날을 선택한다.
- weather와 budget은 실제 provider가 없으므로 기존 `isSample: true`와 `샘플` 표시를 유지한다.
- partner status는 snapshot members에 partner가 있으면 `connected`다.
- viewer display name은 principal member row를 사용한다.
- 개인 준비물·메모는 Worker가 필터링한 snapshot만 사용하고 client에서 다른 member 데이터를 추정하지 않는다.
- Task 8 전까지 기존 정적 map preview의 `x`, `y`는 snapshot의 유효한 latitude/longitude 전체 범위를 0~100/0~70으로 정규화한다. 좌표가 없는 장소는 목록에는 포함하고 preview marker에서는 제외한다.

```ts
export function mapSnapshotToWorkspace(
  snapshot: TripSnapshot,
  principal: SessionPrincipal,
  now: Date
): TripWorkspace;
```

- [ ] **Step 3: production snapshot data source와 reload 계약 구현**

`SnapshotTravelGuideDataSource`는 같은 trip의 동시 5개 view 요청을 한 `Promise<TripSnapshot>`으로 합친다. ETag를 trip별로 저장하고 `304`면 마지막 snapshot을 사용한다.

```ts
export class SnapshotTravelGuideDataSource
  implements MutableTravelGuideDataSource {
  constructor(
    client: Pick<ApiClient, "getTripSnapshot">,
    principalLoader: () => Promise<SessionPrincipal>,
    clock: () => Date = () => new Date()
  );
  invalidateTrip(tripId: string): void;
}
```

`useTripWorkspace()`의 모든 상태에 `reload`를 제공한다. reload는 data source의 cache를 무효화하고 같은 route에서 snapshot을 다시 읽는다.

`App.tsx` 선택 규칙:

```ts
const isFixturePreview =
  suppliedDataSource !== undefined || import.meta.env.MODE === "github-pages";
```

- fixture preview: 현재 fixture data source
- local/Cloudflare: singleton `SnapshotTravelGuideDataSource`

- [ ] **Step 4: mutation controller 실패 test와 최소 구현**

```ts
it("creates one idempotent schedule mutation then reloads", async () => {
  await controller.submit(
    "schedule_item",
    "create",
    "schedule-new",
    null,
    validSchedulePayload
  );
  expect(transport.mutate).toHaveBeenCalledWith(
    tripId,
    expect.objectContaining({
      entity: "schedule_item",
      action: "create",
      baseVersion: null,
    })
  );
  expect(dataSource.invalidateTrip).toHaveBeenCalledWith(tripId);
  expect(reload).toHaveBeenCalledTimes(1);
});
```

Run:

```bash
npm test -- src/services/mutations/controller.test.ts
```

Expected: FAIL before implementation, PASS after `createTripMutationController()` is added.

- [ ] **Step 5: 기존 Schedule UI에 create·edit·delete 연결**

`SchedulePage`는 기존 날짜 selector·timeline·read-only detail을 유지한다.

- `일정 추가`: 선택 날짜의 `tripDayId`, 마지막 position + 1로 create
- `수정`: 선택 item의 현재 `version`을 baseVersion으로 update
- `삭제`: 제목을 포함한 확인 dialog 뒤 delete
- fixed item은 삭제 전 `고정 일정입니다` 추가 확인
- fixture preview에서는 편집 버튼을 disabled하고 read-only 이유 표시
- `startsAt`/`endsAt`은 trip timezone offset가 포함된 ISO 값을 제출
- 실패 시 `ApiClientError.message`를 dialog 안 `role="alert"`에 표시

```ts
export interface SchedulePageProps {
  tripId: string;
  days: ScheduleDayView[];
  mutationController?: TripMutationController;
}
```

Editor test:

```ts
it("submits the selected day and current version when editing", async () => {
  await user.click(screen.getByRole("button", { name: /오페라 하우스/ }));
  await user.click(screen.getByRole("button", { name: "일정 수정" }));
  await user.clear(screen.getByLabelText("일정 제목"));
  await user.type(screen.getByLabelText("일정 제목"), "오페라 하우스 투어");
  await user.click(screen.getByRole("button", { name: "저장" }));
  expect(controller.submit).toHaveBeenCalledWith(
    "schedule_item",
    "update",
    item.id,
    item.version,
    expect.objectContaining({ title: "오페라 하우스 투어" })
  );
});
```

- [ ] **Step 6: Today가 real snapshot selector를 표시하는지 검증**

upcoming·active·completed fixture test는 유지하고 snapshot mapper test에 다음을 추가한다.

- active Today는 local date 일정만 표시
- 다음 이동은 현재 시각 이후 첫 movement
- 다음 booking은 현재 시각 이후 첫 booking
- completed summary는 visited place와 done schedule count
- schedule mutation reload 후 Today와 Schedule이 같은 snapshot version을 표시

- [ ] **Step 7: Task 7 전체 검증**

Run:

```bash
npm test -- src/data src/services/mutations src/pages/schedule src/pages/today src/app
npm run test:worker
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Expected: fixture preview regression, production snapshot 1회 read, schedule CRUD request, Today selector가 모두 PASS.

- [ ] **Step 8: Task 7 commit**

```bash
git add src/data src/services/mutations src/app src/pages/schedule src/pages/today
git commit -m "feat: connect live schedule and today data"
```

---

### Task 8: Editable Places, Progressive MapLibre, and Couple Voting

**Files:**
- Create: `src/pages/map/PlaceEditorDialog.tsx`
- Create: `src/pages/map/PlaceEditorDialog.test.tsx`
- Create: `src/pages/map/MapCanvas.tsx`
- Create: `src/pages/map/MapCanvas.test.tsx`
- Create: `src/pages/map/PlaceVoteControl.tsx`
- Create: `src/pages/map/PlaceVoteControl.test.tsx`
- Modify: `src/data/contracts.ts`
- Modify: `src/data/api/snapshotMappers.ts`
- Modify: `src/pages/map/MapPage.tsx`
- Modify: `src/pages/map/MapPage.test.tsx`
- Modify: `src/pages/map/MapPlaceSheet.tsx`
- Modify: `src/styles/map.css`

**Interfaces:**
- Consumes: `Place`, `Vote`, `TripMutationController`
- Produces: place create/update/delete, per-member `must|okay|skip` vote, MapLibre online enhancement

- [ ] **Step 1: place mapper·filter·vote 실패 test 작성**

```ts
it("joins both member votes without inventing a missing vote", () => {
  const place = mapPlace(snapshot.places[0]!, snapshot.votes, members);
  expect(place.votes).toEqual([
    { memberId: "owner", choice: "must" },
    { memberId: "partner", choice: "okay" },
  ]);
});

it("keeps the accessible list when the map fails", async () => {
  render(<MapPage {...props} mapLoader={rejectingMapLoader} />);
  expect(await screen.findByRole("status", { name: "온라인 지도를 불러오지 못했습니다" }))
    .toBeInTheDocument();
  expect(screen.getByRole("list", { name: "장소 목록" })).toBeInTheDocument();
});
```

Run:

```bash
npm test -- src/pages/map src/data/api/snapshotMappers.test.ts
```

Expected: FAIL because real coordinates, vote view, editor and map loader do not exist.

- [ ] **Step 2: map view contract 확장**

```ts
export interface MapPlaceView {
  id: string;
  version: number;
  name: string;
  category: PlaceCategory;
  status: PlaceStatus;
  dayDate: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string;
  description: string;
  mapUrl: string | null;
  votes: Array<{ memberId: string; choice: VoteChoice }>;
}
```

Task 4.5의 `x`, `y` 정적 preview 좌표는 제거한다. 좌표 없는 장소도 목록에는 남기고 지도 marker만 생략한다.

- [ ] **Step 3: place CRUD와 vote mutation 구현**

- create/update payload는 `MutationPayloadMap["place"]` 그대로 사용
- delete는 현재 place version 사용
- 사용자의 기존 vote가 없으면 `crypto.randomUUID()` ID로 create, 있으면 snapshot의 vote ID와 version으로 update
- `savedBy`는 현재 member ID
- Google Maps URL은 기존 `isSafeGoogleMapsUrl`을 통과할 때만 링크 표시

Test:

```ts
expect(controller.submit).toHaveBeenCalledWith(
  "vote",
  "create",
  expect.any(String),
  null,
  { targetType: "place", targetId: place.id, choice: "must" }
);
```

- [ ] **Step 4: MapLibre progressive enhancement 구현**

`MapCanvas`는 online이고 좌표가 하나 이상일 때만 `maplibre-gl`을 dynamic import한다.

```ts
export type MapLoader = () => Promise<typeof import("maplibre-gl")>;
```

- style: `https://tiles.openfreemap.org/styles/liberty`
- marker click: 기존 `MapPlaceSheet` open callback
- component unmount: `map.remove()`
- `online` event: 실패 상태에서 한 번 재시도
- offline 또는 load 실패: 지도 오류 상태 + 장소 목록 유지
- API key, paid tile provider, 사용자 위치 추적 없음

- [ ] **Step 5: Task 8 검증**

Run:

```bash
npm test -- src/pages/map src/data/api/snapshotMappers.test.ts
npm run test:worker -- test/worker/sync.test.ts
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Expected: filter, CRUD payload, 두 사용자 vote, map success/failure/unmount, 목록 fallback이 PASS.

- [ ] **Step 6: Task 8 commit**

```bash
git add src/data src/pages/map src/styles/map.css
git commit -m "feat: add collaborative places and map"
```

---

### Task 9: Booking Editor and Reservation Privacy

**Files:**
- Create: `src/pages/tools/bookings/BookingsPanel.tsx`
- Create: `src/pages/tools/bookings/BookingEditorDialog.tsx`
- Create: `src/pages/tools/bookings/ReservationCode.tsx`
- Create: `src/pages/tools/bookings/bookings.test.tsx`
- Modify: `src/data/contracts.ts`
- Modify: `src/data/api/snapshotMappers.ts`
- Modify: `src/pages/tools/ToolsPage.tsx`
- Modify: `src/pages/today/TodayCards.tsx`
- Modify: `src/pages/schedule/ScheduleDetailSheet.tsx`
- Modify: `src/styles/tools.css`

**Interfaces:**
- Consumes: `Booking`, `Place`, `ScheduleItem`, `TripMutationController`
- Produces: booking CRUD, press-to-reveal reservation code, Today/Schedule booking linkage

- [ ] **Step 1: masking·reveal·mutation 실패 test 작성**

```ts
it("does not render the reservation code until reveal is held", async () => {
  render(<ReservationCode value="ABC12345" />);
  expect(screen.queryByText("ABC12345")).not.toBeInTheDocument();
  const reveal = screen.getByRole("button", { name: "예약번호 보기" });
  await user.pointer([{ keys: "[MouseLeft>]", target: reveal }]);
  expect(screen.getByText("ABC12345")).toBeInTheDocument();
  await user.pointer([{ keys: "[/MouseLeft]", target: reveal }]);
  expect(screen.queryByText("ABC12345")).not.toBeInTheDocument();
});
```

추가 test:

- keyboard focus만으로 code 공개 안 됨
- `pointerup`, `pointercancel`, `pointerleave`, `blur`에 다시 마스킹
- create/update/delete가 current version을 사용
- external/document URL이 HTTPS가 아니면 링크를 렌더하지 않음

- [ ] **Step 2: booking view model과 editor 구현**

```ts
export interface BookingView {
  id: string;
  version: number;
  placeId: string | null;
  provider: string;
  bookingType: Booking["bookingType"];
  startsAt: string;
  endsAt: string | null;
  reservationCode: string | null;
  paymentStatus: Booking["paymentStatus"];
  externalUrl: string | null;
  documentUrl: string | null;
  memo: string;
  isFixed: boolean;
}
```

- provider, type, start/end, payment, reservation code, memo, linked place를 편집
- fixed booking 삭제는 추가 확인
- reservation code는 DOM에 평문으로 상시 두지 않음
- activity summary에는 provider와 action만 사용하고 code/memo를 넣지 않음

- [ ] **Step 3: Today·Schedule 연결**

- Today booking card는 다음 booking의 provider, start time, payment status를 표시
- `예약 상세`는 Tools `#bookings`로 이동
- Schedule detail은 linked booking의 상태와 provider를 표시
- schedule item을 저장할 때 다른 trip booking ID를 사용할 수 없다는 Worker regression test 유지

- [ ] **Step 4: Task 9 검증**

Run:

```bash
npm test -- src/pages/tools/bookings src/pages/today src/pages/schedule
npm run test:worker -- test/worker/sync.test.ts
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Expected: code masking lifecycle, CRUD, HTTPS link, Today/Schedule join이 PASS.

- [ ] **Step 5: Task 9 commit**

```bash
git add src/data src/pages/tools src/pages/today src/pages/schedule src/styles/tools.css
git commit -m "feat: add protected trip bookings"
```

---

### Task 10: Checklist, Notes, Search, and Activity

**Files:**
- Create: `src/pages/tools/checklist/ChecklistPanel.tsx`
- Create: `src/pages/tools/checklist/checklist.test.tsx`
- Create: `src/pages/tools/notes/NotesPanel.tsx`
- Create: `src/pages/tools/notes/notes.test.tsx`
- Create: `src/pages/tools/search/searchTrip.ts`
- Create: `src/pages/tools/search/SearchPanel.tsx`
- Create: `src/pages/tools/search/search.test.ts`
- Create: `src/pages/tools/activity/ActivityPanel.tsx`
- Create: `src/pages/tools/activity/activity.test.tsx`
- Modify: `src/data/contracts.ts`
- Modify: `src/data/api/snapshotMappers.ts`
- Modify: `src/pages/tools/ToolsPage.tsx`
- Modify: `src/styles/tools.css`

**Interfaces:**
- Consumes: `CheckItem`, `Note`, `ActivityLog`, current viewer member ID
- Produces: shared/personal checklist, shared/personal notes, privacy-safe search and activity

- [ ] **Step 1: privacy 실패 test 작성**

```ts
it("never indexes another member personal content", () => {
  const results = searchTrip(workspace, "여권번호");
  expect(results).toEqual([]);
});

it("forces personal checklist ownership to the current member", async () => {
  await createPersonalItem("충전기");
  expect(controller.submit).toHaveBeenCalledWith(
    "check_item",
    "create",
    expect.any(String),
    null,
    expect.objectContaining({
      scope: "personal",
      ownerMemberId: principal.memberId,
    })
  );
});
```

Worker `sync.test.ts`에는 owner·partner snapshot과 activity에서 상대 personal item/note가 없는지 유지한다.

- [ ] **Step 2: checklist와 note CRUD 구현**

- checklist: shared/personal filter, assignee, quantity, memo, done, position
- personal item owner는 현재 principal 고정
- note target: trip, schedule item, place, booking
- personal note author는 현재 principal 고정
- attachment는 HTTPS URL만 허용하고 파일 upload는 Phase 3 범위라 제공하지 않음
- delete는 현재 version 사용

- [ ] **Step 3: 통합 검색 구현**

```ts
export type SearchKind =
  | "schedule"
  | "place"
  | "booking"
  | "checklist"
  | "note";

export interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  excerpt: string;
  route: string;
  updatedAt: string;
}
```

- search 대상: 현재 snapshot에 존재하는 일정·장소·예약·준비물·메모
- reservation code는 title/excerpt/index에서 제외
- 개인 데이터는 Worker snapshot에 포함된 현재 사용자 것만 검색
- filter: kind
- sort: relevance 우선, 동일하면 updatedAt 내림차순
- query trim 후 2자 미만이면 빈 결과

- [ ] **Step 4: activity panel 구현**

- 최근 100건만 사용
- action, 안전한 summary, 상대적 시각 표시
- reservation code, memo body, personal content를 새로 조합하지 않음
- empty state와 reload button 제공

- [ ] **Step 5: Task 10 검증**

Run:

```bash
npm test -- src/pages/tools
npm run test:worker -- test/worker/sync.test.ts
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Expected: shared/personal CRUD, privacy search, activity masking이 PASS.

- [ ] **Step 6: Task 10 commit**

```bash
git add src/data src/pages/tools src/styles/tools.css test/worker/sync.test.ts
git commit -m "feat: add trip planning tools and search"
```

---

### Task 11: IndexedDB Snapshot Cache, Outbox, 15-Second Sync, and Conflicts

**Files:**
- Create: `src/services/offline/database.ts`
- Create: `src/services/offline/snapshotStore.ts`
- Create: `src/services/offline/outboxStore.ts`
- Create: `src/services/offline/offline.test.ts`
- Create: `src/services/sync/syncEngine.ts`
- Create: `src/services/sync/syncEngine.test.ts`
- Create: `src/services/sync/SyncProvider.tsx`
- Create: `src/services/sync/ConflictDialog.tsx`
- Create: `src/services/sync/ConflictDialog.test.tsx`
- Modify: `src/services/api/client.ts`
- Modify: `src/services/mutations/controller.ts`
- Modify: `src/data/api/snapshotDataSource.ts`
- Modify: `src/components/OfflineBanner.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `TripSnapshot`, `MutationRequest`, `VersionConflict`, `ApiClient`
- Produces: durable snapshot cache, ordered outbox, sync triggers, explicit conflict resolution

- [ ] **Step 1: offline queue·ordering·retry 실패 test 작성**

```ts
it("replays mutations in creation order with the same idempotency key", async () => {
  await outbox.enqueue(firstMutation);
  await outbox.enqueue(secondMutation);
  await engine.flush(tripId);
  expect(transport.mutate.mock.calls.map((call) => call[1].idempotencyKey))
    .toEqual([firstMutation.idempotencyKey, secondMutation.idempotencyKey]);
});

it("does not auto-overwrite a version conflict", async () => {
  transport.mutate.mockRejectedValue(conflictError(currentEntity));
  await engine.flush(tripId);
  expect(await outbox.get(firstMutation.idempotencyKey))
    .toMatchObject({ state: "conflict" });
  expect(transport.mutate).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: IndexedDB schema 구현**

Database name: `couple-travel-guide`, version `1`.

Stores:

```ts
interface SnapshotRecord {
  tripId: string;
  snapshot: TripSnapshot;
  etag: string | null;
  savedAt: string;
}

interface OutboxRecord {
  idempotencyKey: string;
  tripId: string;
  mutation: MutationRequest;
  state: "queued" | "sending" | "conflict";
  attempts: number;
  createdAt: string;
  lastErrorCode: string | null;
}

interface SettingRecord {
  key: string;
  value: unknown;
}
```

Indexes: outbox `by-trip-created` on `[tripId, createdAt]`.

- [ ] **Step 3: sync engine 구현**

Trigger:

- app start
- `visibilitychange`로 visible 복귀
- `online`
- 사용자가 수동 새로고침
- visible+online 동안 15초 interval

규칙:

- trip별 outbox 직렬 처리
- 성공한 record만 삭제
- network/503은 queued로 되돌리고 다음 trigger까지 대기
- 401 session revoked/expired는 snapshot과 outbox 즉시 삭제 후 `/pair` 이동
- 409 conflict는 record를 conflict 상태로 두고 이후 record flush 중단
- 여러 trigger가 겹치면 하나의 in-flight flush만 유지
- component unmount 시 interval과 event listener 제거

- [ ] **Step 4: conflict dialog 두 선택 구현**

`최신 내용 사용`:

- conflicting outbox record 삭제
- snapshot cache invalidate
- server snapshot reload

`내 수정 유지`:

- current entity 값을 기준으로 기존 payload를 다시 적용
- 새 idempotency key 생성
- baseVersion을 current.version으로 변경
- 기존 conflict record를 새 queued record로 원자 교체
- 자동 merge는 하지 않음

- [ ] **Step 5: offline read와 banner 연결**

- network snapshot 성공 시 cache 저장
- network 실패 시 같은 trip cache를 사용하고 offline 표시
- cache가 없으면 명확한 offline empty state
- `OfflineBanner`에 online/offline, queued count, conflict count, last sync 표시

- [ ] **Step 6: Task 11 검증**

Run:

```bash
npm test -- src/services/offline src/services/sync src/components/OfflineBanner
npm test
npm run test:worker
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Expected: 순서, 같은 key 재전송, 15초 trigger, event cleanup, conflict 선택, revoke cache 폐기가 PASS.

- [ ] **Step 7: Task 11 commit**

```bash
git add src/services/offline src/services/sync src/services/api src/services/mutations src/data/api src/components/OfflineBanner.tsx src/app/App.tsx
git commit -m "feat: add offline trip synchronization"
```

---

### Task 12: Local AI Launcher, Currency, and Legacy Sydney Import

**Files:**
- Create: `src/pages/tools/ai/AiLauncher.tsx`
- Create: `src/pages/tools/ai/prompt.ts`
- Create: `src/pages/tools/ai/ai.test.tsx`
- Create: `src/pages/tools/currency/CurrencyTool.tsx`
- Create: `src/pages/tools/currency/convert.ts`
- Create: `src/pages/tools/currency/currency.test.tsx`
- Create: `scripts/legacy/parse.mjs`
- Create: `scripts/legacy/render-sql.mjs`
- Create: `scripts/legacy/write-seed.mjs`
- Create: `scripts/legacy/parse.test.mjs`
- Modify: `src/pages/tools/ToolsPage.tsx`
- Modify: `src/styles/tools.css`

**Interfaces:**
- Consumes: privacy-filtered `TripSnapshot`, IndexedDB settings, legacy HTML
- Produces: `buildAiPrompt`, provider launcher, AUD↔KRW tool, deterministic legacy seed SQL

- [ ] **Step 1: AI privacy와 legacy count 실패 test 작성**

```ts
it("excludes reservation codes and personal notes from every prompt", () => {
  const prompt = buildAiPrompt(snapshot, { scope: "trip", selectedId: null });
  expect(prompt).not.toContain("ABC12345");
  expect(prompt).not.toContain("개인 메모");
});
```

Legacy expected counts:

```js
assert.equal(data.days.length, 8);
assert.equal(data.food.length, 28);
assert.equal(data.cafes.length, 20);
assert.equal(data.bookings.length, 7);
assert.equal(data.tips.length, 4);
```

- [ ] **Step 2: AI launcher 구현**

- provider: ChatGPT `https://chatgpt.com/`, Gemini `https://gemini.google.com/app`
- provider 선택은 IndexedDB `settings`에만 저장
- prompt scope: trip, today, selected place
- reservation code와 personal notes는 항상 제외
- provider tab open 후 clipboard write
- clipboard 실패 시 readonly textarea 표시
- popup 실패 시 안전한 provider link 표시
- prompt history 저장 없음

- [ ] **Step 3: 환율 tool 구현**

```ts
export function convertAudToKrw(amountAud: number, krwPerAud: number): number {
  if (!Number.isFinite(amountAud) || amountAud < 0) {
    throw new Error("AUD 금액은 0 이상이어야 합니다.");
  }
  if (!Number.isFinite(krwPerAud) || krwPerAud <= 0) {
    throw new Error("환율은 0보다 커야 합니다.");
  }
  return Math.round(amountAud * krwPerAud);
}
```

- 기본은 사용자 직접 입력
- `환율 불러오기`를 눌렀을 때만 `https://open.er-api.com/v6/latest/AUD` 요청
- 실패 시 기존 입력 유지
- 최근 성공 rate/time만 local settings 저장

- [ ] **Step 4: deterministic legacy importer 구현**

- source: `schedule.html`, `food.html`, `cafe.html`, `booking.html`, `tips.html`
- timezone: `Australia/Sydney`
- trip ID: `legacy-sydney-2026`
- dates: 2026-10-08~2026-10-15
- `data_imports.key = 'legacy-sydney-v1'`로 중복 방지
- SQL single quote escape
- 출력: `.tmp/legacy-sydney.sql`
- 같은 input은 byte-for-byte 같은 SQL
- 원본 HTML 삭제·수정 금지

- [ ] **Step 5: Task 12 검증**

Run:

```bash
npm test -- src/pages/tools/ai src/pages/tools/currency
node --test scripts/legacy/parse.test.mjs
npm run seed:legacy
cp .tmp/legacy-sydney.sql .tmp/legacy-sydney.first.sql
npm run seed:legacy
cmp .tmp/legacy-sydney.first.sql .tmp/legacy-sydney.sql
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Expected: AI privacy, 환율 입력 validation, 8/28/20/7/4 count, deterministic SQL이 PASS.

- [ ] **Step 6: Task 12 commit**

```bash
git add src/pages/tools scripts/legacy src/styles/tools.css
git commit -m "feat: preserve Sydney guide and local AI tools"
```

---

### Task 13: E2E, Device QA, and Approved Cloudflare Production Gate

**Files:**
- Create: `playwright.config.ts`
- Create: `test/e2e/helpers.ts`
- Create: `test/e2e/pairing.spec.ts`
- Create: `test/e2e/collaboration.spec.ts`
- Create: `test/e2e/offline-conflict.spec.ts`
- Create: `test/e2e/responsive.spec.ts`
- Create: `docs/qa/phase-1-manual-checklist.md`
- Modify after explicit approval: `wrangler.jsonc`
- Modify after explicit approval: `wrangler.admin.jsonc`
- Modify only after successful Cloudflare verification and separate approval: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: complete Phase 1 app
- Produces: automated evidence, manual device evidence, approved Cloudflare production

- [ ] **Step 1: owner·partner E2E 작성**

Independent scenarios:

- QR/link claim, 10-minute expiry, replay rejection
- owner revoke → partner API immediate 401
- both roles create/edit/trash/restore trip
- schedule/place/booking/checklist/note/vote shared edit
- personal data invisible to the other context
- 15-second poll
- offline read, queued mutation, reconnect flush
- conflict dialog both choices
- reservation code masked by default

- [ ] **Step 2: responsive·accessibility E2E 작성**

Projects:

- desktop Chromium 1440×900
- Android-like Chromium 390×844 touch
- iPhone-like WebKit 393×852 touch

Checks:

- no horizontal overflow
- keyboard route through nav/dialog/bottom sheet
- Escape close and focus return
- reduced motion
- light/dark/system
- PWA manifest and service worker

- [ ] **Step 3: full automated gate**

```bash
npm run typecheck
npm run lint
npm test
npm run test:worker
XDG_CONFIG_HOME=.tmp/wrangler npm run build
npx playwright install chromium webkit
npm run test:e2e
git diff --check
```

Expected: all exit 0.

- [ ] **Step 4: manual Android·iPhone·PC QA 기록**

`docs/qa/phase-1-manual-checklist.md`에 date, device, OS, browser, result, screenshot path를 기록한다.

- Android Chrome install/standalone
- iPhone Safari Add to Home Screen/standalone
- PC Chrome owner Access
- actual QR scan
- airplane mode read/edit/reconnect
- revoke and cache deletion
- three target viewport layouts

- [ ] **Step 5: pre-production completion commit**

```bash
git add playwright.config.ts test/e2e docs/qa
git commit -m "test: verify couple travel phase one"
```

- [ ] **Step 6: 사용자 승인 gate**

다음 실제 값을 사용자에게 확인받기 전 중단한다.

- 관리자 host
- 공유 앱 host
- 관리자 이메일
- Cloudflare account와 zone
- D1 name `couple-travel-guide`
- Worker names `couple-travel-guide`, `couple-travel-guide-admin`

현재 Cloudflare Workers, D1, Access 무료 한도를 공식 문서에서 재확인하고 차이를 보고한다.

- [ ] **Step 7: 승인 후 production config·migration·deploy**

실제 UUID와 host만 기록한다. 비밀값은 Worker secret으로 넣고 Git에 저장하지 않는다.

```bash
npx wrangler d1 create couple-travel-guide
npx wrangler d1 migrations apply couple-travel-guide --remote
npm run seed:legacy
npx wrangler d1 execute couple-travel-guide --remote --file=.tmp/legacy-sydney.sql
XDG_CONFIG_HOME=.tmp/wrangler npm run build
npx wrangler deploy --config wrangler.jsonc
npx wrangler deploy --config wrangler.admin.jsonc
```

배포 후 공유 `/` 200, unauthenticated `/api/trips` 401, admin Access allow/deny, 두 host same D1을 검증한다.

- [ ] **Step 8: GitHub Pages 종료 별도 gate**

Cloudflare 두 host와 실기기 검증이 성공하고 사용자가 별도로 승인한 경우에만 Pages workflow를 제거한다.

```bash
git rm .github/workflows/deploy-pages.yml
git commit -m "ci: complete Cloudflare migration"
```

---

## Final Completion Gate

- [ ] Task 7~12 관련 unit·Worker test 통과
- [ ] Task 13 Playwright desktop·Android-like·iPhone-like 통과
- [ ] actual Android·iPhone·PC manual QA 증거
- [ ] owner·partner 공동 편집과 personal privacy 검증
- [ ] 15초 poll·offline outbox·conflict 두 선택 검증
- [ ] legacy 8/28/20/7/4 보존
- [ ] AI prompt와 storage에 reservation code·personal note 없음
- [ ] 승인된 Cloudflare 두 host와 same D1 검증
- [ ] Cloudflare 검증 전 GitHub Pages 유지

## Execution Order and Model Recommendation

| 순서 | Task | 의존성 | 추천 |
|---|---|---|---|
| 1 | Task 7 | Task 6 snapshot/mutation | GPT-5.6 Sol · High |
| 2 | Task 8 | Task 7 real workspace | GPT-5.6 Sol · High |
| 3 | Task 9 | Task 7 controller | GPT-5.6 Sol · High |
| 4 | Task 10 | Task 7 controller, Task 9 booking view | GPT-5.6 Sol · High |
| 5 | Task 11 | 모든 mutation UI | GPT-5.6 Sol · XHigh |
| 6 | Task 12 | stable snapshot/offline settings | GPT-5.6 Sol · High |
| 7 | Task 13 | Task 1~12 complete | GPT-5.6 Sol · XHigh |
