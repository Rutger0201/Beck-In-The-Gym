export function securityHeaders(admin = false) {
  const production = process.env.NODE_ENV === "production";
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: ["default-src 'self'", `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}${admin ? "" : " https://gc.zgo.at"}`, "style-src 'self' 'unsafe-inline'", `img-src 'self' data:${admin ? " https://service.pdok.nl" : ""}`, "font-src 'self'", `connect-src 'self'${admin ? "" : " https://*.goatcounter.com"}${production ? "" : " ws: http://localhost:*"}`, "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; ") },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ...(admin ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }, { key: "Cache-Control", value: "private, no-store" }] : [])
  ];
}
