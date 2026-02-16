import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

export async function startServer(jsonPath: string, port: number, autoOpen: boolean): Promise<void> {
  const dataPath = resolve(jsonPath);
  const jsonData = await readFile(dataPath, "utf-8");

  const templatePath = join(import.meta.dir, "template.html");
  const template = await readFile(templatePath, "utf-8");

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
    const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
    Bun.spawn([openCmd, `http://localhost:${server.port}`]);
  }
}
