import { z } from "zod";
import type { PlaceDiscoveryDetails } from "../../src/shared/places";

const attributionSchema = z.object({
  displayName: z.string().default(""),
  uri: z.string().url().optional(),
  photoUri: z.string().url().optional(),
});

const photoSchema = z.object({
  name: z.string(),
  authorAttributions: z.array(attributionSchema).default([]),
  googleMapsUri: z.string().url().optional(),
});

const placeSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }),
  formattedAddress: z.string().default(""),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  googleMapsUri: z.string().url(),
  rating: z.number().optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  currentOpeningHours: z.object({
    openNow: z.boolean().optional(),
    weekdayDescriptions: z.array(z.string()).default([]),
  }).optional(),
  nationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().url().optional(),
  photos: z.array(photoSchema).default([]),
});

const searchResponseSchema = z.object({ places: z.array(placeSchema).default([]) });

export type GooglePlacesFetch = typeof fetch;

export class GooglePlacesProviderError extends Error {
  constructor(readonly status: number) {
    super("Google Places request failed");
  }
}

const fields = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "currentOpeningHours",
  "nationalPhoneNumber",
  "websiteUri",
  "photos",
].join(",");

export async function searchGooglePlace(
  apiKey: string,
  query: string,
  fetcher: GooglePlacesFetch,
  location?: { latitude: number; longitude: number },
  expectedName?: string
): Promise<PlaceDiscoveryDetails | null> {
  const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields.split(",").map((field) => `places.${field}`).join(","),
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
      languageCode: "ko",
      locationBias: location ? {
        circle: { center: location, radius: 50000 },
      } : undefined,
    }),
  });
  if (!response.ok) throw new GooglePlacesProviderError(response.status);
  const parsed = searchResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new GooglePlacesProviderError(502);
  const place = parsed.data.places[0];
  if (!place || (expectedName && !isLikelyNameMatch(expectedName, place.displayName.text))) {
    return null;
  }
  return mapPlace(place);
}

export async function getGooglePlace(
  apiKey: string,
  placeId: string,
  fetcher: GooglePlacesFetch
): Promise<PlaceDiscoveryDetails | null> {
  const response = await fetcher(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fields } }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new GooglePlacesProviderError(response.status);
  const parsed = placeSchema.safeParse(await response.json());
  if (!parsed.success) throw new GooglePlacesProviderError(502);
  return mapPlace(parsed.data);
}

export async function getGooglePlacePhoto(
  apiKey: string,
  name: string,
  fetcher: GooglePlacesFetch
): Promise<Response> {
  const response = await fetcher(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=720`,
    { headers: { "X-Goog-Api-Key": apiKey } }
  );
  if (!response.ok || !response.body) {
    throw new GooglePlacesProviderError(response.status);
  }
  return response;
}

function mapPlace(place: z.output<typeof placeSchema>): PlaceDiscoveryDetails {
  const photo = place.photos[0];
  return {
    provider: "google-places",
    providerPlaceId: place.id,
    name: place.displayName.text,
    address: place.formattedAddress,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    mapUrl: place.googleMapsUri,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? 0,
    openNow: place.currentOpeningHours?.openNow ?? null,
    weekdayDescriptions: place.currentOpeningHours?.weekdayDescriptions ?? [],
    phone: place.nationalPhoneNumber ?? null,
    websiteUrl: place.websiteUri ?? null,
    photo: photo ? {
      name: photo.name,
      sourceUrl: photo.googleMapsUri ?? null,
      authorAttributions: photo.authorAttributions.map((attribution) => ({
        displayName: attribution.displayName,
        uri: attribution.uri ?? null,
        photoUri: attribution.photoUri ?? null,
      })),
    } : null,
  };
}

const genericNameTokens = new Set([
  "and", "bar", "bbq", "cafe", "coffee", "korean", "restaurant", "the",
]);

function isLikelyNameMatch(expected: string, actual: string): boolean {
  const compactExpected = compactName(expected);
  const compactActual = compactName(actual);
  if (compactExpected.length >= 4 && (
    compactExpected.includes(compactActual) || compactActual.includes(compactExpected)
  )) {
    return true;
  }
  const actualTokens = new Set(nameTokens(actual));
  return nameTokens(expected).some((token) => actualTokens.has(token));
}

function compactName(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function nameTokens(value: string): string[] {
  return value.normalize("NFKD").toLocaleLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter((token) => token.length > 2 && !genericNameTokens.has(token));
}
