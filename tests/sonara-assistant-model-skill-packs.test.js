// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url"),{spawnSync}=require("node:child_process");
const script=path.join(__dirname,"../scripts/export-assistant-model-skill-packs.mjs");
let api;
describe("Model skill packages are complete offline snapshots",function(){
 before(async()=>{api=await import(pathToFileURL(script).href);});
 it("provides 16 skills for each target and includes formula implementation evidence",function(){
  const p=api.plan();
  assert.equal(p.manifest.targets.claude.skills,16);
  assert.equal(p.manifest.targets.openai.skills,16);
  assert.equal(p.manifest.uploaded,false);
  assert.equal(p.manifest.globalMemoryModified,false);
  for(const t of ["claude","openai"]){
   assert.match(p.files.get(t+"/skills/sonara-formula-evidence/SKILL.md"),/Portable package boundary/);
   assert.match(p.files.get(t+"/skills/sonara-formula-evidence/references/repository/lib/sonara-formula-engine.cjs"),/HANDLERS/);
   assert.ok(p.files.has(t+"/skills/checks-that-cannot-lie/SKILL.md"));
  }
 });
 it("includes all indexed quantitative modules and formula SQL references",function(){
  const paths=api.formulaPaths(),p=api.plan();
  assert.ok(paths.length>=24);
  assert.equal(paths.filter(x=>x.startsWith("lib/")).length,Number(/Other formula and quantitative source modules \((\d+)\)/.exec(require("node:fs").readFileSync(path.join(__dirname,"../.ai/shared/ASSISTANT_KNOWLEDGE_INDEX.md"),"utf8"))[1]));
  assert.ok(paths.includes("lib/sonara-inventory-science.cjs"));
  for(const source of paths){
   for(const target of ["claude","openai"])
    assert.ok(p.files.has(target+"/skills/sonara-formula-evidence/references/repository/"+source),source);
  }
 });
 it("rejects malformed skill metadata",function(){
  assert.throws(()=>api.metadata("bad","no frontmatter"),/missing_frontmatter/);
  assert.throws(()=>api.metadata("bad","---\nname: bad_name\ndescription: wrong\n---"),/invalid_skill_metadata/);
 });
 it("manifests record hashes and precise byte lengths",function(){
  const {createHash}=require("node:crypto"),p=api.plan();
  for(const f of p.manifest.files){
   const content=p.files.get(f.path);
   assert.equal(f.sha256,createHash("sha256").update(content,"utf8").digest("hex"));
   assert.equal(f.bytes,Buffer.byteLength(content,"utf8"));
  }
 });
 it("dry-run performs no provider uploads",function(){
  const p=spawnSync(process.execPath,[script,"--dry-run"],{encoding:"utf8",cwd:path.join(__dirname,"..")});
  assert.equal(p.status,0,p.stderr||p.stdout);
  assert.equal(JSON.parse(p.stdout).uploaded,false);
 });
});