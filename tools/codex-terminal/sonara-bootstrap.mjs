#!/usr/bin/env node
"use strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = new Set(process.argv.slice(2));
const execute = argv.has("--execute");
const withRepos = argv.has("--repos") || argv.has("--all");
const skipVerify = argv.has("--skip-verify");
const repoRoot = process.cwd();
const toolDir = fileURLToPath(new URL(".", import.meta.url));

function die(message){ console.error("[sonara-bootstrap] " + message); process.exit(1); }
function check(command,args=["--version"]){
  const r=spawnSync(command,args,{encoding:"utf8",shell:false});
  if(r.status!==0) die("Missing required command: "+command);
  console.log("[preflight] "+command+": "+String(r.stdout||r.stderr||"").trim().split("\n")[0]);
}
function run(command,args,cwd=repoRoot,capture=false){
  console.log((execute?"RUN: ":"PLAN: ")+[command,...args].join(" "));
  if(!execute) return "";
  const r=spawnSync(command,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false,env:process.env});
  if(r.status!==0){ if(capture){process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");} die(command+" failed"); }
  return capture?String(r.stdout||"").trim():"";
}

if(!existsSync(join(repoRoot,"package.json"))) die("Run from the sonara-os repository root.");
const pkg=JSON.parse(readFileSync(join(repoRoot,"package.json"),"utf8"));
if(pkg.name!=="sonara-os") die("Expected package name sonara-os.");
check("git"); check("node"); check("corepack");

run("corepack",["enable"]);
run("corepack",["prepare","pnpm@11.1.1","--activate"]);
run("pnpm",["install","--frozen-lockfile"]);
run("pnpm",["audit","--audit-level","moderate"]);
if(!skipVerify) run("pnpm",["run","verify:launch"]);

if(withRepos){
  const manifest=JSON.parse(readFileSync(join(toolDir,"repositories.json"),"utf8"));
  const allowed=new Set(["review-install","developer-tool","model-runtime","optional-worker","optional-service"]);
  const base=join(homedir(),".sonara","external");
  const lockDir=join(homedir(),".sonara","locks","sonara-os");
  if(execute){mkdirSync(base,{recursive:true});mkdirSync(lockDir,{recursive:true});}
  const lock={generatedAt:new Date().toISOString(),repositories:[]};
  for(const item of manifest.repositories){
    if(!allowed.has(item.lane)){ console.log("SKIP: "+item.repo+" lane="+item.lane); continue; }
    const target=join(base,item.id);
    console.log("\n[repo] "+item.repo+" -> "+target+" | "+item.lane+" | "+item.license);
    if(!execute) continue;
    const ls=spawnSync("git",["ls-remote",item.url,"HEAD"],{encoding:"utf8",shell:false});
    if(ls.status!==0) die("Could not resolve "+item.repo);
    const sha=String(ls.stdout).trim().split(/\s+/)[0];
    if(!/^[0-9a-f]{40}$/i.test(sha)) die("Invalid SHA for "+item.repo);
    if(!existsSync(join(target,".git"))) run("git",["clone","--filter=blob:none","--no-checkout",item.url,target]);
    else run("git",["-C",target,"remote","set-url","origin",item.url]);
    run("git",["-C",target,"fetch","--depth","1","origin",sha]);
    run("git",["-C",target,"checkout","--detach",sha]);
    lock.repositories.push({repo:item.repo,sha,path:target,lane:item.lane,productionEnabled:false});
  }
  if(execute){
    const p=join(lockDir,"repositories.lock.json");
    writeFileSync(p,JSON.stringify(lock,null,2)+"\n","utf8");
    console.log("Wrote "+p);
  }
}
console.log(execute
  ?"Bootstrap complete. External source remains isolated and production-disabled."
  :"Plan only. Add --execute; add --repos to clone reviewed candidate sources.");
