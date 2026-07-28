export function isSafeExternalHttpsUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

const googleMapsHosts = new Set(["google.com", "www.google.com", "maps.google.com"]);

export function isSafeGoogleMapsUrl(value: string | null): value is string {
  if (!isSafeExternalHttpsUrl(value)) return false;
  return googleMapsHosts.has(new URL(value).hostname.toLowerCase());
}
