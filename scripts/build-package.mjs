import fs from "node:fs";
import path from "node:path";
import { repoRoot, walkFiles } from "./workspace.mjs";

const packageArg = process.argv[2];
if (!packageArg) {
  throw new Error("Usage: node scripts/build-package.mjs <package-dir>");
}

const packageDir = path.resolve(process.cwd(), packageArg);
const srcDir = path.join(packageDir, "src");
const distDir = path.join(packageDir, "dist");

if (!fs.existsSync(srcDir)) {
  throw new Error(`Missing src directory: ${path.relative(repoRoot, srcDir)}`);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const sourceFile of walkFiles(srcDir, (filePath) => filePath.endsWith(".ts"))) {
  const relativeSource = path.relative(srcDir, sourceFile);
  const relativeOutput = relativeSource.replace(/\.ts$/, ".mjs");
  const outputFile = path.join(distDir, relativeOutput);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const source = fs.readFileSync(sourceFile, "utf8");
  fs.writeFileSync(outputFile, transpileSource(source), "utf8");
}

function transpileSource(source) {
  return source.replace(/from "([^"]+)\.ts"/g, 'from "$1.mjs"');
}
