import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const tools = [
  {
    name: "Node.js",
    command: "node",
    args: ["--version"],
    required: true,
    purpose: "Runs Next.js and local launch scripts.",
  },
  {
    name: "npm",
    command: "npm",
    args: ["--version"],
    required: true,
    purpose: "Installs dependencies and runs package scripts.",
  },
  {
    name: "Git",
    command: "git",
    args: ["--version"],
    required: true,
    purpose: "Connects the project folder to the GitHub repo.",
  },
  {
    name: "Vercel CLI",
    command: "vercel",
    args: ["--version"],
    required: false,
    purpose: "Optional CLI deployment and environment management.",
  },
  {
    name: "Stripe CLI",
    command: "stripe",
    args: ["--version"],
    required: false,
    purpose: "Optional local webhook testing.",
  },
  {
    name: "Supabase CLI",
    command: "supabase",
    args: ["--version"],
    required: false,
    purpose: "Optional local migrations and Supabase project checks.",
  },
  {
    name: "Python",
    command: "python",
    args: ["--version"],
    required: false,
    purpose: "Optional future audio analysis microservices.",
  },
  {
    name: "FFmpeg",
    command: "ffmpeg",
    args: ["-version"],
    required: false,
    purpose: "Optional future audio metadata and transcoding.",
  },
  {
    name: "Ollama",
    command: "ollama",
    args: ["--version"],
    required: false,
    purpose: "Optional future local model experiments.",
  },
];

let missingRequired = 0;

console.log("SONARA OS™ software check");
console.log("No software will be installed by this script.\n");

for (const tool of tools) {
  const commandLine = [tool.command, ...tool.args].join(" ");
  const result = spawnSync(commandLine, {
    encoding: "utf8",
    shell: true,
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .trim()
    .split(/\r?\n/)[0];

  if (result.status === 0) {
    console.log(`✅ ${tool.name}: ${output || "found"} — ${tool.purpose}`);
  } else if (tool.required) {
    missingRequired += 1;
    console.log(`⚠️ ${tool.name}: missing required tool — ${tool.purpose}`);
  } else {
    console.log(`⚠️ ${tool.name}: optional tool not found — ${tool.purpose}`);
  }
}

console.log("");

const projectChecks = [
  {
    label: "package.json",
    path: "package.json",
    required: true,
    ok: existsSync("package.json"),
    detail: "Project manifest is required.",
  },
  {
    label: "package-lock.json",
    path: "package-lock.json",
    required: true,
    ok: existsSync("package-lock.json"),
    detail: "Lockfile is required for safe npm ci installs.",
  },
  {
    label: ".git",
    path: ".git",
    required: false,
    ok: existsSync(".git"),
    detail:
      "Local repo connection is needed before pushing to famouslytrill-boop/sonara-os.",
  },
];

console.log("Project root checks");
for (const check of projectChecks) {
  if (check.ok) {
    console.log(`✅ ${check.label}: found — ${check.detail}`);
  } else if (check.required) {
    missingRequired += 1;
    console.log(`⚠️ ${check.label}: missing required file — ${check.detail}`);
  } else {
    console.log(`⚠️ ${check.label}: not found — ${check.detail}`);
  }
}

console.log("");

if (missingRequired > 0) {
  console.log(
    `Software check failed: ${missingRequired} required tool(s) missing. See docs/SOFTWARE_REQUIREMENTS_MATRIX.md.`
  );
  process.exitCode = 1;
} else {
  console.log(
    "Software check complete: required local tools are available. Optional tools can stay uninstalled until needed."
  );
}
