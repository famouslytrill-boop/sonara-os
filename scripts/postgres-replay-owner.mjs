import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// An explicit CI selection must not silently fall back to another major.
export function replayBinaries(directory, exists = fs.existsSync) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) return null;
  const resolved = path.resolve(directory);
  return ["initdb", "pg_ctl", "psql"].every((name) => exists(path.join(resolved, name)))
    ? resolved
    : null;
}

// Resolve the actual primary group: Unix user and group names may differ.
export function replayOwner(user, execute = execFileSync) {
  if (!user) return null;
  const uid = execute("id", ["-u", user], { encoding: "utf8" }).trim();
  const gid = execute("id", ["-g", user], { encoding: "utf8" }).trim();
  if (!/^\d+$/.test(uid) || !/^\d+$/.test(gid) || Number(uid) === 0) {
    throw new Error("Migration replay requires a valid non-root Unix identity.");
  }
  return `${uid}:${gid}`;
}
