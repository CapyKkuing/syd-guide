export const SESSION_COOKIE = "couple_session";

const ATTRIBUTES = "Path=/; HttpOnly; Secure; SameSite=Strict";

export function readSessionCookie(request: Request): string | null {
  const cookies = request.headers.get("Cookie");
  if (!cookies) return null;

  for (const part of cookies.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; ${ATTRIBUTES}; Max-Age=7776000`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`;
}
