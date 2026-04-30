import { NextResponse } from "next/server";
import { normalizeRedirectPath } from "../../../lib/auth/routes";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeRedirectPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(loginUrl);
}
