import { describe, expect, it } from "vitest";
import { isSafeGoogleMapsUrl } from "./externalUrls";

describe("isSafeGoogleMapsUrl", () => {
  it.each([
    "https://www.google.com/maps/search/?api=1&query=Sydney+Opera+House",
    "https://google.com/maps",
    "https://maps.google.com/maps"
  ])("accepts intended Google Maps HTTPS hosts: %s", (value) => {
    expect(isSafeGoogleMapsUrl(value)).toBe(true);
  });

  it.each([
    "https://evil.example/maps",
    "https://google.com.evil.example/maps",
    "https://evilgOOgle.com/maps",
    "https://user@www.google.com/maps",
    "http://www.google.com/maps",
    "javascript:alert('unsafe')",
    "/maps"
  ])("rejects a non-Google or unsafe map URL: %s", (value) => {
    expect(isSafeGoogleMapsUrl(value)).toBe(false);
  });
});
