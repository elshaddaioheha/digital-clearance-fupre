"use client";

/**
 * Browser-side API helper.
 *
 * Access tokens live for 15 minutes. Nothing used to renew them, so every
 * dashboard silently emptied itself once the token aged out — the fetches
 * 401'd and the callers fell back to `|| []`. This wraps fetch so a 401 is
 * retried once against a token refreshed from the httpOnly cookie, and a
 * genuinely dead session ends at the login page instead of a blank screen.
 */

const TOKEN_KEY = "dscs_token";
const USER_KEY = "dscs_user";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Redirects to the login page once the session is beyond recovery. Uses a full
 * navigation rather than the router so it works from anywhere, including
 * outside a component.
 */
function endSession() {
  clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

// A dashboard fires several requests at once on mount. Without this guard each
// 401 would trigger its own refresh, and since /api/auth/refresh rotates the
// refresh cookie, the later rotations would race and invalidate the session.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        // The refresh token is an httpOnly cookie, so it rides along with this
        // same-origin request; there is nothing to attach by hand.
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!res.ok) return null;

        const data = await res.json();
        if (!data?.accessToken) return null;

        setStoredToken(data.accessToken);
        return data.accessToken as string;
      } catch {
        return null;
      }
    })();

    // Release the slot once settled so a later expiry can refresh again.
    refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/**
 * fetch() with the bearer token attached and one automatic retry after a token
 * refresh. Returns the raw Response so callers keep full control over status
 * handling.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const response = await send(getStoredToken());
  if (response.status !== 401) return response;

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    endSession();
    return response;
  }

  return send(refreshedToken);
}

/**
 * Parses a JSON body without throwing on an empty or non-JSON response, which
 * is what a 405 or a proxy error page produces. Callers that did `await
 * res.json()` before checking `res.ok` used to surface a SyntaxError instead of
 * the real failure.
 */
export async function readJson<T = any>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Pulls an error message out of a failed response, falling back to something
 * that names the status rather than a bare "undefined".
 */
export async function errorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const body = await readJson<{ error?: string }>(response);
  if (body?.error) return body.error;
  return `${fallback} (HTTP ${response.status})`;
}

/**
 * Returns a token known to be usable right now, refreshing first if the current
 * one is rejected. Needed for flows that hand the token to the browser rather
 * than to fetch, such as opening the certificate PDF in a new tab.
 */
export async function getFreshToken(): Promise<string | null> {
  // apiFetch cannot help here because the browser makes the request, so mint a
  // new token up front rather than risk handing over one about to expire. If
  // the refresh fails, fall back to whatever is stored and let the server rule
  // on it.
  const refreshed = await refreshAccessToken();
  return refreshed ?? getStoredToken();
}
