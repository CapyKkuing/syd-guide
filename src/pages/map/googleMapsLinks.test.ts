import { describe, expect, it } from "vitest";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "./googleMapsLinks";

describe("Google Maps links", () => {
  const place = {
    name: "The Rocks Café",
    address: "99 George St",
    latitude: -33.859,
    longitude: 151.209
  };

  it("builds an encoded Google Maps search URL", () => {
    expect(googleMapsSearchUrl(place)).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/
    );
    expect(googleMapsSearchUrl(place)).toContain("The%20Rocks%20Caf%C3%A9");
  });

  it("uses coordinates as the directions destination when available", () => {
    expect(googleMapsDirectionsUrl(place)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-33.859%2C151.209"
    );
  });
});
