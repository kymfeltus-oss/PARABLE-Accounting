import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
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
