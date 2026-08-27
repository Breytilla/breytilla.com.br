import { type NextRequest, NextResponse } from "next/server";

/** Adds privacy headers to the discreet admin entry without publishing its path. */
export function proxy(request: NextRequest) {
  const accessKey = process.env.ADMIN_ROUTE_KEY;
  if (!accessKey) {
    return NextResponse.next();
  }

  const adminPrefix = `/${accessKey}`;
  if (
    request.nextUrl.pathname !== adminPrefix &&
    !request.nextUrl.pathname.startsWith(`${adminPrefix}/`)
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/((?!monitoring|_next/static|_next/image|favicon.ico).*)"],
};
