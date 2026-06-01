import fs from "node:fs";
import path from "node:path";
import { packageName, walkFiles } from "./workspace.mjs";

const packageArg = process.argv[2];
if (!packageArg) {
  throw new Error("Usage: node scripts/typecheck-package.mjs <package-dir>");
}

const packageDir = path.resolve(process.cwd(), packageArg);
const srcDir = path.join(packageDir, "src");
const name = packageName(packageDir);
const sourceFiles = walkFiles(srcDir, (filePath) => /\.(ts|tsx)$/.test(filePath));
const legacyDawName = ["D", "A", "w", "Name"].join("");

if (sourceFiles.length === 0) {
  throw new Error(`${name} has no source files.`);
}

for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, "utf8");
  if (source.includes(legacyDawName)) {
    throw new Error(`${name} still contains legacy DAW name casing in ${sourceFile}`);
  }
  validateLocalImports(sourceFile, source);
}

console.log(`Typecheck package gate passed: ${name}`);

function validateLocalImports(sourceFile, source) {
  const importPattern = /from "([^"]+)"/g;
  let match;
  while ((match = importPattern.exec(source))) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) {
      continue;
    }
    const resolved = path.resolve(path.dirname(sourceFile), specifier);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Unresolved import ${specifier} from ${sourceFile}`);
    }
  }
}
