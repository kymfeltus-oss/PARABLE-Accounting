import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public marketing showcases live under `/demo/*` (no login). Official site: https://www.parableaccountant.com
 * If session protection is added for other routes, keep `/demo/` on the allowlist — this file is the supported
 * request hook (Next 16+ uses `proxy.ts` instead of `middleware.ts` in this project).
 *
 * Case-only aliases for /member-portal.
 * Do NOT use next.config redirects with paths that differ only by case — Next can normalize
 * sources to lowercase and match the real route, causing ERR_TOO_MANY_REDIRECTS.
 */
export function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (p === "/MEMBER-PORTAL" || p === "/MEMBER-PORTAL/") {
    return NextResponse.redirect(new URL("/member-portal", request.url));
  }
  if (p === "/Member-Portal" || p === "/Member-Portal/") {
    return NextResponse.redirect(new URL("/member-portal", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/MEMBER-PORTAL", "/MEMBER-PORTAL/", "/Member-Portal", "/Member-Portal/"],
};
