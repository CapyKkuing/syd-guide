import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseLegacySources } from "./parse.mjs";
import { renderLegacySql } from "./render-sql.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceNames = [
  "schedule.html",
  "food.html",
  "cafe.html",
  "booking.html",
  "tips.html"
];

async function readSources() {
  return Object.fromEntries(await Promise.all(sourceNames.map(async (name) => [
    name,
    await readFile(path.join(root, name), "utf8")
  ])));
}

test("parses every approved legacy Sydney record", async () => {
  const data = parseLegacySources(await readSources());

  assert.equal(data.days.length, 8);
  assert.equal(data.food.length, 28);
  assert.equal(data.cafes.length, 20);
  assert.equal(data.bookings.length, 7);
  assert.equal(data.tips.length, 4);
  assert.deepEqual(
    data.days.map((day) => day.date),
    [
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15"
    ]
  );
  assert.equal(data.days[0].items[0].title, "시드니 공항 도착");
  assert.equal(data.food[0].name, "Bornga");
  assert.equal(data.cafes[1].name, "Single O");
  assert.equal(data.bookings[0].provider, "타롱가 동물원");
  assert.equal(data.tips[0].title, "교통카드");
});

test("renders an idempotent, quote-safe, byte-stable SQL seed", async () => {
  const data = parseLegacySources(await readSources());
  const first = renderLegacySql(data);
  const second = renderLegacySql(data);

  assert.equal(first, second);
  assert.match(first, /legacy-sydney-2026/);
  assert.match(first, /Australia\/Sydney/);
  assert.match(first, /legacy-sydney-v1/);
  assert.match(
    first,
    /WHERE NOT EXISTS \(SELECT 1 FROM data_imports WHERE key = 'legacy-sydney-v1'\)/
  );
  assert.match(first, /Mrs Macquarie''s Chair/);
  assert.match(first, /route-opera-house/);
  assert.match(first, /legacy-schedule-02-01', 'legacy-sydney-2026', 'legacy-day-02', 'route-opera-house'/);
  assert.match(first, /legacy-schedule-01-02', 'legacy-sydney-2026', 'legacy-day-01', NULL/);
  assert.ok(first.endsWith("\n"));
});
