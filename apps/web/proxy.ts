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
export const config = { matcher: ["/((?!api|_next|brand|media|fonts|favicon|robots.txt|sitemap.xml|contact.vcf|qr.svg).*)"] };
