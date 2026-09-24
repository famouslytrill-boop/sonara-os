#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE_FILE = path.join(ROOT, "docker-compose.open-source.yml");
const TEMPLATE_FILE = path.join(ROOT, "config", "open-source.example.env");
const LOCAL_ENV_FILE = path.join(ROOT, ".env.open-source.local");
const APP_ENV_FILE = path.join(ROOT, ".env");
const APP_ENV_EXAMPLE = path.join(ROOT, ".env.example");

const CORE_SERVICES = Object.freeze(["ollama", "langflow", "crawl4ai"]);
const REVIEWED_SERVICES = Object.freeze(["open-webui"]);
const MODEL_NAME = /^[A-Za-z0-9._:/-]{1,160}$/;
const FLOW_ID = /^[A-Za-z0-9_-]{1,120}$/;

function die(message) {
  process.stderr.write("ERROR: " + message + "\n");
  process.exit(1);
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return "";
  const value = args[index + 1];
  if (!value || value.startsWith("--")) die(flag + " needs a value");
  return value;
}

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

function replaceEnv(text, key, value) {
  const lines = text.split(/\r?\n/);
  let replaced = false;
  const output = lines.map((line) => {
    if (!line.startsWith(key + "=")) return line;
    replaced = true;
    return key + "=" + value;
  });
  if (!replaced) output.push(key + "=" + value);
  return output.join("\n").replace(/\n*$/, "\n");
}

function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1);
  }
  return values;
}

function ensureLocalEnv() {
  if (fs.existsSync(LOCAL_ENV_FILE)) return readEnvFile(LOCAL_ENV_FILE);
  let text = fs.readFileSync(TEMPLATE_FILE, "utf8");
  const generated = {
    LANGFLOW_SUPERUSER_PASSWORD: randomHex(24),
    LANGFLOW_SECRET_KEY: randomHex(32),
    LANGFLOW_API_KEY: "sk-" + randomHex(24),
    OPEN_WEBUI_SECRET_KEY: randomHex(32)
  };
  for (const [key, value] of Object.entries(generated)) text = replaceEnv(text, key, value);
  fs.writeFileSync(LOCAL_ENV_FILE, text, { mode: 0o600 });
  try { fs.chmodSync(LOCAL_ENV_FILE, 0o600); } catch { /* Windows ACLs differ. */ }
  process.stdout.write("Created .env.open-source.local with generated local-only secrets.\n");
  return readEnvFile(LOCAL_ENV_FILE);
}

function requireDocker() {
  const check = spawnSync("docker", ["compose", "version"], { cwd: ROOT, stdio: "ignore" });
  if (check.status !== 0) {
    die("Docker with the Compose plugin is required. Install Docker Desktop/Engine, then rerun.");
  }
}

function compose(args, options = {}) {
  const prefix = ["compose", "--env-file", LOCAL_ENV_FILE, "-f", COMPOSE_FILE];
  if (options.reviewed) prefix.push("--profile", "reviewed");
  const run = spawnSync("docker", [...prefix, ...args], { cwd: ROOT, stdio: "inherit" });
  if (run.error) die("Docker failed to start: " + run.error.message);
  if (run.status !== 0) process.exit(run.status || 1);
}

function syncAppEnv(options) {
  const local = options.local;
  const model = options.model;
  const flow = options.flow;
  const reviewed = options.reviewed;
  let text = fs.existsSync(APP_ENV_FILE)
    ? fs.readFileSync(APP_ENV_FILE, "utf8")
    : fs.readFileSync(APP_ENV_EXAMPLE, "utf8");

  const updates = {
    OLLAMA_ENABLED: "true",
    OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    LANGFLOW_ENABLED: "true",
    LANGFLOW_BASE_URL: "http://127.0.0.1:7860",
    LANGFLOW_API_KEY: local.LANGFLOW_API_KEY,
    SONARA_CRAWL4AI_ENABLED: "true",
    SONARA_CRAWL4AI_URL: "http://127.0.0.1:11235",
    SONARA_CRAWL4AI_TIMEOUT_MS: "20000",
    SONARA_OLLAMA_ENABLED: model ? "true" : "false",
    SONARA_OLLAMA_URL: "http://127.0.0.1:11434",
    SONARA_OLLAMA_TIMEOUT_MS: "20000",
    SONARA_OLLAMA_MODEL: model || "",
    SONARA_LANGFLOW_ENABLED: flow ? "true" : "false",
    SONARA_LANGFLOW_URL: "http://127.0.0.1:7860",
    SONARA_LANGFLOW_TIMEOUT_MS: "20000",
    SONARA_LANGFLOW_FLOW: flow || "",
    SONARA_LANGFLOW_KEY: local.LANGFLOW_API_KEY
  };

  if (reviewed) {
    updates.OPEN_WEBUI_ENABLED = "true";
    updates.OPEN_WEBUI_BASE_URL = "http://127.0.0.1:3001";
    updates.SONARA_OPEN_WEBUI_ENABLED = "false";
    updates.SONARA_OPEN_WEBUI_URL = "http://127.0.0.1:3001";
  }

  for (const [key, value] of Object.entries(updates)) text = replaceEnv(text, key, value);
  fs.writeFileSync(APP_ENV_FILE, text, { mode: 0o600 });
  try { fs.chmodSync(APP_ENV_FILE, 0o600); } catch { /* Windows ACLs differ. */ }
  process.stdout.write("Updated .env with local service addresses and SONARA adapter variables.\n");
  if (!model) process.stdout.write("Ollama callable adapter stays off until --model names a reviewed model.\n");
  if (!flow) process.stdout.write("Langflow callable adapter stays off until --langflow-flow names an approved flow.\n");
}

function checkPort(label, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let finished = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      process.stdout.write((ok ? "READY" : "DOWN ") + "  " + label + "  127.0.0.1:" + port + "\n");
      resolve(ok);
    };
    socket.setTimeout(1200);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function status(reviewed) {
  compose(["ps"], { reviewed });
  const checks = [
    checkPort("Ollama", 11434),
    checkPort("Langflow", 7860),
    checkPort("Crawl4AI", 11235)
  ];
  if (reviewed) checks.push(checkPort("Open WebUI", 3001));
  await Promise.all(checks);
}

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) || "status";
const reviewed = args.includes("--reviewed");
const writeAppEnv = args.includes("--write-app-env");
const model = valueAfter(args, "--model");
const flow = valueAfter(args, "--langflow-flow");

if (model && !MODEL_NAME.test(model)) die("--model contains unsafe characters.");
if (flow && !FLOW_ID.test(flow)) die("--langflow-flow must contain only letters, numbers, dashes or underscores.");

const local = ensureLocalEnv();

if (command === "init") {
  process.stdout.write("Open-source local environment initialized. No service was started.\n");
  process.exit(0);
}

requireDocker();
const services = [...CORE_SERVICES, ...(reviewed ? REVIEWED_SERVICES : [])];

if (command === "pull") {
  compose(["pull", ...services], { reviewed });
} else if (command === "up") {
  compose(["pull", ...services], { reviewed });
  compose(["up", "-d", ...services], { reviewed });

  if (model) {
    process.stdout.write("Pulling the explicitly selected Ollama model. Review its own licence before commercial use.\n");
    compose(["exec", "-T", "ollama", "ollama", "pull", model], { reviewed });
  }
  if (writeAppEnv) syncAppEnv({ local, model, flow, reviewed });
  await status(reviewed);
} else if (command === "status") {
  await status(reviewed);
} else if (command === "down") {
  compose(["down", "--remove-orphans"], { reviewed });
} else {
  die('Unknown command "' + command + '". Use init, pull, up, status or down.');
}

process.stdout.write(
  "\nSeparately managed by design: n8n, Dify, RAGFlow, whisper.cpp and voice clone. " +
  "See docs/owner/OPEN-SOURCE-LOCAL-STACK.md before enabling them.\n"
);
