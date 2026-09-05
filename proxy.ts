import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Mirrors `SESSION_COOKIE_NAME` in lib/session.ts. Not imported directly:
 * lib/session.ts pulls in `./prisma` (PrismaClient) and `bcryptjs` at
 * module scope, neither of which is safe to load in the Proxy runtime.
 * Proxy only needs the cookie's name, not any server-only session logic.
 */
const SESSION_COOKIE_NAME = "tf_session";

/**
 * Optimistic auth gate for the `(dashboard)` route group (renamed from
 * `middleware.ts` to `proxy.ts` in Next.js 16 — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * QA finding (2026-09-04): every `(dashboard)` route — /home, /my-work,
 * /projects, /projects/[id], /projects/new, /dashboard — renders its full
 * authenticated content for a plain, cookie-less GET (confirmed with curl
 * and with an in-browser `fetch()` after a real logout, against project
 * detail pages never previously rendered in this process). The layout's
 * `if (!session) redirect("/login")` in app/(dashboard)/layout.tsx is not
 * preventing the page tree from rendering before the redirect takes
 * effect for a full-document request, despite every page under it
 * declaring `export const dynamic = "force-dynamic"`. That is a real bug
 * in the render path (worth root-causing separately — Next 16 docs
 * explicitly recommend NOT relying solely on a layout-level check, see
 * "Optimistic checks with Proxy" in the authentication guide) but a
 * cookie-presence gate here is the standard, doc-endorsed mitigation and
 * runs before any of that rendering starts, closing the leak for the
 * common case: no cookie at all (curl, crawlers, bots, shared links,
 * disabled-JS clients).
 *
 * This is deliberately an OPTIMISTIC check (cookie present, not validated
 * against the database) per Next's own guidance that Proxy "should not be
 * used as a full session management or authorization solution" — full
 * validation (expiry, deactivated user) still happens in
 * `lib/session.ts#getSession()`, called from the layout and every route
 * handler. A forged/expired/bogus cookie value still reaches the
 * layout's real check; only the *no-cookie-at-all* case is closed here.
 * That residual gap (a syntactically-present-but-invalid cookie also
 * currently leaks page content) is a separate, deeper bug — see QA report.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/home", "/my-work/:path*", "/projects/:path*", "/dashboard/:path*"],
};
