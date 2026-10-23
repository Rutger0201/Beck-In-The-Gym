import { loadEnvConfig } from "@next/env";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "@bitg/core/headers";
loadEnvConfig(fileURLToPath(new URL("../../", import.meta.url)));
export default {
  transpilePackages: ["@bitg/core", "@bitg/database"],
  poweredByHeader: false,
  // The marketing dashboard lives at /marketing on the admin origin; /admin/marketing is kept as an alias.
  async redirects() { return [{ source: "/admin/marketing/:path*", destination: "/marketing/:path*", permanent: false }, { source: "/admin/growth/:path*", destination: "/growth/:path*", permanent: false }, { source: "/admin/growth", destination: "/growth", permanent: false }, { source: "/admin", destination: "/", permanent: false }]; },
  async headers() { return [{ source: "/:path*", headers: securityHeaders(true) }]; }
};
