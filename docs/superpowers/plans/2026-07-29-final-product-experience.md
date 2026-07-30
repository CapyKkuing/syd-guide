# Final Product Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완성된 Phase 1 PWA 위에 승인된 여행 전·중·후 홈, 신뢰 가능한 오프라인 동작, 귀국 후 대표 사진, 앱 내부 추억 쇼츠를 추가한다.

**Architecture:** 기존 4-tab UI, snapshot/mutation, IndexedDB outbox, Worker·D1 경계를 유지한다. 여행 단계는 저장된 여정 경계시각으로 파생하며, 귀국 후 미디어는 권한이 확인된 private R2와 IndexedDB 축소본을 사용한다. 각 Task는 독립적으로 test-first 구현하고 전체 회귀검증 뒤에만 production 배포 판단을 한다.

**Tech Stack:** React 19, TypeScript 6, Vite 8 PWA, Hono, Cloudflare Workers, D1, private R2, IndexedDB/idb, Vitest, Testing Library, Playwright.

## Global Constraints

- 최종 제품 기준은 `docs/superpowers/specs/2026-07-29-final-product-design.md`다.
- 제품명은 모든 사용자 노출 위치에서 정확히 `우리만의 여행 가이드북`이다.
- 현재 4-tab route `today | schedule | map | tools`와 기존 편집 기능을 유지한다.
- 여행 단계는 `journeyStartsAt`과 `journeyEndsAt`을 우선하고 값이 없으면 `trip.status`를 사용한다.
- 여행 현지 날짜는 `trip.timeZone` IANA timezone으로 계산한다.
- 개인 준비물·개인 메모·예약번호 privacy 규칙을 약화하지 않는다.
- 미디어 object는 공개 URL로 제공하지 않고 trip membership 확인 뒤에만 읽고 쓴다.
- 자동 쇼츠는 2분 이내, 사용자 편집 결과는 3분을 절대 초과하지 않는다.
- 앱 내 기본 음악은 재배포 허용을 확인한 파일만 포함하고 라이선스 원문을 저장한다.
- 기존 GitHub Pages fixture preview는 read-only로 유지한다.
- Cloudflare R2 생성·binding·production migration·deploy는 사용자 승인 전 실행하지 않는다.
- 한 Task의 관련 테스트·typecheck·lint가 통과한 뒤 해당 Task만 commit한다.

---

## Current Baseline

- 기준 commit: `eced04f` (`feat: complete couple travel guide`)
- 완료 기능: 인증·기기 연결·여행 서재·일정·장소·투표·예약·준비물·메모·검색·활동·오프라인 outbox·충돌 처리·AI launcher·환율·legacy import
- 이번 계획은 기존 Task 1~13을 다시 구현하지 않는다.
- 다음 구현 번호는 Task 14부터 시작한다.

## Locked File Map

| 경로 | 책임 |
|---|---|
| `src/domain/tripPhase.ts` | 여정 경계시각으로 여행 전·중·후 단계 계산 |
| `src/data/api/snapshotMappers.ts` | snapshot을 단계별 홈 view model로 변환 |
| `src/pages/today/*` | 여행 전·중·후 홈 조립 |
| `src/pages/map/*` | 내부 장소 상세·외부 Google Maps 연결·offline fallback |
| `src/features/memories/*` | 대표 사진, 장면 편집, 쇼츠 재생 |
| `src/services/media/*` | 업로드·접근 URL·offline thumbnail cache |
| `worker/routes/media.ts` | trip membership을 강제하는 미디어 API |
| `worker/services/media.ts` | R2 key 생성·metadata validation·삭제 |
| `migrations/0003_trip_journey_media.sql` | 여정 경계·미디어·쇼츠 저장 구조 |

---

### Task 14: Product Name Guard and Journey Phase Model

**Files:**
- Create: `src/domain/tripPhase.ts`
- Create: `src/domain/tripPhase.test.ts`
- Create: `migrations/0003_trip_journey_media.sql`
- Modify: `src/shared/entities.ts`
- Modify: `src/shared/api.ts`
- Modify: `worker/db/trips.ts`
- Modify: `worker/routes/trips.ts`
- Modify: `src/data/api/snapshotMappers.ts`
- Modify: `src/data/api/snapshotMappers.test.ts`
- Modify: `src/app/pwaMetadata.test.ts`

**Interfaces:**
- Produces:

```ts
export type ExperiencePhase = "before" | "during" | "after";

export interface JourneyBoundary {
  journeyStartsAt: string | null;
  journeyEndsAt: string | null;
  fallbackStatus: "upcoming" | "active" | "completed";
}

export function deriveExperiencePhase(
  boundary: JourneyBoundary,
  now: Date
): ExperiencePhase;
```

- `Trip`에 `journeyStartsAt: string | null`, `journeyEndsAt: string | null`, `representativeMediaId: string | null`을 추가한다.

- [ ] **Step 1: 단계 경계 실패 test 작성**

```ts
it.each([
  ["2026-10-07T23:59:59.999Z", "before"],
  ["2026-10-08T00:00:00.000Z", "during"],
  ["2026-10-15T04:59:59.999Z", "during"],
  ["2026-10-15T05:00:00.000Z", "after"]
])("derives %s as %s", (now, expected) => {
  expect(deriveExperiencePhase({
    journeyStartsAt: "2026-10-08T00:00:00.000Z",
    journeyEndsAt: "2026-10-15T05:00:00.000Z",
    fallbackStatus: "upcoming"
  }, new Date(now))).toBe(expected);
});

it("falls back when boundaries are absent or reversed", () => {
  expect(deriveExperiencePhase({
    journeyStartsAt: null,
    journeyEndsAt: null,
    fallbackStatus: "completed"
  }, new Date())).toBe("after");
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm test -- src/domain/tripPhase.test.ts src/data/api/snapshotMappers.test.ts src/app/pwaMetadata.test.ts
```

Expected: `tripPhase.ts`와 새 필드가 없어 FAIL.

- [ ] **Step 3: migration과 phase 함수 구현**

`0003_trip_journey_media.sql`의 이 Task 범위:

```sql
ALTER TABLE trips ADD COLUMN journey_starts_at TEXT;
ALTER TABLE trips ADD COLUMN journey_ends_at TEXT;
ALTER TABLE trips ADD COLUMN representative_media_id TEXT;
```

`deriveExperiencePhase()`는 유효한 start/end와 `start < end`일 때만 경계를 사용한다. invalid date, 누락, 역전은 `upcoming→before`, `active→during`, `completed→after`로 변환한다.

- [ ] **Step 4: trip create/update·snapshot mapper 연결**

- API는 두 경계가 모두 있거나 모두 `null`인 입력만 허용한다.
- 두 값은 timezone offset이 있는 ISO datetime이어야 한다.
- `journeyStartsAt < journeyEndsAt`을 검증한다.
- mapper는 `phase`와 별도로 `experiencePhase`를 만들어 Today 화면이 사용하게 한다.

- [ ] **Step 5: 제품명 잔존 문자열 검사와 검증**

Run:

```bash
rg -n "둘만의[ ]여행 가이드북" . --glob '!node_modules/**' --glob '!dist/**'
npm test -- src/domain/tripPhase.test.ts src/data/api/snapshotMappers.test.ts src/app/pwaMetadata.test.ts
npm run typecheck
npm run lint
```

Expected: `rg` 출력 없음, 모든 command exit 0.

- [ ] **Step 6: commit**

```bash
git add migrations/0003_trip_journey_media.sql src/domain src/shared worker/db/trips.ts worker/routes/trips.ts src/data/api src/app/pwaMetadata.test.ts
git commit -m "feat: add journey phase boundaries"
```

---

### Task 15: Phase-Aware Today Home

**Files:**
- Create: `src/pages/today/BeforeTripHome.tsx`
- Create: `src/pages/today/BeforeTripHome.test.tsx`
- Create: `src/pages/today/DuringTripHome.tsx`
- Create: `src/pages/today/DuringTripHome.test.tsx`
- Create: `src/pages/today/AfterTripHome.tsx`
- Create: `src/pages/today/AfterTripHome.test.tsx`
- Create: `src/pages/today/homeSelectors.ts`
- Create: `src/pages/today/homeSelectors.test.ts`
- Modify: `src/data/contracts.ts`
- Modify: `src/pages/today/TodayPage.tsx`
- Modify: `src/pages/today/TodayPage.test.tsx`
- Modify: `src/styles/editorial.css`

**Interfaces:**
- Consumes: `ExperiencePhase`, `TripWorkspace`, existing schedule·booking·checklist view models.
- Produces:

```ts
export type UrgentGapKind =
  | "flight"
  | "lodging"
  | "required-booking"
  | "passport"
  | "essential-check-item";

export interface UrgentGap {
  kind: UrgentGapKind;
  label: string;
  href: string;
  priority: number;
}

export function selectUrgentGaps(workspace: TripWorkspace): UrgentGap[];
export function selectNextSchedule(
  items: ScheduleItemView[],
  now: Date
): ScheduleItemView[];
```

- [ ] **Step 1: selector 실패 test 작성**

```ts
it("returns only the next three unfinished schedule items", () => {
  expect(selectNextSchedule(items, new Date("2026-10-10T00:30:00Z"))
    .map((item) => item.id)).toEqual(["next", "later-1", "later-2"]);
});

it("sorts urgent gaps by flight, lodging, booking, passport, essentials", () => {
  expect(selectUrgentGaps(workspace).map((gap) => gap.kind)).toEqual([
    "flight", "lodging", "required-booking", "passport", "essential-check-item"
  ]);
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm test -- src/pages/today/homeSelectors.test.ts
```

Expected: selector exports가 없어 FAIL.

- [ ] **Step 3: selector와 단계별 component 구현**

- `BeforeTripHome`: 커버, D-day, 최대 3개 긴급 누락, `전체 준비 보기`.
- `DuringTripHome`: 다음 일정 3개, 날씨, 지도, 주변 장소 순서.
- `AfterTripHome`: 대표 사진, `여행 기록 보기`, `다시 여행 보기`, 미완료 정산 조건부 카드.
- `TodayPage`는 `experiencePhase`만 switch하고 내부 데이터를 다시 계산하지 않는다.

- [ ] **Step 4: 단계별 UI test 작성**

```ts
it("renders the during-trip cards in approved order", () => {
  render(<DuringTripHome {...props} />);
  expect(screen.getAllByRole("region").map((node) => node.dataset.section))
    .toEqual(["schedule", "weather", "map", "nearby"]);
});

it("hides settlement after completion", () => {
  render(<AfterTripHome {...props} settlement={{ status: "complete" }} />);
  expect(screen.queryByRole("region", { name: "정산" })).not.toBeInTheDocument();
});
```

- [ ] **Step 5: 검증**

Run:

```bash
npm test -- src/pages/today
npm run typecheck
npm run lint
```

Expected: exit 0.

- [ ] **Step 6: commit**

```bash
git add src/pages/today src/data/contracts.ts src/styles/editorial.css
git commit -m "feat: add phase aware travel home"
```

---

### Task 16: Trustworthy Place Details and Offline Status

**Files:**
- Create: `src/pages/map/googleMapsLinks.ts`
- Create: `src/pages/map/googleMapsLinks.test.ts`
- Create: `src/components/DataFreshness.tsx`
- Create: `src/components/DataFreshness.test.tsx`
- Modify: `src/pages/map/MapPlaceSheet.tsx`
- Modify: `src/pages/map/MapPage.tsx`
- Modify: `src/pages/map/MapPage.test.tsx`
- Modify: `src/pages/today/TodayCards.tsx`
- Modify: `src/components/OfflineBanner.tsx`
- Modify: `src/services/offline/settingsStore.ts`

**Interfaces:**

```ts
export interface Freshness {
  source: "live" | "cached" | "sample";
  updatedAt: string | null;
}

export function googleMapsSearchUrl(place: {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}): string;
```

- [ ] **Step 1: safe-link·freshness 실패 test 작성**

```ts
it("builds an encoded Google Maps search URL", () => {
  expect(googleMapsSearchUrl({
    name: "The Rocks Café",
    address: "99 George St",
    latitude: -33.859,
    longitude: 151.209
  })).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
});

it("labels cached weather with its update time", () => {
  render(<DataFreshness value={{ source: "cached", updatedAt: "2026-10-10T01:00:00Z" }} />);
  expect(screen.getByText(/마지막 업데이트/)).toBeVisible();
});
```

- [ ] **Step 2: 구현**

- 장소 sheet가 항상 먼저 열린다.
- `최신 정보 보기`와 `길찾기`만 Google Maps로 연결한다.
- 영업시간을 snapshot에 추가하지 않는다.
- offline일 때 지도 canvas 대신 전체 저장 장소 목록을 유지한다.
- 날씨·환율은 `live/cached/sample`과 갱신시각을 표시한다.

- [ ] **Step 3: 검증**

Run:

```bash
npm test -- src/pages/map src/components/DataFreshness.test.tsx src/pages/today
npm run typecheck
npm run lint
```

Expected: exit 0.

- [ ] **Step 4: commit**

```bash
git add src/pages/map src/components src/pages/today src/services/offline/settingsStore.ts
git commit -m "feat: clarify live and offline travel data"
```

---

### Task 17: Private Trip Media and Representative Photo

**Files:**
- Extend: `migrations/0003_trip_journey_media.sql`
- Create: `src/shared/media.ts`
- Create: `worker/services/media.ts`
- Create: `worker/services/media.test.ts`
- Create: `worker/routes/media.ts`
- Create: `test/worker/media.test.ts`
- Create: `src/services/media/mediaClient.ts`
- Create: `src/services/media/mediaClient.test.ts`
- Create: `src/services/media/mediaCache.ts`
- Create: `src/features/memories/RepresentativePhotoPicker.tsx`
- Create: `src/features/memories/RepresentativePhotoPicker.test.tsx`
- Modify: `worker/app.ts`
- Modify: `worker/env.ts`
- Modify: `wrangler.jsonc`
- Modify: `wrangler.admin.jsonc`
- Modify: `src/shared/api.ts`
- Modify: `src/data/api/snapshotMappers.ts`

**Interfaces:**

```ts
export type TripMediaKind = "photo" | "video";

export interface TripMedia {
  id: string;
  tripId: string;
  kind: TripMediaKind;
  objectKey: string;
  thumbnailKey: string;
  mimeType: string;
  width: number;
  height: number;
  durationMs: number | null;
  capturedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface MediaClient {
  list(tripId: string): Promise<TripMedia[]>;
  upload(tripId: string, file: File): Promise<TripMedia>;
  remove(tripId: string, mediaId: string): Promise<void>;
  accessUrl(tripId: string, mediaId: string, variant: "original" | "thumbnail"): Promise<string>;
}
```

- [ ] **Step 1: private access 실패 test 작성**

```ts
it("denies media from a trip the principal does not belong to", async () => {
  const response = await app.request("/api/trips/trip-other/media/media-1", {}, env);
  expect(response.status).toBe(404);
});

it("rejects unsupported or oversized media", async () => {
  await expect(service.validateUpload({
    type: "application/pdf",
    size: 100
  })).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
});
```

- [ ] **Step 2: schema·R2 service 구현**

`0003_trip_journey_media.sql`에 다음을 추가한다.

```sql
CREATE TABLE trip_media (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
  object_key TEXT NOT NULL UNIQUE,
  thumbnail_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  duration_ms INTEGER,
  captured_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_trip_media_trip_created
  ON trip_media(trip_id, created_at);
```

- 허용 MIME: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`.
- 1개 파일 상한: 사진 25 MiB, 영상 250 MiB.
- key 형식: `trips/{tripId}/{mediaId}/original`과 `.../thumbnail.webp`.
- client가 보낸 object key는 사용하지 않는다.
- R2 binding 이름은 `TRIP_MEDIA`.

- [ ] **Step 3: authenticated routes와 client 구현**

- `GET /api/trips/:tripId/media`
- `POST /api/trips/:tripId/media`
- `GET /api/trips/:tripId/media/:mediaId/:variant`
- `DELETE /api/trips/:tripId/media/:mediaId`
- 모든 route는 현재 principal의 trip membership을 확인한다.
- access URL은 공개 bucket URL이 아니라 인증된 Worker response를 사용한다.

- [ ] **Step 4: 대표 사진 선택과 offline thumbnail cache 구현**

- 첫 추천은 해상도가 충분한 가로/세로 사진 중 가장 최근 촬영된 사진이다.
- 사용자가 선택하면 trip의 `representativeMediaId`를 mutation한다.
- thumbnail만 IndexedDB에 저장하고 storage pressure 시 오래된 여행부터 제거한다.

- [ ] **Step 5: 검증**

Run:

```bash
npm run test:worker -- test/worker/media.test.ts worker/services/media.test.ts
npm test -- src/services/media src/features/memories/RepresentativePhotoPicker.test.tsx
npm run typecheck
npm run lint
```

Expected: membership, MIME/size, 대표 사진, cache test가 모두 PASS.

- [ ] **Step 6: commit**

```bash
git add migrations/0003_trip_journey_media.sql src/shared src/services/media src/features/memories worker test/worker/media.test.ts wrangler.jsonc wrangler.admin.jsonc
git commit -m "feat: add private trip memories"
```

---

### Task 18: Memory Reel Composer

**Files:**
- Create: `src/features/memories/reel/types.ts`
- Create: `src/features/memories/reel/composeReel.ts`
- Create: `src/features/memories/reel/composeReel.test.ts`
- Create: `src/features/memories/reel/ReelEditor.tsx`
- Create: `src/features/memories/reel/ReelEditor.test.tsx`
- Create: `src/features/memories/reel/reelStore.ts`
- Modify: `src/services/offline/database.ts`
- Modify: `src/pages/today/AfterTripHome.tsx`

**Interfaces:**

```ts
export interface ReelScene {
  id: string;
  mediaId: string;
  kind: "photo" | "video";
  durationMs: number;
  sourceDurationMs: number | null;
}

export interface TravelReel {
  tripId: string;
  musicId: string;
  scenes: ReelScene[];
  durationMs: number;
  mode: "auto" | "edited";
}

export function composeReel(
  media: TripMedia[],
  options?: { maxDurationMs?: number }
): TravelReel;

export function replaceScene(
  reel: TravelReel,
  currentSceneId: string,
  replacement: TripMedia
): TravelReel;
```

- [ ] **Step 1: duration·dedupe 실패 test 작성**

```ts
it("keeps an automatic reel at or below two minutes", () => {
  expect(composeReel(media).durationMs).toBeLessThanOrEqual(120_000);
});

it("never lets an edited reel exceed three minutes", () => {
  expect(addScene(editedReel, longVideo).durationMs).toBeLessThanOrEqual(180_000);
});

it("replaces in place and moves the old scene to excluded media", () => {
  const next = replaceScene(reel, "scene-2", replacement);
  expect(next.scenes[1]?.mediaId).toBe(replacement.id);
});
```

- [ ] **Step 2: deterministic composer 구현**

- 촬영시각이 있으면 촬영시각, 없으면 업로드시각으로 정렬한다.
- 연속 촬영·같은 thumbnail perceptual hash 그룹은 대표 1개를 우선한다.
- 사진 기본 3초, 영상은 최대 8초를 사용한다.
- 자동 구성은 120초에서 중단한다.
- 사용자 추가 시 장면 시간 축소 → 유사 장면 제외 → 낮은 해상도 제외 순으로 180초를 지킨다.
- 원본 `TripMedia` row는 composer가 삭제하지 않는다.

- [ ] **Step 3: editor 구현**

- 추가·제외·drag 순서 변경·비교 후 교체.
- 자동 제외 목록.
- `자동 구성으로 되돌리기`.
- 한 단계 `실행 취소`.
- 예상 총 재생시간을 실시간 표시.

- [ ] **Step 4: IndexedDB reel 저장**

DB version을 올리고 `reels` store key를 `tripId`로 사용한다. 저장값은 scene metadata와 music id만 포함하며 object URL은 저장하지 않는다.

- [ ] **Step 5: 검증**

Run:

```bash
npm test -- src/features/memories/reel src/services/offline/offline.test.ts
npm run typecheck
npm run lint
```

Expected: 2분/3분 경계, 교체, undo, 저장 test가 PASS.

- [ ] **Step 6: commit**

```bash
git add src/features/memories/reel src/services/offline/database.ts src/pages/today/AfterTripHome.tsx
git commit -m "feat: compose editable travel reels"
```

---

### Task 19: Vertical Reel Player and Licensed Music

**Files:**
- Create: `src/features/memories/player/ReelPlayer.tsx`
- Create: `src/features/memories/player/ReelPlayer.test.tsx`
- Create: `src/features/memories/player/useReelPlayback.ts`
- Create: `src/features/memories/player/useReelPlayback.test.ts`
- Create: `src/features/memories/player/reel-player.css`
- Create: `src/features/memories/music/catalog.ts`
- Create: `src/features/memories/music/catalog.test.ts`
- Create: `public/audio/LICENSES.md`
- Modify: `src/app/router.tsx`
- Modify: `src/app/TripRoutePage.tsx`
- Modify: `vite.config.ts`

**Interfaces:**

```ts
export interface MusicTrack {
  id: string;
  title: string;
  mood: "emotional" | "upbeat" | "calm" | "night" | "sea" | "city";
  src: string;
  license: string;
  attribution: string;
}

export interface PlaybackCheckpoint {
  sceneId: string;
  completed: boolean;
}
```

- [ ] **Step 1: playback reducer 실패 test 작성**

```ts
it("shows controls without pausing on a canvas tap", () => {
  const next = playbackReducer(playing, { type: "SHOW_CONTROLS" });
  expect(next.playing).toBe(true);
  expect(next.controlsVisible).toBe(true);
});

it("resumes an interrupted session at the start of the saved scene", () => {
  expect(resumeFrom({ sceneId: "scene-3", completed: false }, reel))
    .toMatchObject({ sceneIndex: 2, elapsedMs: 0 });
});
```

- [ ] **Step 2: player 구현**

- portrait route로 고정하고 가로 media는 `contain` 원본 + blurred `cover` background 두 layer로 렌더링한다.
- 기본 controls hidden, tap은 controls만 표시한다.
- pause button만 playback을 멈춘다.
- 좌/우 30% tap zone은 이전/다음 장면.
- visibility가 hidden이면 pause하고 현재 scene id만 저장한다.
- 복귀 시 scene 처음 화면에서 paused 상태로 대기한다.
- 완주하지 않은 재진입은 `이어보기 / 처음부터` dialog를 연다.

- [ ] **Step 3: 음악 catalog와 audio ducking 구현**

- 실제 audio asset을 추가하기 전 각 후보의 redistribution 조건을 확인한다.
- `LICENSES.md`에는 파일명, 곡명, 저작자, 원문 URL, 라이선스명, 다운로드일을 기록한다.
- 음악 교체는 600ms crossfade.
- 영상 원음 시작 시 BGM gain을 20%로 250ms 동안 낮추고 종료 시 복원한다.
- fixture/test에서는 작은 무음 fixture audio를 사용한다.

- [ ] **Step 4: route·PWA cache 연결**

- `/trips/:tripId/memories` editor route.
- `/trips/:tripId/memories/play` player route.
- audio asset은 Workbox precache에 포함하되 private media response는 precache하지 않는다.

- [ ] **Step 5: 검증**

Run:

```bash
npm test -- src/features/memories/player src/features/memories/music
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
```

Expected: playback state, resume, orientation layout, catalog, build가 PASS.

- [ ] **Step 6: commit**

```bash
git add src/features/memories/player src/features/memories/music public/audio src/app vite.config.ts
git commit -m "feat: add private memory reel playback"
```

---

### Task 20: End-to-End Regression and Deployment Gate

**Files:**
- Create: `test/e2e/trip-phases.spec.ts`
- Create: `test/e2e/memory-reel.spec.ts`
- Modify: `test/e2e/responsive.spec.ts`
- Modify: `test/e2e/offline-conflict.spec.ts`
- Modify: `docs/qa/phase-1-manual-checklist.md`
- Modify: `docs/handoffs/2026-07-30-pwa-offline-cold-start.md`
- Modify: `TASKS.md`

**Interfaces:**
- Consumes: completed Tasks 14–19.
- Produces: reproducible automated evidence and a manual mobile QA checklist.

- [ ] **Step 1: E2E phase test 작성**

검증 시나리오:

1. 경계 전에는 커버와 긴급 누락만 우선 노출.
2. 경계 사이에는 다음 3개 일정 → 날씨 → 지도 → 주변 장소 순서.
3. 귀국 후에는 대표 사진과 두 개의 회고 행동 노출.
4. 완료된 정산은 숨김.

- [ ] **Step 2: E2E reel test 작성**

검증 시나리오:

1. 자동 reel은 2분 이하.
2. 편집 후에도 3분 이하.
3. controls tap은 재생을 멈추지 않음.
4. 일시정지·재개는 정확한 시점.
5. page visibility 복귀는 현재 장면 처음의 paused 상태.
6. 가로 media는 crop 없이 표시.

- [ ] **Step 3: 전체 자동검증**

Run:

```bash
npm test
npm run test:worker
npm run typecheck
npm run lint
XDG_CONFIG_HOME=.tmp/wrangler npm run build
npm run test:e2e
git diff --check
```

Expected: 모든 command exit 0, test failure 0.

- [ ] **Step 4: 실기기 QA**

- Android Chrome 설치형 PWA
- iPhone Safari 홈 화면 추가 PWA
- Windows Chrome
- 라이트·다크·시스템 테마
- offline cold/warm start
- background·screen lock 복귀
- 44px touch target, keyboard focus, reduced motion
- private media가 다른 trip/session에서 열리지 않음

- [ ] **Step 5: 문서·상태 갱신**

- `TASKS.md`의 Task 14~20을 실제 결과대로 갱신한다.
- `docs/handoffs/2026-07-30-pwa-offline-cold-start.md`에 기준 commit, 남은 blocker, R2·production 승인 필요사항을 기록한다.
- 실기기 QA가 끝나지 않았으면 `완료`라고 쓰지 않고 `자동검증 완료 / 실기기 QA 대기`로 구분한다.

- [ ] **Step 6: commit**

```bash
git add test/e2e docs/qa docs/handoffs/2026-07-30-pwa-offline-cold-start.md TASKS.md
git commit -m "test: verify final travel experience"
```

## Final Production Gate

다음은 이 계획을 구현했다고 자동 승인되지 않는다.

- Cloudflare R2 bucket 생성
- D1 production migration
- Worker production binding 변경
- production deploy
- 실제 미디어 업로드 비용 발생

자동검증과 실기기 QA 결과를 보고한 뒤 사용자의 명시 승인을 받아 별도 실행한다.
