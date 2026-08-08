import type { Env } from "../env";

export const VISION_OCR_PAGE_LIMIT = 800;

export async function reserveVisionOcrPages(
  env: Env,
  pages: number,
  now: Date
) {
  const row = await env.DB.prepare(
    `INSERT INTO vision_ocr_usage (billing_month, used_pages, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (billing_month) DO UPDATE SET
       used_pages = used_pages + excluded.used_pages,
       updated_at = excluded.updated_at
     WHERE used_pages + excluded.used_pages <= ?
     RETURNING used_pages`
  ).bind(billingMonth(now), pages, now.toISOString(), VISION_OCR_PAGE_LIMIT)
    .first<{ used_pages: number }>();
  return row ? Number(row.used_pages) : null;
}

function billingMonth(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}
