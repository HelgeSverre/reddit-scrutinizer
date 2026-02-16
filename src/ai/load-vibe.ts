import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const VIBES_DIR = join(import.meta.dir, "vibes");

export function loadVibePack(subreddit: string): Record<string, unknown> {
  const filePath = join(VIBES_DIR, `${subreddit}.json`);

  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  }

  return {
    subreddit,
    tone: ["casual", "technical", "opinionated"],
    pet_topics: [],
    taboos: [],
    archetypes: [
      { type: "enthusiast", frequency: 0.3, description: "Genuinely excited about new projects" },
      { type: "skeptic", frequency: 0.2, description: "Asks tough questions, wants to see proof" },
      { type: "helper", frequency: 0.25, description: "Offers constructive suggestions" },
      { type: "lurker-commenter", frequency: 0.15, description: "Short low-effort replies" },
      { type: "troll", frequency: 0.1, description: "Contrarian or dismissive" },
    ],
    common_flairs: [],
    typical_replies: [],
  };
}
