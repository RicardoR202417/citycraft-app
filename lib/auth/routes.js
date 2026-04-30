export const DEFAULT_AUTH_REDIRECT = "/dashboard";

export const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/government",
  "/admin"
];

export const AUTH_ROUTES = ["/login", "/auth/callback"];

function matchesRoute(pathname, route) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isProtectedRoute(pathname) {
  return PROTECTED_ROUTES.some((route) => matchesRoute(pathname, route));
}

export function isAuthRoute(pathname) {
  return AUTH_ROUTES.some((route) => matchesRoute(pathname, route));
}

export function normalizeRedirectPath(value, fallback = DEFAULT_AUTH_REDIRECT) {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  const candidate = value.trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(candidate, "https://citycraft.local");
    const normalized = `${url.pathname}${url.search}${url.hash}`;

    if (isAuthRoute(url.pathname)) {
      return fallback;
    }

    return normalized;
  } catch {
    return fallback;
  }
}
