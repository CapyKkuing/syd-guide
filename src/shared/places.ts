export type PlaceProviderSku =
  | "text-search-enterprise"
  | "place-details-enterprise"
  | "place-photo";

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
