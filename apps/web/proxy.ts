import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (url.pathname === "/nl" || url.pathname.startsWith("/nl/")) {
    url.pathname = url.pathname.replace(/^\/nl/, "") || "/";
    return NextResponse.redirect(url, 308);
  }
  if (url.pathname !== "/en" && !url.pathname.startsWith("/en/")) url.pathname = `/nl${url.pathname}`;
  return NextResponse.rewrite(url);
}
// Pages never contain a dot, so every path with a file extension (site.js, icons,
// contact.vcf, qr.svg, robots.txt, ...) is served directly instead of rewritten.
export const config = { matcher: ["/((?!api|_next|brand|fonts|.*\\..*).*)"] };
