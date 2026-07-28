function normalizeBaseUrl(baseUrl: string): string {
  const withLeadingSlash = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export const APP_BASE_URL = normalizeBaseUrl(import.meta.env.BASE_URL);

function splitAppHref(href: string): {
  pathname: string;
  suffix: string;
} {
  const hashIndex = href.indexOf("#");
  const beforeHash = hashIndex < 0 ? href : href.slice(0, hashIndex);
  const hash = hashIndex < 0 ? "" : href.slice(hashIndex);
  const searchIndex = beforeHash.indexOf("?");
  const pathname = searchIndex < 0
    ? beforeHash
    : beforeHash.slice(0, searchIndex);
  const search = searchIndex < 0 ? "" : beforeHash.slice(searchIndex);

  return { pathname, suffix: `${search}${hash}` };
}

function hasBrowserNormalizedSegment(pathname: string): boolean {
  if (pathname.includes("\\")) return true;

  return pathname.split("/").some((segment) => {
    const singleDecodedDots = segment.replace(/%2e/gi, ".");
    return singleDecodedDots === "." || singleDecodedDots === "..";
  });
}

function isWithinBaseAfterBrowserNormalization(
  pathname: string,
  base: string
): boolean {
  if (base === "/") return true;

  const observedPathname = new URL(pathname, "https://app.invalid").pathname;
  const baseRoot = base.slice(0, -1);
  return observedPathname === baseRoot || observedPathname.startsWith(base);
}

export function pathForApp(path: string, baseUrl = APP_BASE_URL): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;

  const base = normalizeBaseUrl(baseUrl);
  const { pathname, suffix } = splitAppHref(path);
  const baseRoot = base.slice(0, -1);

  if (hasBrowserNormalizedSegment(pathname)) return `${base}${suffix}`;

  const basedPathname = base === "/"
    ? pathname
    : pathname === baseRoot || pathname === base
      ? base
      : pathname.startsWith(base)
        ? pathname
        : pathname === "/"
          ? base
          : `${baseRoot}${pathname}`;

  if (!isWithinBaseAfterBrowserNormalization(basedPathname, base)) {
    return `${base}${suffix}`;
  }

  return `${basedPathname}${suffix}`;
}

export function pathForAsset(path: string, baseUrl = APP_BASE_URL): string {
  const assetPath = path.replace(/^\/+/, "");
  return `${normalizeBaseUrl(baseUrl)}${assetPath}`;
}

export function stripAppBase(pathname: string, baseUrl = APP_BASE_URL): string | null {
  const base = normalizeBaseUrl(baseUrl);
  if (base === "/") return pathname;

  const baseRoot = base.slice(0, -1);
  if (pathname === baseRoot || pathname === base) return "/";
  if (!pathname.startsWith(base)) return null;
  return pathname.slice(baseRoot.length);
}
