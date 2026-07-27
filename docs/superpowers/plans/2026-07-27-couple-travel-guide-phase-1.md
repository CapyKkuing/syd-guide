# Couple Travel Guide Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 시드니 정적 가이드를 보존하면서 두 사람이 설치·공동 편집·오프라인 동기화할 수 있는 Cloudflare 무료 구성의 여행 PWA를 만든다.

**Architecture:** 하나의 React·TypeScript 코드베이스를 관리자 호스트와 공유 호스트에 각각 배포한다. Cloudflare Worker가 정적 앱과 API를 함께 제공하고, 관리자 호스트는 Cloudflare Access JWT, 공유 호스트는 1회용 초대로 발급한 기기 세션 쿠키를 검증하며, 둘은 같은 D1을 사용한다. 클라이언트는 전체 여행 snapshot과 멱등 mutation API를 사용하고 IndexedDB outbox로 오프라인 수정을 동기화한다.

**Tech Stack:** npm, React, TypeScript, Vite, Hono, Zod, Cloudflare Workers Static Assets, Cloudflare Access, D1, `@cloudflare/vite-plugin`, `@cloudflare/vitest-pool-workers`, Vitest, Testing Library, Playwright, `vite-plugin-pwa`, `idb`, `jose`, `qrcode`, MapLibre GL, Cheerio.

## Global Constraints

- 승인 설계는 `docs/superpowers/specs/2026-07-27-couple-travel-guide-phase-1-design.md`다.
- 이번 계획은 1단계만 구현한다. 비용·영수증 분석·AI 동선은 2단계, 사진 업로드·추억 지도·AI 여행책은 3단계 범위다.
- Cloudflare 무료 플랜만 사용한다. R2와 Workers AI는 1단계에서 바인딩하거나 호출하지 않는다.
- 관리자 한 명만 Cloudflare Access 이메일 인증을 사용한다.
- 여자친구는 계정을 만들지 않고 10분 유효한 256비트 1회용 QR·링크로 기기를 연결한다.
- 기기 세션은 `HttpOnly; Secure; SameSite=Strict` 쿠키다. 90일 미사용 시 만료하며 정상 사용 시 하루에 한 번 만료일을 연장한다.
- 초대·세션 원문은 서버에 저장하지 않고 SHA-256 해시만 저장한다.
- 관리자만 초대 발급·연결 기기 해제가 가능하다.
- 두 사용자 모두 일반 여행 데이터 생성·수정·30일 휴지통 이동·복구가 가능하다.
- 수정 충돌은 자동 덮어쓰지 않고 `내 수정 유지` 또는 `최신 내용 사용`을 고르게 한다.
- 동기화는 시작·전면 복귀·온라인 복구·수동 새로고침·전면 표시 중 15초 간격으로 수행한다.
- 외부 유료 지도 API는 사용하지 않는다. MapLibre의 무료 공개 스타일은 온라인 지도 배경에만 쓰고, 실패하거나 오프라인이면 저장된 장소 목록과 Google 지도 링크를 유지한다.
- ChatGPT·Gemini 선택값과 생성 질문은 기기 로컬에만 둔다. D1과 상대 기기에 저장하지 않는다.
- 새로운 기능 파일은 보통 100~250줄을 목표로 한다. 250줄을 넘기기 전에 데이터 접근, 상태 처리, 화면 조립 중 책임이 다른 부분을 분리한다.
- 기존 시드니 콘텐츠 원본 HTML은 삭제하지 않는다. 이 계획의 importer가 원본을 읽어 D1 seed SQL을 만든다.
- 제품 코드는 새 디자인을 사용한다. 따뜻한 종이색과 하버 틸은 유지하지만 편집 잡지형 겹침 카드와 기존 내비게이션은 재사용하지 않는다.
- 비밀값, 이메일, Access 설정값, 실제 세션값은 Git에 저장하지 않는다.
- 이 작업에서 `단계`는 세부 checkbox가 아니라 13개 Task를 뜻한다. 각 Task의 관련 검증이 모두 통과하면 추가 확인 없이 자동 commit(커밋: 변경 이력 저장)한다.
- push(푸시)와 PR 생성은 자동 실행하지 않고 Task마다 상태를 반복 보고하지 않는다. 원격 백업, 코드 리뷰, 통합 확인이 필요한 중요 경계라고 판단한 때만 이유와 현재 상태를 한 번 보고하고 명시 승인을 요청한다.
- merge(병합)는 항상 명시 승인 전 실행하지 않는다.
- Cloudflare 리소스 생성·수정·production 배포는 Task 1~12 구현, Task 13 자동 검사, 실제 Android·iPhone·PC QA가 모두 완료된 뒤에만 필요성을 보고하고 명시 승인을 요청한다. 그 전에는 배포 명령을 실행하지 않는다.

현재 구성 근거:

- Cloudflare Static Assets selective Worker routing: `https://developers.cloudflare.com/workers/static-assets/binding/`
- Cloudflare D1 무료 한도·초과 동작: `https://developers.cloudflare.com/d1/platform/pricing/`
- Cloudflare D1 Free database limit: `https://developers.cloudflare.com/d1/platform/limits/`
- OpenFreeMap MapLibre style: `https://openfreemap.org/quick_start/`

---

## File Map

### 앱 시작과 공통 UI

| 경로 | 책임 |
|---|---|
| `index.html` | Vite 진입 HTML |
| `src/main.tsx` | React 부팅 |
| `src/app/App.tsx` | 세션 확인 후 라우터 표시 |
| `src/app/router.tsx` | 페이지 경로 정의 |
| `src/app/AppShell.tsx` | 상단 상태와 모바일 하단 내비게이션 |
| `src/app/SessionGate.tsx` | 관리자·파트너·미연결 상태 분기 |
| `src/components/*` | 두 기능 이상에서 재사용하는 버튼, 필드, 모달, 상태 표시 |
| `src/styles/tokens.css` | 색상·간격·타입 토큰 |
| `src/styles/base.css` | reset, 접근성, 공통 레이아웃 |
| `src/styles/components.css` | 공통 컨트롤 스타일 |

### 기능

| 경로 | 책임 |
|---|---|
| `src/features/auth/*` | 세션, 초대, QR, 기기 관리 |
| `src/features/trips/*` | 여행 서재, 생성·수정·휴지통 |
| `src/features/schedule/*` | 날짜별 일정 편집과 순서 |
| `src/features/today/*` | 오늘 한 장 |
| `src/features/places/*` | 장소 목록·상태·지도·투표 |
| `src/features/bookings/*` | 예약 편집과 예약번호 마스킹 |
| `src/features/checklist/*` | 공동·개인 준비물 |
| `src/features/notes/*` | 범위별 공동·개인 메모 |
| `src/features/search/*` | 여행 내부 통합 검색·필터·정렬 |
| `src/features/ai-launcher/*` | 로컬 AI 선택, 질문 생성, 외부 열기 |
| `src/features/currency/*` | AUD↔KRW 계산기 |
| `src/services/api/*` | HTTP 요청과 오류 정규화 |
| `src/services/offline/*` | IndexedDB snapshot·outbox |
| `src/services/sync/*` | 15초 poll, flush, 충돌 처리 |
| `src/shared/*` | 프런트와 Worker가 함께 쓰는 타입·Zod schema |

### Worker와 D1

| 경로 | 책임 |
|---|---|
| `worker/index.ts` | Cloudflare fetch·scheduled 진입점 |
| `worker/app.ts` | Hono 앱 조립 |
| `worker/env.ts` | 바인딩·환경 타입 |
| `worker/http/errors.ts` | JSON 오류 응답 |
| `worker/auth/*` | Access JWT, 세션 쿠키, origin 검사 |
| `worker/routes/*` | auth, trips, snapshot, mutation route |
| `worker/db/*` | D1 query와 row 변환 |
| `worker/services/*` | 초대 교환, mutation, purge |
| `migrations/0001_initial.sql` | 1단계 전체 schema |
| `migrations/0002_legacy_sydney_marker.sql` | 중복 seed 방지 marker |

### 테스트·도구·배포

| 경로 | 책임 |
|---|---|
| `src/test/setup.ts` | jsdom, IndexedDB test setup |
| `test/worker/*` | Miniflare·D1 API 테스트 |
| `test/e2e/*` | 두 브라우저 세션 핵심 흐름 |
| `scripts/legacy/*` | 기존 HTML 파싱과 seed SQL 생성 |
| `scripts/make-pwa-icons.mjs` | 기존 로고에서 PWA icon 생성 |
| `wrangler.jsonc` | 로컬·파트너 Worker 기본 구성 |
| `wrangler.admin.jsonc` | 관리자 Worker와 scheduled purge 구성 |
| `vite.config.ts` | React·Cloudflare·PWA build |
| `vitest.config.ts` | 프런트 단위 테스트 |
| `vitest.worker.config.ts` | Worker·D1 테스트 |
| `playwright.config.ts` | desktop·mobile E2E |

## Shared Interfaces

다음 이름은 전 Task에서 그대로 사용한다.

```ts
export type MemberRole = "owner" | "partner";
export type TripStatus = "upcoming" | "active" | "completed";
export type PlaceCategory = "restaurant" | "cafe" | "attraction" | "lodging" | "transport";
export type PlaceStatus = "saved" | "maybe" | "visited";
export type VoteChoice = "must" | "okay" | "skip";
export type EntityKind =
  | "trip_day"
  | "schedule_item"
  | "place"
  | "booking"
  | "check_item"
  | "note"
  | "vote";

export interface Principal {
  memberId: string;
  role: MemberRole;
  sessionId?: string;
}

export interface VersionedEntity {
  id: string;
  tripId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PublicMember {
  id: string;
  role: MemberRole;
  displayName: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  status: TripStatus;
  coverImageUrl: string | null;
  version: number;
  syncVersion: number;
  deletedAt: string | null;
  purgeAfter: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripDay extends VersionedEntity {
  dayDate: string;
  title: string;
  position: number;
}

export interface ScheduleItem extends VersionedEntity {
  tripDayId: string;
  placeId: string | null;
  bookingId: string | null;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  memo: string;
  travelMode: "walk" | "transit" | "drive" | "ferry" | "other" | null;
  travelNote: string;
  position: number;
  isFixed: boolean;
  isDone: boolean;
}

export interface Place extends VersionedEntity {
  name: string;
  category: PlaceCategory;
  status: PlaceStatus;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  description: string;
  savedBy: string | null;
}

export interface Booking extends VersionedEntity {
  placeId: string | null;
  bookingType: "flight" | "lodging" | "ticket" | "tour" | "transport" | "restaurant" | "other";
  provider: string;
  startsAt: string;
  endsAt: string | null;
  reservationCode: string | null;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  externalUrl: string | null;
  documentUrl: string | null;
  memo: string;
  isFixed: boolean;
}

export interface CheckItem extends VersionedEntity {
  scope: "shared" | "personal";
  ownerMemberId: string | null;
  assigneeMemberId: string | null;
  title: string;
  quantity: number;
  memo: string;
  isDone: boolean;
  position: number;
}

export interface Note extends VersionedEntity {
  targetType: "trip" | "schedule_item" | "place" | "booking";
  targetId: string | null;
  visibility: "shared" | "personal";
  authorMemberId: string;
  body: string;
  attachmentUrl: string | null;
}

export interface Vote extends VersionedEntity {
  targetType: "place" | "schedule_item";
  targetId: string;
  memberId: string;
  choice: VoteChoice;
}

export interface ActivityLog {
  id: string;
  tripId: string;
  memberId: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
}

export interface EntityMap {
  trip_day: TripDay;
  schedule_item: ScheduleItem;
  place: Place;
  booking: Booking;
  check_item: CheckItem;
  note: Note;
  vote: Vote;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface TripSnapshot {
  trip: Trip;
  members: PublicMember[];
  days: TripDay[];
  scheduleItems: ScheduleItem[];
  places: Place[];
  bookings: Booking[];
  checkItems: CheckItem[];
  notes: Note[];
  votes: Vote[];
  activity: ActivityLog[];
  syncVersion: number;
}

export interface MutationRequest<K extends EntityKind = EntityKind> {
  idempotencyKey: string;
  entity: K;
  action: "create" | "update" | "delete";
  entityId: string;
  baseVersion: number | null;
  payload: MutationPayloadMap[K] | null;
}

export interface MutationSuccess {
  entity: EntityKind;
  entityId: string;
  version: number;
  syncVersion: number;
}

export interface VersionConflict<K extends EntityKind = EntityKind> {
  code: "VERSION_CONFLICT";
  mutation: MutationRequest<K>;
  current: EntityMap[K];
}
```

---

### Task 1: Vite·React·PWA shell과 새 디자인 시스템

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.worker.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/components/InstallPrompt.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Create: `src/styles/components.css`
- Create: `src/test/setup.ts`
- Create: `src/app/AppShell.test.tsx`
- Create: `scripts/make-pwa-icons.mjs`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Move: `images/` → `public/images/`
- Modify: `index.html:1-16`
- Modify: `.gitignore`
- Modify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: 기존 정사각형 로고 `stitch_sydney_travel_guidebook_extracted/stitch_sydney_travel_guidebook/sydney_travel_guide_logo/screen.png`
- Produces: `App`, `AppShell`, `/library` 기본 route, 설치 가능한 manifest와 service worker

- [ ] **Step 1: package와 test shell 작성**

`package.json` scripts는 다음 이름을 고정한다.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run --config vitest.config.ts",
    "test:worker": "vitest run --config vitest.worker.config.ts",
    "test:e2e": "playwright test",
    "icons": "node scripts/make-pwa-icons.mjs",
    "seed:legacy": "node scripts/legacy/write-seed.mjs"
  }
}
```

설치 명령:

```bash
npm install react react-dom react-router-dom hono zod idb jose qrcode maplibre-gl
npm install -D typescript vite @vitejs/plugin-react @cloudflare/vite-plugin wrangler vite-plugin-pwa vitest @cloudflare/vitest-pool-workers @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom fake-indexeddb eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh @playwright/test sharp cheerio @types/react @types/react-dom @types/qrcode
```

`.gitignore`에 다음 local 산출물만 추가한다.

```gitignore
node_modules/
dist/
.wrangler/
.dev.vars*
playwright-report/
test-results/
.tmp/
```

- [ ] **Step 2: 실패하는 앱 shell 테스트 작성**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./AppShell";

it("shows the product name and mobile navigation", () => {
  render(
    <MemoryRouter>
      <AppShell><p>화면</p></AppShell>
    </MemoryRouter>,
  );

  expect(screen.getByText("둘만의 여행 가이드북")).toBeVisible();
  expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
  expect(screen.getByText("화면")).toBeVisible();
});
```

Run: `npm test -- src/app/AppShell.test.tsx`

Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 3: 최소 shell과 디자인 token 구현**

`src/styles/tokens.css`:

```css
:root {
  --paper: #f7f3ea;
  --surface: #fffdf8;
  --surface-strong: #ffffff;
  --ink: #1d2b2b;
  --muted: #697572;
  --line: #d9ded8;
  --teal: #0b6b67;
  --teal-soft: #dcecea;
  --danger: #a43d3d;
  --shadow: 0 12px 30px rgb(28 54 52 / 0.08);
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --content: 1120px;
}
```

`AppShell`은 `header`, `main`, `nav aria-label="주요 메뉴"`만 조립한다. 데스크톱에서는 왼쪽 rail, 760px 이하에서는 5개 하단 탭으로 바꾼다. 최소 터치 영역은 44×44px, `:focus-visible` outline은 3px `--teal`이다.

`InstallPrompt`는 `beforeinstallprompt` event가 있으면 `앱 설치` 버튼을 표시한다. standalone mode에서는 숨긴다. iOS Safari에서는 `공유 → 홈 화면에 추가` 안내만 표시한다.

`vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "둘만의 여행 가이드북",
        short_name: "여행 가이드",
        display: "standalone",
        start_url: "/library",
        background_color: "#f7f3ea",
        theme_color: "#0b6b67",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly"
          }
        ]
      }
    })
  ]
});
```

이미지 이동과 icon 생성:

```bash
mkdir -p public/icons
git mv images public/images
npm run icons
```

`scripts/make-pwa-icons.mjs`:

```js
import sharp from "sharp";

const source = "stitch_sydney_travel_guidebook_extracted/stitch_sydney_travel_guidebook/sydney_travel_guide_logo/screen.png";

await Promise.all(
  [192, 512].map((size) =>
    sharp(source)
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}.png`),
  ),
);
```

GitHub Pages workflow는 Cloudflare 전환 전 임시 미리보기를 보존하도록 다음 steps로 바꾼다.

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4
  - name: Setup Node
    uses: actions/setup-node@v4
    with:
      node-version: 24
      cache: npm
  - name: Install dependencies
    run: npm ci
  - name: Build
    run: npm run build
  - name: Configure Pages
    uses: actions/configure-pages@v5
    with:
      enablement: true
  - name: Upload artifact
    uses: actions/upload-pages-artifact@v3
    with:
      path: dist
  - name: Deploy to GitHub Pages
    id: deployment
    uses: actions/deploy-pages@v4
```

- [ ] **Step 4: shell 검증**

Run:

```bash
npm run icons
npm run typecheck
npm run lint
npm test -- src/app/AppShell.test.tsx
npm run build
```

Expected: 모두 exit 0. `dist/manifest.webmanifest`, 두 icon, service worker가 존재한다.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add package.json package-lock.json tsconfig*.json vite.config.ts eslint.config.js index.html .gitignore .github/workflows/deploy-pages.yml src public scripts/make-pwa-icons.mjs
git commit -m "feat: scaffold couple travel PWA"
```

---

### Task 2: Worker runtime, 공유 계약, D1 schema

**Files:**
- Create: `wrangler.jsonc`
- Create: `wrangler.admin.jsonc`
- Create: `vitest.config.ts`
- Create: `vitest.worker.config.ts`
- Create: `worker/index.ts`
- Create: `worker/app.ts`
- Create: `worker/env.ts`
- Create: `worker/http/errors.ts`
- Create: `src/shared/entities.ts`
- Create: `src/shared/api.ts`
- Create: `migrations/0001_initial.sql`
- Create: `migrations/0002_legacy_sydney_marker.sql`
- Create: `test/worker/apply-migrations.ts`
- Create: `test/worker/health.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `App` build와 Global Constraints
- Produces: `Env`, `AppEnv`, `createApp()`, D1 tables, entity types와 `TripSnapshot`

- [ ] **Step 1: 실패하는 Worker health test 작성**

```ts
import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("serves API health before static assets", async () => {
  const response = await SELF.fetch("https://example.test/api/health");
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});
```

Run: `npm run test:worker -- test/worker/health.test.ts`

Expected: FAIL because Worker entry and test config do not exist.

- [ ] **Step 2: Worker app과 오류 형식 구현**

`wrangler.jsonc`:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "couple-travel-guide-local",
  "main": "worker/index.ts",
  "compatibility_date": "2026-07-27",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "couple-travel-guide-local",
      "database_id": "local"
    }
  ],
  "vars": {
    "SURFACE": "partner",
    "APP_ORIGIN": "http://localhost:5173",
    "DEV_AUTH": "enabled"
  }
}
```

`wrangler.admin.jsonc`:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "couple-travel-guide-admin-local",
  "main": "worker/index.ts",
  "compatibility_date": "2026-07-27",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "couple-travel-guide-local",
      "database_id": "local"
    }
  ],
  "vars": {
    "SURFACE": "admin",
    "APP_ORIGIN": "http://localhost:5173",
    "PARTNER_ORIGIN": "http://localhost:5173",
    "DEV_AUTH": "enabled"
  },
  "triggers": {
    "crons": ["17 3 * * *"]
  }
}
```

`database_id: "local"`은 실제 배포를 막는 local 전용 값이다. Task 13의 승인된 D1 생성 뒤에만 실제 UUID로 교체한다.

이 Task에서 `vite.config.ts`의 `react()` 바로 뒤에 Cloudflare plugin을 추가한다.

```ts
import { cloudflare } from "@cloudflare/vite-plugin";

cloudflare(),
```

`worker/env.ts`:

```ts
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SURFACE: "admin" | "partner";
  APP_ORIGIN: string;
  PARTNER_ORIGIN?: string;
  ADMIN_EMAIL?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_AUTH?: "enabled";
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    principal: import("../src/shared/entities").Principal;
  };
};
```

`worker/app.ts`:

```ts
import { Hono } from "hono";
import type { AppEnv } from "./env";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.get("/api/health", (c) => c.json({ ok: true }));
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
  return app;
}
```

`worker/index.ts`:

```ts
import { createApp } from "./app";
import type { Env } from "./env";

const app = createApp();

export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
  },
} satisfies ExportedHandler<Env>;
```

`worker/http/errors.ts`는 `{ error: { code, message, details? } }`만 반환하는 `apiError(c, status, code, message, details?)`를 export한다.

`vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
});
```

`vitest.worker.config.ts`:

```ts
import path from "node:path";
import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

const migrations = await readD1Migrations(path.resolve("migrations"));

export default defineWorkersConfig({
  test: {
    setupFiles: ["./test/worker/apply-migrations.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      },
    },
  },
});
```

`test/worker/apply-migrations.ts`:

```ts
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    TEST_MIGRATIONS: D1Migration[];
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
```

- [ ] **Step 3: D1 schema 작성**

`migrations/0001_initial.sql`에는 다음 table과 index를 만든다.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'partner')),
  display_name TEXT NOT NULL,
  access_email TEXT UNIQUE,
  created_at TEXT NOT NULL
);

INSERT INTO members (id, role, display_name, access_email, created_at)
VALUES
  ('owner', 'owner', '나', NULL, CURRENT_TIMESTAMP),
  ('partner', 'partner', '여자친구', NULL, CURRENT_TIMESTAMP);

CREATE TABLE pair_invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES members(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  invite_id TEXT NOT NULL UNIQUE REFERENCES pair_invites(id),
  token_hash TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'completed')),
  cover_image_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  purge_after TEXT,
  created_by TEXT NOT NULL REFERENCES members(id),
  updated_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE trip_members (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, member_id)
);

CREATE TABLE trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_date TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL,
  UNIQUE (trip_id, day_date)
);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('restaurant', 'cafe', 'attraction', 'lodging', 'transport')),
  status TEXT NOT NULL CHECK (status IN ('saved', 'maybe', 'visited')),
  address TEXT,
  latitude REAL,
  longitude REAL,
  map_url TEXT,
  source_url TEXT,
  image_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  saved_by TEXT REFERENCES members(id),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE schedule_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_day_id TEXT NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  place_id TEXT REFERENCES places(id),
  booking_id TEXT REFERENCES bookings(id),
  title TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  memo TEXT NOT NULL DEFAULT '',
  travel_mode TEXT CHECK (travel_mode IN ('walk', 'transit', 'drive', 'ferry', 'other')),
  travel_note TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  is_fixed INTEGER NOT NULL DEFAULT 0 CHECK (is_fixed IN (0, 1)),
  is_done INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id TEXT REFERENCES places(id),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('flight', 'lodging', 'ticket', 'tour', 'transport', 'restaurant', 'other')),
  provider TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  reservation_code TEXT,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  external_url TEXT,
  document_url TEXT,
  memo TEXT NOT NULL DEFAULT '',
  is_fixed INTEGER NOT NULL DEFAULT 1 CHECK (is_fixed IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE check_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('shared', 'personal')),
  owner_member_id TEXT REFERENCES members(id),
  assignee_member_id TEXT REFERENCES members(id),
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  memo TEXT NOT NULL DEFAULT '',
  is_done INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  position INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('trip', 'schedule_item', 'place', 'booking')),
  target_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('shared', 'personal')),
  author_member_id TEXT NOT NULL REFERENCES members(id),
  body TEXT NOT NULL,
  attachment_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('place', 'schedule_item')),
  target_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  choice TEXT NOT NULL CHECK (choice IN ('must', 'okay', 'skip')),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL,
  UNIQUE (target_type, target_id, member_id)
);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE mutation_receipts (
  idempotency_key TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_token ON device_sessions(token_hash);
CREATE INDEX idx_sessions_member ON device_sessions(member_id, revoked_at);
CREATE INDEX idx_trips_deleted ON trips(deleted_at, purge_after);
CREATE INDEX idx_trip_days_trip ON trip_days(trip_id, position);
CREATE INDEX idx_schedule_trip_day ON schedule_items(trip_id, trip_day_id, position);
CREATE INDEX idx_places_trip ON places(trip_id, category, status);
CREATE INDEX idx_bookings_trip_time ON bookings(trip_id, starts_at);
CREATE INDEX idx_checks_trip ON check_items(trip_id, scope, position);
CREATE INDEX idx_notes_trip ON notes(trip_id, target_type, target_id);
CREATE INDEX idx_activity_trip_time ON activity_logs(trip_id, created_at DESC);
```

`migrations/0002_legacy_sydney_marker.sql`:

```sql
CREATE TABLE data_imports (
  key TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL
);
```

- [ ] **Step 4: Worker foundation 검증**

Run:

```bash
npm run typecheck
npm run test:worker -- test/worker/health.test.ts
npx wrangler d1 migrations apply couple-travel-guide-local --local
npm run build
```

Expected: 모두 exit 0. local D1에 15개 table이 존재한다.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add wrangler*.jsonc vite*.config.ts worker src/shared migrations test/worker
git commit -m "feat: add worker and D1 foundation"
```

---

### Task 3: 관리자 Access JWT와 파트너 기기 세션 경계

**Files:**
- Create: `worker/auth/access.ts`
- Create: `worker/auth/cookie.ts`
- Create: `worker/auth/dev.ts`
- Create: `worker/auth/hash.ts`
- Create: `worker/auth/origin.ts`
- Create: `worker/auth/principal.ts`
- Create: `worker/auth/session.ts`
- Create: `worker/routes/session.ts`
- Create: `test/worker/auth.test.ts`
- Modify: `worker/app.ts`

**Interfaces:**
- Consumes: `Env`, `Principal`, `members`, `device_sessions`
- Produces: `createApp(deps?)`, `requirePrincipal(c): Promise<Principal>`, `requireOwner(c)`, `POST /api/session/logout`, `GET /api/session`

- [ ] **Step 1: 실패하는 인증 경계 테스트 작성**

```ts
it("rejects partner API without a device cookie", async () => {
  const response = await app.request("/api/session", {}, partnerEnv);
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({
    error: { code: "SESSION_REQUIRED" },
  });
});

it("rejects unsafe writes from another origin", async () => {
  const response = await app.request(
    "/api/session/logout",
    { method: "POST", headers: { Origin: "https://evil.example" } },
    partnerEnv,
  );
  expect(response.status).toBe(403);
});

it("rejects the local test header on a non-local hostname", async () => {
  const response = await app.request(
    "https://travel.example/api/session",
    { headers: { "X-Dev-Principal": "owner" } },
    { ...adminEnv, DEV_AUTH: "enabled" },
  );
  expect(response.status).toBe(401);
});
```

Run: `npm run test:worker -- test/worker/auth.test.ts`

Expected: FAIL with missing auth middleware.

- [ ] **Step 2: crypto와 쿠키 구현**

```ts
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
```

Cookie 이름은 `couple_session`으로 고정한다. 발급 문자열은 `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7776000`, 삭제 문자열은 같은 속성과 `Max-Age=0`을 쓴다.

- [ ] **Step 3: Access 검증과 principal 선택 구현**

```ts
export interface AccessClaims {
  email: string;
  sub: string;
}

export interface AccessTokenVerifier {
  verify(token: string, env: Env): Promise<AccessClaims>;
}

export interface AppDependencies {
  accessVerifier: AccessTokenVerifier;
  now: () => Date;
}
```

`createApp`는 `Partial<AppDependencies>`를 받고 production 기본값으로 실제 Access verifier와 `() => new Date()`를 사용한다. Worker test는 fake verifier와 고정 clock을 주입한다.

관리자 token은 `Cf-Access-Jwt-Assertion` header에서만 읽는다. 기본 verifier는 `jose`의 `createRemoteJWKSet`과 `jwtVerify`를 사용해 `https://${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`, `ACCESS_AUD`, `exp`를 검증한다. 검증된 email을 소문자로 바꿔 `ADMIN_EMAIL`과 상수 시간 비교 후 `memberId: "owner"`를 반환하고 `members.access_email`을 같은 값으로 갱신한다.

파트너 초대는 고정 member `partner`의 기기 세션을 발급한다. 파트너 요청은 쿠키 원문을 해시해 조회하고 다음 오류를 구분한다.

로컬 E2E 전용 `X-Dev-Principal: owner|partner`는 `DEV_AUTH === "enabled"`이면서 URL hostname이 `localhost` 또는 `127.0.0.1`일 때만 허용한다. production Wrangler config에는 `DEV_AUTH`를 넣지 않는다.

```ts
type SessionErrorCode =
  | "SESSION_REQUIRED"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED";
```

유효 세션은 `last_seen_at`이 24시간보다 오래된 경우에만 `last_seen_at`과 `expires_at = now + 90 days`를 갱신한다.

모든 `POST`, `PATCH`, `PUT`, `DELETE`는 `Origin === new URL(request.url).origin`이 아니면 `403 ORIGIN_REJECTED`를 반환한다.

- [ ] **Step 4: 인증 테스트와 보안 grep**

Run:

```bash
npm run test:worker -- test/worker/auth.test.ts
npm run typecheck
rg -n "console\\.(log|debug)|ADMIN_EMAIL|couple_session" worker src
```

Expected: auth tests PASS. 로그에 token·email·cookie 출력이 없다.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add worker/auth worker/routes/session.ts worker/app.ts test/worker/auth.test.ts
git commit -m "feat: enforce admin and device sessions"
```

---

### Task 4: 10분 1회용 QR·링크 연결과 기기 관리

**Files:**
- Create: `worker/services/pairing.ts`
- Create: `worker/routes/pairing.ts`
- Create: `worker/db/sessions.ts`
- Create: `src/features/auth/api.ts`
- Create: `src/features/auth/PairDevicePage.tsx`
- Create: `src/features/auth/InvitePanel.tsx`
- Create: `src/features/auth/DeviceList.tsx`
- Create: `src/features/auth/pairing.test.tsx`
- Create: `test/worker/pairing.test.ts`
- Modify: `src/app/router.tsx`
- Modify: `worker/app.ts`

**Interfaces:**
- Consumes: `requireOwner`, `randomToken`, `hashToken`
- Produces: `POST /api/admin/invites`, `GET /api/admin/devices`, `DELETE /api/admin/devices/:id`, `POST /api/pair/claim`

- [ ] **Step 1: 초대 만료·재사용 실패 test 작성**

```ts
it("accepts a fresh invite once and rejects replay", async () => {
  const invite = await issueInvite(owner);
  const first = await claimInvite(invite.token, "iPhone");
  const replay = await claimInvite(invite.token, "second phone");

  expect(first.status).toBe(200);
  expect(first.headers.get("set-cookie")).toContain("HttpOnly");
  expect(replay.status).toBe(410);
});

it("rejects an invite after ten minutes", async () => {
  const invite = await issueInvite(owner, "2026-07-27T00:00:00.000Z");
  clock.setSystemTime("2026-07-27T00:10:00.001Z");
  expect((await claimInvite(invite.token, "iPhone")).status).toBe(410);
});
```

Run: `npm run test:worker -- test/worker/pairing.test.ts`

Expected: FAIL because routes do not exist.

- [ ] **Step 2: pairing service 구현**

`issueInvite`는 `new URL("/pair", env.PARTNER_ORIGIN)`에 token query를 붙인 URL과 token을 응답하고 D1에는 hash만 넣는다.

```ts
export interface IssuedInvite {
  url: string;
  token: string;
  expiresAt: string;
}
```

`claimInvite`는 hash로 row를 찾고 만료·사용 여부를 확인한 뒤 하나의 D1 batch에서 `used_at` conditional update와 `device_sessions` insert를 실행한다. `device_sessions.invite_id UNIQUE` 위반도 `410 INVITE_ALREADY_USED`로 정규화한다. 성공 후 token query를 포함하지 않은 `/library`로 이동할 수 있게 `{ redirectTo: "/library" }`를 반환한다.

- [ ] **Step 3: 관리자·파트너 UI 구현**

`InvitePanel`은 `qrcode.toDataURL(invite.url, { width: 240, margin: 1 })`로 QR을 만들고 같은 URL의 복사 버튼, 남은 시간을 초 단위로 표시한다.

`PairDevicePage`는 URL의 `token`을 읽은 직후 `history.replaceState(null, "", "/pair")`로 주소에서 제거하고 device name 입력 후 claim한다. 성공하면 `/library`로 replace navigation한다.

`DeviceList`는 기기명, 마지막 사용, 만료일, 해제 상태만 보여준다. 현재 세션 원문은 표시하지 않는다.

- [ ] **Step 4: pairing 검증**

Run:

```bash
npm run test:worker -- test/worker/pairing.test.ts
npm test -- src/features/auth/pairing.test.tsx
npm run typecheck
```

Expected: QR와 링크가 같은 token을 사용하고 만료·재사용·해제가 모두 PASS.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add worker/services/pairing.ts worker/routes/pairing.ts worker/db/sessions.ts worker/app.ts src/features/auth src/app/router.tsx test/worker/pairing.test.ts
git commit -m "feat: add one-time device pairing"
```

---

### Task 5: 여행 서재, 생성·수정·30일 휴지통

**Files:**
- Create: `worker/db/trips.ts`
- Create: `worker/routes/trips.ts`
- Create: `worker/services/purge.ts`
- Create: `src/features/trips/api.ts`
- Create: `src/features/trips/TripLibraryPage.tsx`
- Create: `src/features/trips/TripCard.tsx`
- Create: `src/features/trips/TripForm.tsx`
- Create: `src/features/trips/TrashPanel.tsx`
- Create: `src/features/trips/trips.test.tsx`
- Create: `test/worker/trips.test.ts`
- Modify: `worker/app.ts`
- Modify: `worker/index.ts`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: `Principal`, `trips`, `trip_members`
- Produces: `GET /api/trips?view=active|trash`, `POST /api/trips`, `PATCH/DELETE /api/trips/:id`, `POST /api/trips/:id/restore`, scheduled purge

- [ ] **Step 1: 역할·삭제·복구 test 작성**

```ts
it.each(["owner", "partner"] as const)(
  "%s can create, trash, and restore a trip",
  async (role) => {
    const created = await createTrip(asRole(role), validTrip);
    expect((await trashTrip(asRole(role), created.id)).status).toBe(204);
    expect((await restoreTrip(asRole(role), created.id)).status).toBe(200);
  },
);

it("purges only trips whose 30-day deadline passed", async () => {
  await seedTrashedTrip({ purgeAfter: "2026-07-26T23:59:59.000Z" });
  await seedTrashedTrip({ purgeAfter: "2026-07-28T00:00:00.000Z" });
  expect(await purgeTrips("2026-07-27T00:00:00.000Z")).toBe(1);
});
```

Run: `npm run test:worker -- test/worker/trips.test.ts`

Expected: FAIL because trip repository is absent.

- [ ] **Step 2: trip API 구현**

Create payload:

```ts
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const httpsUrlSchema = z.url().refine(
  (value) => new URL(value).protocol === "https:",
  "HTTPS 주소만 사용할 수 있습니다.",
);

const imageUrlSchema = z.union([
  httpsUrlSchema,
  z.string().regex(/^\/images\/[A-Za-z0-9._/-]+$/),
]);

export const tripInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  destination: z.string().trim().min(1).max(120),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  timeZone: z.string().refine(isValidTimeZone, "유효한 IANA 시간대를 입력하세요."),
  status: z.enum(["upcoming", "active", "completed"]),
  coverImageUrl: imageUrlSchema.nullable(),
}).refine((trip) => trip.endDate >= trip.startDate, {
  message: "종료일은 시작일보다 빠를 수 없습니다.",
  path: ["endDate"],
});
```

생성 시 현재 활성 member 두 명을 `trip_members`에 넣는다. 모든 trip route는 principal의 `trip_members` row를 검사한다. `view=active`는 `deleted_at IS NULL`, `view=trash`는 `deleted_at IS NOT NULL`만 반환한다. 삭제는 `deleted_at = now`, `purge_after = now + 30 days`; 복구는 두 값을 null로 바꾼다. scheduled handler는 `purge_after <= now`만 hard delete한다.

`PATCH`, `DELETE`, `restore` body는 `{ baseVersion: number }`를 받고 `trips.version`이 다르면 현재 trip을 포함한 `409 VERSION_CONFLICT`를 반환한다.

Task 2의 Worker export에 scheduled handler를 추가한다.

```ts
export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
  },
  scheduled(_event, env, context) {
    context.waitUntil(purgeExpiredTrips(env.DB, new Date().toISOString()));
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 3: 여행 서재 UI 구현**

서재는 예정·여행 중·완료 group, 수정 시간 정렬, 빈 상태, 생성 form을 제공한다. form의 destination 선택은 대표 IANA 시간대를 함께 채우고 사용자가 바꿀 수 있게 한다. 휴지통은 남은 일수와 자동 삭제 날짜를 표시하고 복구 버튼을 제공한다. delete 클릭은 여행 제목을 포함한 확인 dialog를 거친다.

- [ ] **Step 4: trip 검증**

Run:

```bash
npm run test:worker -- test/worker/trips.test.ts
npm test -- src/features/trips/trips.test.tsx
npm run typecheck
npm run lint
```

Expected: 두 role CRUD, 30일 경계, membership 거부, UI dialog가 모두 PASS.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add worker/db/trips.ts worker/routes/trips.ts worker/services/purge.ts worker/app.ts worker/index.ts src/features/trips src/app/router.tsx test/worker/trips.test.ts
git commit -m "feat: add shared trip library"
```

---

### Task 6: Snapshot·멱등 mutation·버전 충돌 API

**Files:**
- Create: `worker/db/snapshot.ts`
- Create: `worker/db/entity-registry.ts`
- Create: `worker/services/mutations.ts`
- Create: `worker/routes/sync.ts`
- Create: `src/services/api/client.ts`
- Create: `src/services/api/errors.ts`
- Create: `test/worker/sync.test.ts`
- Create: `src/shared/mutations.ts`
- Modify: `worker/app.ts`

**Interfaces:**
- Consumes: `TripSnapshot`, `MutationRequest`, 모든 mutable table
- Produces: `GET /api/trips/:id/snapshot`, `POST /api/trips/:id/mutations`, `ApiClient`

- [ ] **Step 1: 멱등성과 충돌 test 작성**

```ts
it("returns the first result for a repeated idempotency key", async () => {
  const mutation = makePlaceCreate({ idempotencyKey: "same-key" });
  const first = await postMutation(mutation);
  const second = await postMutation(mutation);
  expect(second).toEqual(first);
  expect(await countRows("places")).toBe(1);
});

it("returns current entity on stale base version", async () => {
  const current = await seedPlace({ version: 3 });
  const response = await postMutation(
    makePlaceUpdate({ entityId: current.id, baseVersion: 2 }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    error: {
      code: "VERSION_CONFLICT",
      details: { current: { id: current.id, version: 3 } },
    },
  });
});
```

Run: `npm run test:worker -- test/worker/sync.test.ts`

Expected: FAIL because sync routes do not exist.

- [ ] **Step 2: entity registry와 Zod union 구현**

`src/shared/mutations.ts`는 다음 `MutationPayloadMap`을 먼저 선언하고, Shared Interfaces의 `MutationRequest`, `MutationSuccess`, `VersionConflict`를 그 아래에 선언한다.

```ts
export interface MutationPayloadMap {
  trip_day: {
    dayDate: string;
    title: string;
    position: number;
  };
  schedule_item: {
    tripDayId: string;
    placeId: string | null;
    bookingId: string | null;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    memo: string;
    travelMode: "walk" | "transit" | "drive" | "ferry" | "other" | null;
    travelNote: string;
    position: number;
    isFixed: boolean;
    isDone: boolean;
  };
  place: {
    name: string;
    category: PlaceCategory;
    status: PlaceStatus;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    mapUrl: string | null;
    sourceUrl: string | null;
    imageUrl: string | null;
    description: string;
    savedBy: string | null;
  };
  booking: {
    placeId: string | null;
    bookingType: "flight" | "lodging" | "ticket" | "tour" | "transport" | "restaurant" | "other";
    provider: string;
    startsAt: string;
    endsAt: string | null;
    reservationCode: string | null;
    paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
    externalUrl: string | null;
    documentUrl: string | null;
    memo: string;
    isFixed: boolean;
  };
  check_item: {
    scope: "shared" | "personal";
    ownerMemberId: string | null;
    assigneeMemberId: string | null;
    title: string;
    quantity: number;
    memo: string;
    isDone: boolean;
    position: number;
  };
  note: {
    targetType: "trip" | "schedule_item" | "place" | "booking";
    targetId: string | null;
    visibility: "shared" | "personal";
    body: string;
    attachmentUrl: string | null;
  };
  vote: {
    targetType: "place" | "schedule_item";
    targetId: string;
    choice: VoteChoice;
  };
}
```

`entity-registry.ts`는 entity별 table, 허용 column, row parser, Zod payload schema를 정적 object로 export한다. 사용자 입력을 table·column 문자열에 직접 연결하지 않는다.

공통 validation 한계:

- ID: `^[A-Za-z0-9-]{1,100}$`
- title·name·provider: trim 후 1~160자
- memo·description·note body: 최대 5,000자
- 외부 URL: `https:`만 허용, 최대 2,048자
- `coverImageUrl`·`imageUrl`: 외부 HTTPS 또는 `^/images/[A-Za-z0-9._/-]+$`
- latitude: -90~90, longitude: -180~180
- quantity: 정수 1~99
- position: 정수 0~9,999
- 날짜: `YYYY-MM-DD`
- 날짜·시간: timezone offset가 포함된 ISO 8601
- personal check의 `ownerMemberId`와 personal note의 `authorMemberId`: client 값을 버리고 principal member ID 사용

- [ ] **Step 3: snapshot과 mutation service 구현**

Snapshot 응답 ETag는 `"trip-${trip.id}-${trip.syncVersion}"`다. 같은 `If-None-Match`면 `304`를 반환한다. 응답은 `Cache-Control: private, must-revalidate`로 두고 Activity는 최근 100건만 포함한다.

Mutation 순서:

1. principal의 trip membership 확인
2. Zod 검증
3. `mutation_receipts`에서 idempotency key 확인
4. update·delete면 `baseVersion`과 현재 row version 비교
5. create·update·delete 적용
6. row version과 trip `sync_version`을 각각 1 증가
7. 민감값 없는 activity summary 기록
8. result를 receipt에 저장

같은 D1 batch 안에서 5~8을 수행한다.

D1가 Free quota 또는 platform limit 오류를 반환하면 raw 오류 문자열을 노출하지 않고 `503 D1_UNAVAILABLE`과 `무료 한도 또는 일시적인 저장소 오류로 요청을 처리하지 못했습니다.`를 반환한다.

- [ ] **Step 4: sync API 검증**

Run:

```bash
npm run test:worker -- test/worker/sync.test.ts
npm run typecheck
npm run lint
```

Expected: 304, 멱등 재전송, stale 409, 권한 거부, activity masking이 모두 PASS.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add worker/db/snapshot.ts worker/db/entity-registry.ts worker/services/mutations.ts worker/routes/sync.ts worker/app.ts src/shared/mutations.ts src/services/api test/worker/sync.test.ts
git commit -m "feat: add versioned trip sync API"
```

---

### Task 7: 날짜별 일정과 오늘 한 장

**Files:**
- Create: `src/features/schedule/SchedulePage.tsx`
- Create: `src/features/schedule/DaySection.tsx`
- Create: `src/features/schedule/ScheduleItemForm.tsx`
- Create: `src/features/schedule/reorder.ts`
- Create: `src/features/schedule/reorder.test.ts`
- Create: `src/features/today/TodayPage.tsx`
- Create: `src/features/today/selectToday.ts`
- Create: `src/features/today/selectToday.test.ts`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: `TripSnapshot`, `ApiClient.mutate`
- Produces: `/trips/:tripId/today`, `/trips/:tripId/schedule`, `moveItem(items, id, direction)`

- [ ] **Step 1: 일정 순서와 오늘 selector test 작성**

```ts
it("moves one item up without changing other fields", () => {
  const moved = moveItem(
    [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ],
    "b",
    "up",
  );
  expect(moved.map(({ id, position }) => ({ id, position }))).toEqual([
    { id: "b", position: 0 },
    { id: "a", position: 1 },
  ]);
});

it("selects next schedule, fixed booking, undone checks, and notes", () => {
  const result = selectToday(snapshot, "2026-10-09T10:00:00+11:00");
  expect(result.nextSchedule?.title).toBe("로열 보태닉 가든");
  expect(result.nextBooking?.isFixed).toBe(true);
  expect(result.unfinishedChecks.every((item) => !item.isDone)).toBe(true);
});
```

Run: `npm test -- src/features/schedule/reorder.test.ts src/features/today/selectToday.test.ts`

Expected: FAIL because selectors do not exist.

- [ ] **Step 2: 일정 editor 구현**

일정 form은 날짜, 시작·종료 시간, 장소, 제목, 메모, 다음 이동 수단·이동 메모, 고정 예약, 완료를 편집한다. 이동시간 자동 계산은 하지 않는다. 순서 이동은 drag 전용이 아니라 `위로`, `아래로` 버튼을 항상 제공한다. 버튼은 변경된 두 item을 순서대로 mutation하고 실패 시 최신 snapshot을 다시 읽어 충돌을 표시한다.

Google 지도 route helper:

```ts
export function googleDirectionsUrl(names: string[]): string {
  const encoded = names.filter(Boolean).map(encodeURIComponent);
  if (encoded.length === 0) return "https://www.google.com/maps";
  if (encoded.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encoded[0]}`;
  }
  const origin = encoded[0];
  const destination = encoded.at(-1);
  const waypoints = encoded.slice(1, -1).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}`;
}
```

- [ ] **Step 3: 오늘 한 장 구현**

Task 5에서 저장한 `trip.timeZone`을 사용한다. 시드니 seed는 `Australia/Sydney`다. `selectToday`는 `Intl.DateTimeFormat("en-CA", { timeZone })`으로 여행지의 오늘 날짜를 계산한다.

오늘 페이지는 다음 순서로 표시한다.

1. 다음 일정
2. 다음 고정 예약
3. 미완료 준비물 최대 5개
4. 오늘 연결 메모
5. 전체 동선 Google 지도 버튼
6. 최근 일정·예약 activity 최대 5개

- [ ] **Step 4: 일정·오늘 검증**

Run:

```bash
npm test -- src/features/schedule src/features/today
npm run typecheck
npm run lint
```

Expected: 순서 경계, timezone 날짜, 빈 오늘, 고정 예약 선택이 PASS.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add src/features/schedule src/features/today src/app/router.tsx
git commit -m "feat: add schedule and today view"
```

---

### Task 8: 장소, 무료 지도, 커플 투표

**Files:**
- Create: `src/features/places/PlacesPage.tsx`
- Create: `src/features/places/PlaceForm.tsx`
- Create: `src/features/places/PlaceCard.tsx`
- Create: `src/features/places/MapPage.tsx`
- Create: `src/features/places/TripMap.tsx`
- Create: `src/features/places/filters.ts`
- Create: `src/features/places/filters.test.ts`
- Create: `src/features/places/VoteControl.tsx`
- Create: `src/features/places/votes.ts`
- Create: `src/features/places/votes.test.ts`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: place·vote mutation, `TripSnapshot`
- Produces: `/trips/:tripId/places`, `/trips/:tripId/map`, `isConfirmedCandidate(votes, targetId)`

- [ ] **Step 1: 장소 filter와 확정 후보 test 작성**

```ts
it("filters by category, status, owner, and text", () => {
  expect(filterPlaces(places, {
    category: "cafe",
    status: "saved",
    savedBy: "partner",
    query: "single",
  }).map((place) => place.name)).toEqual(["Single O"]);
});

it("marks a target confirmed only when both members vote must", () => {
  expect(isConfirmedCandidate([
    vote("owner", "place-1", "must"),
    vote("partner", "place-1", "must"),
  ], "place-1")).toBe(true);
});
```

Run: `npm test -- src/features/places`

Expected: FAIL because helpers do not exist.

- [ ] **Step 2: 장소와 vote UI 구현**

장소는 맛집·카페·명소·숙소·교통 거점, 찜·보류·방문 완료, 개인 저장자, 검색, 수정 시간 정렬을 제공한다. 각 카드에 두 member의 `꼭 가기`, `괜찮음`, `별로`를 나란히 표시한다. 둘 다 `꼭 가기`면 `확정 후보` badge를 붙인다.

- [ ] **Step 3: 지도 구현**

`TripMap`은 좌표가 있는 장소만 MapLibre marker로 표시하고 `https://tiles.openfreemap.org/styles/liberty`를 style URL로 사용한다. 지도 load error 또는 offline이면 map canvas를 숨기고 같은 필터가 적용된 장소 목록을 보여준다. 좌표가 없는 장소도 목록에 남는다. offline이면 Google 지도 URL을 선택 가능한 text로 보여주고 `온라인 연결 후 열 수 있습니다.`를 표시한다.

지도 탭 filter: 날짜, category, place status. 일정에 연결된 장소는 선택 날짜가 맞을 때만 표시한다. `일정에 추가`는 day와 시간을 고른 후 schedule mutation을 보낸다.

- [ ] **Step 4: 장소·지도 검증**

Run:

```bash
npm test -- src/features/places
npm run typecheck
npm run lint
```

Manual: 네트워크 차단 시 지도 대신 장소 목록과 Google 지도 URL이 보이는지 확인.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add src/features/places src/app/router.tsx
git commit -m "feat: add places map and couple votes"
```

---

### Task 9: 예약 편집과 예약번호 보호

**Files:**
- Create: `src/features/bookings/BookingsPage.tsx`
- Create: `src/features/bookings/BookingForm.tsx`
- Create: `src/features/bookings/BookingCard.tsx`
- Create: `src/features/bookings/maskReservation.ts`
- Create: `src/features/bookings/bookings.test.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: booking mutation, `TripSnapshot.bookings`
- Produces: `/trips/:tripId/bookings`, `maskReservation(value)`

- [ ] **Step 1: 마스킹과 공개 동작 test 작성**

```ts
it.each([
  ["ABC12345", "••••2345"],
  ["123", "•••"],
  ["", ""],
])("masks %s as %s", (value, expected) => {
  expect(maskReservation(value)).toBe(expected);
});

it("reveals a booking code only after explicit click", async () => {
  render(<BookingCard booking={booking({ reservationCode: "ABC12345" })} />);
  expect(screen.getByText("••••2345")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "예약번호 보기" }));
  expect(screen.getByText("ABC12345")).toBeVisible();
});
```

Run: `npm test -- src/features/bookings/bookings.test.tsx`

Expected: FAIL because booking UI does not exist.

- [ ] **Step 2: booking form과 card 구현**

종류, 업체, 날짜·시간, 장소, 예약번호, 결제 상태, 링크, 문서 링크, 메모, 고정 일정 여부를 편집한다. `documentUrl`은 외부 문서 링크만 받는다. 파일 업로드 버튼은 1단계에서 표시하지 않는다.

URL은 `https:`만 허용하고 새 창 링크에는 `target="_blank" rel="noopener noreferrer"`를 쓴다. offline이면 저장된 URL text와 `온라인 연결 후 열 수 있습니다.`를 보여준다. activity summary에는 업체명과 작업만 저장하고 예약번호·memo 원문은 넣지 않는다.

- [ ] **Step 3: 오늘과 schedule 연결**

고정 booking은 `TodayPage`의 다음 예약에 나타난다. `일정에도 표시`를 선택하면 같은 시간의 schedule item을 만들고 Task 2에 이미 정의한 `schedule_items.booking_id`로 연결한다. `booking:<id>` 같은 내부 식별자를 memo에 넣지 않는다.

- [ ] **Step 4: 예약 검증**

Run:

```bash
npm test -- src/features/bookings src/features/today
npm run test:worker -- test/worker/sync.test.ts
npm run typecheck
```

Expected: 마스킹, URL 거부, 고정 예약 today 표시가 PASS.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add src/features/bookings src/features/today
git commit -m "feat: add protected booking details"
```

---

### Task 10: 준비물, 메모, 통합 검색, 활동 기록

**Files:**
- Create: `src/features/checklist/ChecklistPage.tsx`
- Create: `src/features/checklist/CheckItemForm.tsx`
- Create: `src/features/notes/NotesPage.tsx`
- Create: `src/features/notes/NoteForm.tsx`
- Create: `src/features/search/search.ts`
- Create: `src/features/search/SearchPanel.tsx`
- Create: `src/features/search/search.test.ts`
- Create: `src/features/activity/ActivityPage.tsx`
- Create: `src/features/more/MorePage.tsx`
- Create: `test/worker/privacy.test.ts`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: check·note mutation, snapshot activity
- Produces: `/trips/:tripId/checklist`, `/trips/:tripId/notes`, `/trips/:tripId/activity`, `/trips/:tripId/more`, `searchSnapshot(snapshot, filters)`

- [ ] **Step 1: 개인정보와 통합 검색 test 작성**

```ts
it("shows personal checks and notes only to their owner", () => {
  const visible = selectVisiblePrivateData(snapshot, "partner");
  expect(visible.notes.map((note) => note.authorMemberId)).not.toContain("owner");
  expect(visible.checkItems.map((item) => item.ownerMemberId)).not.toContain("owner");
});

it("searches place names, booking providers, schedule titles, and note bodies", () => {
  const results = searchSnapshot(snapshot, { query: "오페라", sort: "updated_desc" });
  expect(results.map((result) => result.kind)).toEqual(
    expect.arrayContaining(["place", "booking", "schedule_item", "note"]),
  );
});
```

Worker API에도 같은 경계를 검증한다.

```ts
it("never returns the other member's personal notes or checks", async () => {
  await seedPersonalData({ owner: "owner", body: "owner secret" });
  const snapshot = await getSnapshot(asRole("partner"));
  expect(JSON.stringify(snapshot)).not.toContain("owner secret");
});
```

Run:

```bash
npm test -- src/features/search
npm run test:worker -- test/worker/privacy.test.ts
```

Expected: FAIL because visibility selector and search do not exist.

- [ ] **Step 2: 준비물과 메모 구현**

개인 항목은 API snapshot query에서 다른 member row를 제외한다. UI에서 숨기는 것만으로 처리하지 않는다. 개인 준비물의 owner는 principal로 강제하고 클라이언트 값을 신뢰하지 않는다. 공동 준비물은 담당자와 수량을 고를 수 있다.

메모는 여행·일정·장소·예약 범위, 공동·개인 visibility, 본문, 외부 사진·문서 URL을 지원한다. R2 file upload는 표시하지 않는다.

- [ ] **Step 3: 검색·filter·activity 구현**

검색 결과 공통 shape:

```ts
export interface SearchResult {
  kind: "schedule_item" | "place" | "booking" | "note";
  id: string;
  title: string;
  excerpt: string;
  date: string | null;
  category: string | null;
  status: string | null;
  updatedAt: string;
}
```

모든 탭의 검색 panel은 query, 날짜, category, status, 수정 시간 정렬을 URL search params에 저장한다. Activity는 최근 100건, 수정자·시간·요약만 표시한다.

`MorePage`는 여행 설정, 통합 검색, 활동 기록, 여행 휴지통, 연결·동기화 상태, AI 질문 만들기, 환율 도구로 가는 항목을 한 목록에 조립한다. owner surface에서만 `초대와 연결 기기` 항목을 추가한다.

- [ ] **Step 4: 개인정보·검색 검증**

Run:

```bash
npm test -- src/features/search src/features/checklist src/features/notes
npm run test:worker -- test/worker/sync.test.ts test/worker/privacy.test.ts
npm run typecheck
```

Expected: 다른 사용자의 개인 항목이 API와 UI 모두에서 보이지 않고 통합 검색이 PASS.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add src/features/checklist src/features/notes src/features/search src/features/activity src/features/more src/app/router.tsx worker/db/snapshot.ts worker/services/mutations.ts test/worker/privacy.test.ts
git commit -m "feat: add shared planning tools"
```

---

### Task 11: IndexedDB 오프라인 outbox, 15초 sync, 충돌 선택

**Files:**
- Create: `src/services/offline/db.ts`
- Create: `src/services/offline/snapshots.ts`
- Create: `src/services/offline/outbox.ts`
- Create: `src/services/sync/flush.ts`
- Create: `src/services/sync/useTripSync.ts`
- Create: `src/services/sync/SyncProvider.tsx`
- Create: `src/services/sync/ConflictDialog.tsx`
- Create: `src/services/sync/sync.test.ts`
- Create: `src/components/ConnectionStatus.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `ApiClient`, `TripSnapshot`, `MutationRequest`, `VersionConflict`
- Produces: `getCachedSnapshot`, `queueMutation`, `flushOutbox`, `useTripSync`

- [ ] **Step 1: offline queue·재전송·충돌 test 작성**

```ts
it("queues offline edits and flushes them in creation order", async () => {
  await queueMutation(second);
  await queueMutation(first);
  await flushOutbox(fakeApi, { orderBy: "createdAt" });
  expect(fakeApi.sent.map((item) => item.idempotencyKey)).toEqual([
    first.idempotencyKey,
    second.idempotencyKey,
  ]);
});

it("stops on conflict and keeps later mutations queued", async () => {
  fakeApi.conflictOn(first.idempotencyKey);
  const result = await flushOutbox(fakeApi);
  expect(result.conflict?.mutation.idempotencyKey).toBe(first.idempotencyKey);
  expect(await listQueued()).toHaveLength(2);
});

it("clears all cached travel data after a revoked-session response", async () => {
  await cacheSnapshot(snapshot);
  await handleApiError(apiError("SESSION_REVOKED"));
  expect(await getCachedSnapshot(snapshot.trip.id)).toBeUndefined();
});
```

Run: `npm test -- src/services/sync/sync.test.ts`

Expected: FAIL because IndexedDB stores and sync functions do not exist.

- [ ] **Step 2: IndexedDB stores 구현**

DB 이름은 `couple-travel-guide`, version은 `1`이다.

```ts
interface TravelDb extends DBSchema {
  snapshots: {
    key: string;
    value: { tripId: string; snapshot: TripSnapshot; cachedAt: string; etag: string };
  };
  outbox: {
    key: string;
    value: {
      idempotencyKey: string;
      tripId: string;
      mutation: MutationRequest;
      createdAt: string;
      attempts: number;
      lastError: string | null;
    };
    indexes: { "by-trip": string; "by-created": string };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}
```

UI mutation은 먼저 snapshot에 optimistic 적용하고 outbox에 같은 transaction으로 넣는다. `idempotencyKey`는 `crypto.randomUUID()`다.

- [ ] **Step 3: sync loop와 충돌 dialog 구현**

`useTripSync` trigger:

```ts
const SYNC_INTERVAL_MS = 15_000;

window.addEventListener("online", sync);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sync();
});
```

interval은 `document.visibilityState === "visible"`일 때만 실행한다. flush 성공 후 ETag snapshot을 다시 읽는다. network error는 queue를 유지하고 `ConnectionStatus`에 `오프라인 · N개 대기`를 표시한다. `503 D1_UNAVAILABLE`이면 자동 재전송을 멈추고 `무료 한도 또는 저장소 오류 · 직접 다시 시도`를 표시하며 수동 재시도 전까지 새 write를 outbox에만 보관한다.

409면 `ConflictDialog`가 내 payload와 server current를 field별로 보여준다.

- `내 수정 유지`: server current version을 새 `baseVersion`으로 넣은 새 idempotency key mutation을 queue
- `최신 내용 사용`: 충돌 mutation을 제거하고 server current를 local snapshot에 반영

`SESSION_EXPIRED`는 outbox를 보존하고 연결 안내를 표시한다. `SESSION_REVOKED`는 `snapshots`와 `outbox` store를 즉시 비우고 `/pair`로 이동한다. 기기 전용 AI provider와 환율 설정이 든 `settings` store는 여행 내용이 아니므로 유지한다.

- [ ] **Step 4: sync timing 검증**

Run:

```bash
npm test -- src/services/sync/sync.test.ts
npm run typecheck
npm run lint
```

Expected: fake timer 기준 15초, focus, online, manual trigger가 PASS. conflict에서 자동 overwrite가 없다.

- [ ] **Step 5: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add src/services/offline src/services/sync src/components/ConnectionStatus.tsx src/app/AppShell.tsx src/app/App.tsx
git commit -m "feat: add offline trip synchronization"
```

---

### Task 12: 로컬 AI 연결, 환율, 기존 시드니 데이터 import

**Files:**
- Create: `src/features/ai-launcher/prompt.ts`
- Create: `src/features/ai-launcher/AiLauncher.tsx`
- Create: `src/features/ai-launcher/ai-launcher.test.tsx`
- Create: `src/features/currency/convert.ts`
- Create: `src/features/currency/CurrencyTool.tsx`
- Create: `src/features/currency/currency.test.ts`
- Create: `scripts/legacy/parse.mjs`
- Create: `scripts/legacy/render-sql.mjs`
- Create: `scripts/legacy/write-seed.mjs`
- Create: `scripts/legacy/parse.test.mjs`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: selected `TripSnapshot` range, existing `schedule.html`, `food.html`, `cafe.html`, `booking.html`, `tips.html`
- Produces: `buildAiPrompt`, `openAiProvider`, `convertAudToKrw`, `.tmp/legacy-sydney.sql`

- [ ] **Step 1: AI 개인정보와 legacy count test 작성**

```ts
it("builds only the selected today context", () => {
  const prompt = buildAiPrompt(snapshot, {
    scope: "today",
    now: "2026-10-09T10:00:00+11:00",
  });
  expect(prompt).toContain("Day 2");
  expect(prompt).not.toContain("Day 5");
  expect(prompt).not.toContain("ABC12345");
});
```

`scripts/legacy/parse.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseLegacySydney } from "./parse.mjs";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

test("extracts every retained Sydney record", async () => {
  const data = await parseLegacySydney(projectRoot);
  assert.equal(data.days.length, 8);
  assert.equal(data.food.length, 28);
  assert.equal(data.cafes.length, 20);
  assert.equal(data.bookings.length, 7);
  assert.equal(data.tips.length, 4);
});
```

Run:

```bash
npm test -- src/features/ai-launcher src/features/currency
node --test scripts/legacy/parse.test.mjs
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 2: 기기별 AI launcher 구현**

Provider:

```ts
export const AI_PROVIDERS = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app" },
} as const;
```

선택값은 IndexedDB `settings`의 `ai-provider`에만 저장한다. prompt는 여행 전체·오늘·선택 장소 중 하나만 넣고 예약번호와 개인 메모를 제외한다. 실행 순서:

1. provider URL 새 탭 open
2. `navigator.clipboard.writeText(prompt)`
3. 복사 실패 시 readonly textarea에 prompt 표시
4. popup 실패 시 같은 provider URL을 일반 링크로 표시

질문 기록은 저장하지 않는다.

- [ ] **Step 3: 환율 계산기 구현**

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

기본값은 사용자 직접 입력이다. `환율 불러오기`를 누를 때만 브라우저가 기존 무료 endpoint `https://open.er-api.com/v6/latest/AUD`를 호출한다. 실패하면 기존 입력값을 유지한다. 최근 성공 환율과 시각은 기기 설정에만 저장한다.

- [ ] **Step 4: legacy parser와 SQL renderer 구현**

Parser selector:

```js
const days = schedule(".day-card").map(parseDay).get();
const food = foodDoc('article.card[data-category]')
  .map((index, element) => parsePlace(foodDoc, element, "restaurant", index))
  .get();
const cafes = cafeDoc('article.card[data-category]')
  .map((index, element) => parsePlace(cafeDoc, element, "cafe", index))
  .get();
const bookings = bookingDoc(".booking-table tbody tr").map(parseBooking).get();
const tips = tipsDoc("article.card").map(parseTip).get();
```

Field mapping:

- day: `.day-head h2`의 Day 번호와 월·일, `.day-head span`의 제목
- schedule item: `.timeline-time`, `strong`, `p`; 날짜와 시간을 합쳐 `startsAt`, 원래 문장을 `memo`
- food·cafe: `h3` name, `p`와 `.tag-row` text를 description, Google Maps anchor를 `mapUrl`, 다른 첫 anchor를 `sourceUrl`, `img src`의 `images/`를 `/images/`로 변경
- booking: 첫 cell을 provider, 둘째 cell의 권장을 memo, 셋째 cell의 가격·시간을 memo, anchor를 externalUrl, 마지막 cell을 memo에 이어 붙임
- tip: `h3`를 note 첫 줄, `p`를 note body
- food category는 모두 `restaurant`, cafe category는 모두 `cafe`, 초기 place status는 `saved`
- 예약번호가 원본에 없으므로 `reservationCode = null`, 결제 정보가 없으므로 `paymentStatus = "unpaid"`
- booking type은 타롱가·시닉 월드·시드니 타워·오페라하우스 `ticket`, 고래 관람 `tour`, 페리 `transport`, 피쉬 마켓 `other`
- 타롱가·시닉 월드·고래 관람·시드니 타워는 `isFixed = true`; 오페라하우스·페리·피쉬 마켓은 `isFixed = false`
- trip cover는 `/images/central_station.jpg`, status는 `upcoming`

고정 ID prefix:

- trip: `legacy-sydney-2026`
- day: `legacy-sydney-day-1`부터 `legacy-sydney-day-8`
- schedule: `legacy-sydney-schedule-{day}-{position}`
- food: `legacy-sydney-food-{index}`
- cafe: `legacy-sydney-cafe-{index}`
- booking: `legacy-sydney-booking-{index}`
- tip note: `legacy-sydney-tip-{index}`

Importer는 원문 text를 SQL single quote escape하고 transaction SQL을 `.tmp/legacy-sydney.sql`에 쓴다. `data_imports.key = 'legacy-sydney-v1'`가 있으면 변경 없이 종료한다. 시드니 timezone은 `Australia/Sydney`다. `booking.html`이 여행을 2026년으로 명시하므로 날짜는 2026-10-08~2026-10-15로 저장하고, 기존 요일 문자는 import하지 않고 UI가 날짜에서 다시 계산한다.

예약명별 시작 시각:

```js
export const BOOKING_STARTS_AT = {
  "타롱가 동물원": "2026-10-10T10:00:00+11:00",
  "시닉 월드": "2026-10-12T12:30:00+11:00",
  "고래 관람 투어": "2026-10-14T09:00:00+11:00",
  "시드니 타워 아이": "2026-10-13T16:00:00+11:00",
  "오페라하우스": "2026-10-09T09:30:00+11:00",
  "페리·대중교통": "2026-10-10T09:00:00+11:00",
  "시드니 피쉬 마켓": "2026-10-13T10:00:00+11:00",
};
```

Local import:

```bash
npm run seed:legacy
npx wrangler d1 execute couple-travel-guide-local --local --file=.tmp/legacy-sydney.sql
```

- [ ] **Step 5: Task 전체 검증**

Run:

```bash
npm test -- src/features/ai-launcher src/features/currency
node --test scripts/legacy/parse.test.mjs
npm run seed:legacy
rg -n "INSERT INTO (trip_days|schedule_items|places|bookings|notes)" .tmp/legacy-sydney.sql
npm run typecheck
```

Expected: AI prompt에 예약번호·개인 메모 없음. legacy count 8/28/20/7/4. SQL 재생성 결과가 byte-for-byte 동일.

- [ ] **Step 6: Task 검증 통과 후 자동 checkpoint commit**

```bash
git add src/features/ai-launcher src/features/currency src/app/router.tsx scripts/legacy
git commit -m "feat: preserve Sydney guide and local AI tools"
```

---

### Task 13: 통합 E2E, 실기기 QA, Cloudflare 전환 gate

**Files:**
- Create: `playwright.config.ts`
- Create: `test/e2e/helpers.ts`
- Create: `test/e2e/pairing.spec.ts`
- Create: `test/e2e/collaboration.spec.ts`
- Create: `test/e2e/offline-conflict.spec.ts`
- Create: `test/e2e/responsive.spec.ts`
- Create: `docs/qa/phase-1-manual-checklist.md`
- Modify after approved production verification: `.github/workflows/deploy-pages.yml`
- Modify after approved D1 creation: `wrangler.jsonc`
- Modify after approved D1 creation: `wrangler.admin.jsonc`

**Interfaces:**
- Consumes: 전체 1단계 앱
- Produces: 자동 검증 결과, 두 사용자 실기기 증거, 승인 후 Cloudflare production

- [ ] **Step 1: 두 browser context E2E 작성**

핵심 시나리오:

```ts
test("owner pairs partner and both edit the same trip", async ({ browser }) => {
  const owner = await browser.newContext();
  const partner = await browser.newContext();
  const ownerPage = await owner.newPage();
  const partnerPage = await partner.newPage();

  await openAsOwner(ownerPage);
  const inviteUrl = await createInvite(ownerPage);
  await partnerPage.goto(inviteUrl);
  await partnerPage.getByLabel("기기 이름").fill("여자친구 iPhone");
  await partnerPage.getByRole("button", { name: "기기 연결" }).click();

  const trip = await createTrip(ownerPage, "시드니 8일 여행");
  await partnerPage.goto(`/trips/${trip.id}/schedule`);
  await addSchedule(partnerPage, "오페라하우스");
  await expect(ownerPage.getByText("오페라하우스")).toBeVisible({
    timeout: 16_000,
  });
});
```

다른 spec은 다음을 각각 독립 test로 둔다.

- QR와 link claim
- 10분 만료와 replay 거부
- owner가 device revoke 후 partner API 즉시 401
- owner·partner 여행 생성·수정·휴지통·복구
- 일정·장소·예약·준비물·메모·투표 공동 편집
- 15초 이내 poll 반영
- offline 열람·mutation queue·재연결 flush
- 같은 version 동시 수정 후 conflict dialog 두 선택
- 예약번호 기본 마스킹

- [ ] **Step 2: desktop·mobile 자동 검증**

Playwright project:

```ts
projects: [
  {
    name: "desktop-chrome",
    use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
  },
  {
    name: "android-chrome",
    use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  },
  {
    name: "iphone-safari",
    use: { browserName: "webkit", viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true },
  },
]
```

각 주요 페이지에서 `document.documentElement.scrollWidth <= window.innerWidth`를 검사하고 screenshot을 `test-results/visual/`에 저장한다.

- [ ] **Step 3: 자동 검사 전체 실행**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run test:worker
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Expected: 모두 exit 0. 실패가 있으면 원인 수정 후 입력이 바뀐 검사만 재실행하고 마지막에 전체 1회 실행한다.

- [ ] **Step 4: 실제 Android·iPhone·PC manual QA**

`docs/qa/phase-1-manual-checklist.md`에 기기·브라우저 버전, 날짜, 결과, screenshot 경로를 기록한다.

필수:

- Android Chrome 설치와 standalone 실행
- iPhone Safari 홈 화면 추가와 standalone 실행
- PC Chrome 관리자 Access
- 다른 이메일 관리자 차단
- 실제 QR scan과 link claim
- airplane mode 열람·수정·재연결
- revoke 후 재연결 시 cache 삭제
- 390×844, 393×852, 1440×900에서 clipping·가로 overflow 없음

실기기 확인 전 1단계 완료로 보고하지 않는다.

- [ ] **Step 5: 구현 완료 checkpoint 자동 commit**

Task 1~12, 자동 검사, 실기기 QA가 전부 통과한 상태를 먼저 commit한다.

```bash
git add playwright.config.ts test/e2e docs/qa
git commit -m "test: verify couple travel phase one"
```

이 commit이 생성되기 전에는 Cloudflare 리소스 생성, production config 작성, migration, seed, deploy를 실행하지 않는다.

- [ ] **Step 6: 구현 완료 보고와 Cloudflare 입력·승인 gate**

외부 변경 전 사용자에게 다음 실제 값을 확인받는다.

- 관리자 host
- 공유 앱 host
- 관리자 이메일
- Cloudflare account와 zone
- D1 이름 `couple-travel-guide`
- Worker 이름 `couple-travel-guide`와 `couple-travel-guide-admin`

같은 승인에서 Cloudflare 공식 문서의 현재 Workers, D1, Access 무료 한도를 다시 확인한다. 무료 한도로 불가능한 항목이 있으면 배포하지 않고 차이를 보고한다.

- [ ] **Step 7: 명시 승인 후 Cloudflare 리소스와 production config 준비**

승인 후에만:

```bash
npx wrangler d1 create couple-travel-guide
npx wrangler d1 migrations apply couple-travel-guide --remote
npm run seed:legacy
npx wrangler d1 execute couple-travel-guide --remote --file=.tmp/legacy-sydney.sql
```

D1 create 응답의 실제 UUID를 두 Wrangler config에 기록한다. production config에서는 `DEV_AUTH`를 제거하고 각 host의 실제 `APP_ORIGIN`을 기록하며 admin config의 `PARTNER_ORIGIN`에는 공유 앱 host를 기록한다. `ADMIN_EMAIL`은 config에 쓰지 않고 admin Worker secret으로 입력한다. Access team domain과 audience는 Access application 생성 후 반환된 실제 값만 기록한다.

Cloudflare Access policy:

- application 대상: 관리자 host
- allow rule: 관리자 이메일 1개
- 다른 identity와 bypass rule 없음
- Worker 내부에서 같은 JWT audience와 email 재검증

production config 준비 후 자동 commit:

```bash
git add wrangler.jsonc wrangler.admin.jsonc
git commit -m "chore: configure Cloudflare production"
```

- [ ] **Step 8: 준비된 commit 재검증 후 production 배포**

배포 직전 working tree가 clean인지 확인하고 준비된 commit에서 다시 build한다.

```bash
git status --short
npm run build
npx wrangler deploy --config wrangler.jsonc
npx wrangler deploy --config wrangler.admin.jsonc
```

배포 직후:

- 공유 host `/` 200
- 공유 host `/api/trips` cookie 없이 401
- 관리자 host Access 로그인 전 redirect
- 허용 이메일 로그인 후 `/api/session` 200
- 다른 이메일 차단
- 두 host가 같은 D1 trip을 표시

- [ ] **Step 9: GitHub Pages 종료 gate**

Cloudflare 두 host와 실기기 확인이 모두 성공하고 사용자가 GitHub Pages 종료를 별도 승인한 경우에만 `.github/workflows/deploy-pages.yml`을 제거한다. Cloudflare 검증 전에 workflow를 삭제하지 않는다.

Cloudflare 검증 뒤 GitHub Pages 종료가 승인된 경우 별도 commit:

```bash
git rm .github/workflows/deploy-pages.yml
git commit -m "ci: complete Cloudflare migration"
```

---

## Final Completion Gate

다음이 모두 증거로 남아야 1단계 완료다.

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:worker`, `npm run build`, `npm run test:e2e` exit 0
- 관리자 Access JWT의 signature·audience·expiry·email 재검증
- 10분 초대 만료, replay 차단, hash-only 저장
- owner·partner가 같은 여행을 생성·편집·휴지통·복구
- 모든 여행 내부 탭과 통합 검색 동작
- 15초 poll, offline outbox, 재연결 flush, 수동 conflict 선택
- revoke 직후 API 차단과 다음 연결 시 local cache 삭제
- 시드니 원본 8일·맛집 28·카페 20·예약 7·팁 4 보존
- ChatGPT·Gemini 설정과 prompt가 D1에 없음
- Android Chrome·iPhone Safari·PC 실기기 QA
- Cloudflare 무료 구성과 두 host 검증
- Cloudflare 전환 전 GitHub Pages workflow 유지

## Execution Order

Task 1→6은 기반 순서라 직렬 실행한다. Task 7→10은 Task 6 이후 기능별로 독립 review 가능하지만 같은 Worktree에서는 한 명만 코드를 수정한다. Task 11은 모든 mutation UI가 연결된 뒤, Task 12는 snapshot shape가 고정된 뒤, Task 13은 전체 통합 뒤 실행한다.
