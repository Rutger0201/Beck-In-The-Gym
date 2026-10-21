import { loadEnvConfig } from "@next/env";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "@bitg/core/headers";
loadEnvConfig(fileURLToPath(new URL("../../", import.meta.url)));
export default {
  transpilePackages: ["@bitg/core", "@bitg/database"],
  poweredByHeader: false,
  async headers() { return [{ source: "/:path*", headers: securityHeaders() }]; }
};
