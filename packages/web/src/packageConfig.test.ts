import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package manager and runtime configuration", () => {
  it("uses pnpm and a Vercel-supported exact Node major", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as {
      packageManager?: string;
      engines?: { node?: string };
    };

    expect(packageJson.packageManager).toMatch(/^pnpm@/);
    expect(packageJson.engines?.node).toBe("22.x");
  });
});
