import "server-only";
import { sameOrigin, readLimitedJson } from "@bitg/core/security";
import { InvalidChange, RunConflict, VersionConflict } from "@bitg/database/marketing";
import { authorisedOwner } from "./authorize";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
// Every marketing write: same origin, session + 2FA + owner membership, bounded and validated JSON.
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };
export async function marketingWrite<T>(request: Request, action: string, schema: Schema<T> | null, work: (input: T, actor: string) => Promise<unknown>, id?: string) {
  try {
    if (!process.env.ADMIN_URL || !sameOrigin(request.headers.get("origin"), process.env.ADMIN_URL)) return json({ error: "Forbidden" }, 403);
    const owner = await authorisedOwner(request.headers); if (!owner) return json({ error: "Unauthorized" }, 401);
    if (id !== undefined && !uuid.test(id)) return json({ error: "Invalid request" }, 400);
    let input: unknown = {};
    if (schema) {
      const parsed = schema.safeParse(await readLimitedJson(request, 8192).catch(() => undefined));
      if (!parsed.success) return json({ error: "Invalid request" }, 400);
      input = parsed.data;
    }
    return json(await work(input as T, owner.user.id) ?? { ok: true });
  } catch (error) {
    if (error instanceof VersionConflict) return json({ error: "Changed" }, 409);
    if (error instanceof RunConflict) return json({ error: "Busy" }, 429);
    if (error instanceof InvalidChange) return json({ error: "Not allowed" }, 422);
    // Log the failure class only; request bodies may contain owner-written text.
    console.error(`marketing.${action} failed`, error instanceof Error ? error.name : "unknown");
    return json({ error: "Request failed" }, 503);
  }
}
