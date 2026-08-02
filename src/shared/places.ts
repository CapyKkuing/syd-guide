export type PlaceProviderSku =
  | "text-search-enterprise"
  | "place-details-enterprise"
  | "nearby-search-enterprise"
  | "place-photo";

export type PlaceRecommendationCategory = "restaurant" | "cafe";

export interface PlaceProviderUsage {
  sku: PlaceProviderSku;
  used: number;
  limit: number;
}

export interface PlaceDiscoveryDetails {
  provider: "google-places";
  providerPlaceId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string;
  rating: number | null;
  userRatingCount: number;
  openNow: boolean | null;
  weekdayDescriptions: string[];
  phone: string | null;
  websiteUrl: string | null;
  photo: {
    name: string;
    sourceUrl: string | null;
    authorAttributions: Array<{
      displayName: string;
      uri: string | null;
      photoUri: string | null;
    }>;
  } | null;
}

export interface PlaceDiscoveryResponse {
  details: PlaceDiscoveryDetails | null;
  usage: PlaceProviderUsage[];
}

export interface PlaceRecommendationResponse {
  places: PlaceDiscoveryDetails[];
  usage: PlaceProviderUsage[];
}
