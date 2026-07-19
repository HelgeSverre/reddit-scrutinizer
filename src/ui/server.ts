import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import getPort from "get-port";
import open from "open";

export async function startServer(
  jsonPath: string,
  preferredPort: number,
  autoOpen: boolean,
  theme: string = "reddit",
): Promise<number> {
  const dataPath = resolve(jsonPath);
  const jsonData = await readFile(dataPath, "utf-8");

  const templatePath = join(import.meta.dir, "templates", `${theme}.html`);
  const template = await readFile(templatePath, "utf-8");

  const port = await getPort({ port: preferredPort });

  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(template, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (url.pathname === "/api/data") {
        return new Response(jsonData, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
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
