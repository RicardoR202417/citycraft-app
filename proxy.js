import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { isProtectedRoute, normalizeRedirectPath } from "./lib/auth/routes";

export async function proxy(request) {
  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isProtected = isProtectedRoute(request.nextUrl.pathname);

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "next",
      normalizeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`)
    );
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname === "/login" && user) {
    const nextPath = normalizeRedirectPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/properties/:path*",
    "/districts/:path*",
    "/organizations/:path*",
    "/economy/:path*",
    "/government/:path*",
    "/admin/:path*",
    "/login"
  ]
};
