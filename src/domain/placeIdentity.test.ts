import { describe, expect, it } from "vitest";
import { isSamePlace, type PlaceIdentity } from "./placeIdentity";

const place: PlaceIdentity = {
  address: "Circular Quay, Sydney",
  latitude: -33.858,
  longitude: 151.21,
  name: "Quay",
  providerPlaceId: "google-quay-circular",
};

describe("isSamePlace", () => {
  it("uses provider ids when both places have one", () => {
    expect(isSamePlace(place, { ...place })).toBe(true);
    expect(isSamePlace(place, {
      ...place,
      address: place.address,
      providerPlaceId: "google-quay-barangaroo",
    })).toBe(false);
  });

  it("matches legacy places only with the same name and address or coordinates", () => {
    const legacy = { ...place, providerPlaceId: null };
    expect(isSamePlace(legacy, { ...place, providerPlaceId: null })).toBe(true);
    expect(isSamePlace(legacy, {
      ...place,
      address: "Barangaroo, Sydney",
      latitude: -33.865,
      longitude: 151.201,
    })).toBe(false);
  });
});
