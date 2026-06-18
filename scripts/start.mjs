import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { repoRoot } from "./workspace.mjs";
import { securityHeaderRecord } from "./security-headers.mjs";

const webDistDir = path.join(repoRoot, "packages", "web", "dist");
const port = Number(process.env.PORT ?? 4173);

if (!fs.existsSync(path.join(webDistDir, "index.html"))) {
  console.error("Missing packages/web/dist/index.html. Run pnpm build before pnpm start.");
  process.exit(1);
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"]
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const candidatePath = path.normalize(path.join(webDistDir, decodeURIComponent(requestedPath)));
  const candidateIsFile =
    candidatePath.startsWith(webDistDir) &&
    fs.existsSync(candidatePath) &&
    fs.statSync(candidatePath).isFile();
  const filePath =
    candidatePath.startsWith(webDistDir) && candidateIsFile
      ? candidatePath
      : path.join(webDistDir, "index.html");

  if (!filePath.startsWith(webDistDir) || !fs.existsSync(filePath)) {
    response.writeHead(404, {
      "content-type": "text/plain; charset=utf-8",
      ...securityHeaderRecord
    });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
    ...securityHeaderRecord
  });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`SONARA production server running at http://localhost:${port}`);
});
