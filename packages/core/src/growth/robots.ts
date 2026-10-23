// Minimal robots.txt support (RFC 9309): groups per user agent, longest-match Allow/Disallow with * and $.
export type RobotsRules = { allow: string[]; disallow: string[]; crawlDelay: number | null };
export function parseRobots(text: string, agent: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[]; delay: number | null }[] = [];
  let current: (typeof groups)[number] | null = null, lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(), colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], allow: [], disallow: [], delay: null }; groups.push(current); }
      current.agents.push(value.toLowerCase()); lastWasAgent = true; continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" && value) current.allow.push(value);
    else if (key === "disallow" && value) current.disallow.push(value);
    else if (key === "crawl-delay" && /^\d+(\.\d+)?$/.test(value)) current.delay = Number(value);
  }
  const token = agent.toLowerCase().split("/")[0];
  const specific = groups.filter(group => group.agents.some(name => name !== "*" && token.includes(name)));
  const chosen = specific.length ? specific : groups.filter(group => group.agents.includes("*"));
  return { allow: chosen.flatMap(g => g.allow), disallow: chosen.flatMap(g => g.disallow), crawlDelay: chosen.find(g => g.delay !== null)?.delay ?? null };
}
function matchLength(pattern: string, path: string): number {
  const anchored = pattern.endsWith("$"), body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(`^${body.split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${anchored ? "$" : ""}`);
  return regex.test(path) ? body.length : -1;
}
export function robotsAllows(rules: RobotsRules, path: string): boolean {
  const allow = Math.max(-1, ...rules.allow.map(p => matchLength(p, path))), disallow = Math.max(-1, ...rules.disallow.map(p => matchLength(p, path)));
  return disallow < 0 || allow >= disallow;
}
