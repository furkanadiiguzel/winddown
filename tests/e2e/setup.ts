/**
 * T075 — Static file server for fixture HTML files.
 * Serves tests/fixtures/ on http://localhost:4000 for E2E tests.
 * Use as a globalSetup / globalTeardown in playwright.config.ts.
 */
import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { readFile } from "fs/promises";
import { join, extname, normalize } from "path";
import { fileURLToPath } from "url";

const FIXTURE_DIR = join(fileURLToPath(import.meta.url), "../../fixtures");
const PORT = 4000;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
};

let server: Server | null = null;

function requestHandler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? "/";
  // Strip query string, normalise, prevent path traversal
  const pathname = normalize(url.split("?")[0]);
  if (pathname.includes("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const filePath = join(FIXTURE_DIR, pathname === "/" ? "/index.html" : pathname);
  const ext = extname(filePath);
  const contentType = MIME[ext] ?? "application/octet-stream";

  readFile(filePath)
    .then((data) => {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    })
    .catch(() => {
      res.writeHead(404);
      res.end("Not found");
    });
}

export default async function setup() {
  server = createServer(requestHandler);
  await new Promise<void>((resolve, reject) => {
    server!.listen(PORT, "127.0.0.1", resolve);
    server!.once("error", reject);
  });
}

export async function teardown() {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
}
