import { z } from "zod";
import type { BookingOcrDraft } from "../../src/shared/ocr";

export type GoogleVisionFetch = typeof fetch;
export type VisionTokenProvider = (
  config: GoogleVisionConfig,
  fetcher: GoogleVisionFetch
) => Promise<string>;

export interface GoogleVisionConfig {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

export interface VisionDocumentResult {
  draft: BookingOcrDraft;
  rawText: string;
}

export class GoogleVisionProviderError extends Error {
  constructor(readonly status: number) {
    super("Google Vision request failed");
  }
}

const imageResponseSchema = z.object({
  responses: z.array(z.object({
    fullTextAnnotation: z.object({ text: z.string() }).optional(),
    error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
  })).default([]),
});

const fileResponseSchema = z.object({
  responses: z.array(z.object({
    responses: z.array(z.object({
      fullTextAnnotation: z.object({ text: z.string() }).optional(),
      error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
    })).default([]),
    error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
  })).default([]),
});

export async function analyzeBookingDocument(
  config: GoogleVisionConfig,
  file: File,
  fetcher: GoogleVisionFetch = fetch,
  tokenProvider: VisionTokenProvider = getVisionAccessToken
): Promise<VisionDocumentResult> {
  const token = await tokenProvider(config, fetcher);
  const content = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
  const parent = `projects/${config.projectId}/locations/us`;
  const pdf = file.type === "application/pdf";
  const response = await fetcher(
    pdf
      ? "https://vision.googleapis.com/v1/files:annotate"
      : "https://vision.googleapis.com/v1/images:annotate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pdf ? {
        parent,
        requests: [{
          inputConfig: { content, mimeType: file.type },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: [1, 2, 3, 4, 5],
        }],
      } : {
        parent,
        requests: [{
          image: { content },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        }],
      }),
    }
  );
  if (!response.ok) throw new GoogleVisionProviderError(response.status);
  const rawText = pdf
    ? fileText(await response.json())
    : imageText(await response.json());
  return { rawText, draft: bookingDraft(rawText) };
}

function imageText(value: unknown) {
  const parsed = imageResponseSchema.safeParse(value);
  if (!parsed.success || parsed.data.responses.some((item) => item.error?.code)) {
    throw new GoogleVisionProviderError(502);
  }
  return parsed.data.responses.map((item) => item.fullTextAnnotation?.text ?? "")
    .join("\n").trim().slice(0, 50_000);
}

function fileText(value: unknown) {
  const parsed = fileResponseSchema.safeParse(value);
  if (
    !parsed.success
    || parsed.data.responses.some((file) => (
      file.error?.code || file.responses.some((page) => page.error?.code)
    ))
  ) {
    throw new GoogleVisionProviderError(502);
  }
  return parsed.data.responses.flatMap((file) => file.responses)
    .map((page) => page.fullTextAnnotation?.text ?? "")
    .join("\n").trim().slice(0, 50_000);
}

export function bookingDraft(text: string): BookingOcrDraft {
  const dates = findDateTimes(text);
  const reservation = /(?:예약(?:번호|코드)|booking\s*(?:reference|code)|confirmation\s*(?:number|code)|pnr)\s*[:#-]?\s*([a-z0-9-]{4,12})/i.exec(text);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    bookingType: bookingType(text),
    provider: lines.find((line) => (
      line.length >= 2
      && line.length <= 80
      && !/^(예약|booking|confirmation|date|time|출발|도착|passenger|승객)/i.test(line)
    )) ?? null,
    reservationCode: reservation?.[1]?.toUpperCase() ?? null,
    startsAt: dates[0] ?? null,
    endsAt: dates[1] ?? null,
  };
}

function bookingType(text: string): BookingOcrDraft["bookingType"] {
  if (/boarding pass|flight|항공|탑승권|비행/i.test(text)) return "flight";
  if (/hotel|accommodation|숙소|호텔|체크인/i.test(text)) return "lodging";
  if (/restaurant|식당|레스토랑/i.test(text)) return "restaurant";
  if (/tour|투어|관광/i.test(text)) return "tour";
  if (/train|bus|ferry|transport|기차|버스|페리|교통/i.test(text)) return "transport";
  if (/ticket|admission|입장권|티켓/i.test(text)) return "ticket";
  return null;
}

function findDateTimes(text: string) {
  const result: string[] = [];
  const patterns = [
    /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:[^\d\n]{0,8}(\d{1,2}):(\d{2}))?/g,
    /(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s*(\d{1,2})시\s*(\d{1,2})?분?)?/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const [, year, month, day, hour = "00", minute = "00"] = match;
      const value = `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
      if (!result.includes(value)) result.push(value);
    }
  }
  return result.slice(0, 2);
}

let cachedToken: { email: string; expiresAt: number; value: string } | null = null;

async function getVisionAccessToken(
  config: GoogleVisionConfig,
  fetcher: GoogleVisionFetch
) {
  if (cachedToken?.email === config.clientEmail && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-vision",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(config.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}`,
    }),
  });
  if (!response.ok) throw new GoogleVisionProviderError(response.status);
  const body = z.object({ access_token: z.string(), expires_in: z.number().positive() })
    .safeParse(await response.json());
  if (!body.success) throw new GoogleVisionProviderError(502);
  cachedToken = {
    email: config.clientEmail,
    expiresAt: Date.now() + body.data.expires_in * 1000,
    value: body.data.access_token,
  };
  return body.data.access_token;
}

function pemBytes(value: string) {
  const binary = atob(value.replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
