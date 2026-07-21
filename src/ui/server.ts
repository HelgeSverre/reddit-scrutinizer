import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import getPort from "get-port";
import open from "open";
import type { Theme } from "../cli";
import { parseScrutiny } from "../output/export-html";
import { renderThemeDocument } from "./render";

export async function startServer(
  jsonPath: string,
  preferredPort: number,
  autoOpen: boolean,
  theme: string = "reddit",
): Promise<number> {
  const dataPath = resolve(jsonPath);
  const doc = parseScrutiny(await readFile(dataPath, "utf-8"));
  // Render once at startup; the scrutiny data is static. Throws on an unknown theme.
  const html = renderThemeDocument(theme as Theme, doc);

  const port = await getPort({ port: preferredPort });

  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  if (autoOpen) {
    const url = `http://localhost:${server.port}`;
    try {
      await open(url);
    } catch {
      console.log(`Could not open browser automatically. Visit ${url}`);
    }
  }

  return server.port ?? port;
}
