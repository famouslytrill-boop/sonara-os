// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Offline export. No network requests, provider keys, skill execution or API uploads.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"output","assistant-model-packs");
const policy=["AGENTS.md",".ai/shared/PROJECT_MEMORY.md",".ai/shared/ASSISTANT_KNOWLEDGE_INDEX.md"];
const maths=["lib/sonara-formula-library.cjs","lib/sonara-industry-algorithm-expansion.cjs","lib/sonara-formula-engine.cjs","lib/sonara-financial-intelligence-formulas.cjs","docs/sonara-formula-table-library.md"];
const shared=[
 {name:"sonara-external-tool-intake",source:".ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md",description:"Review and verify external tools, licenses, security, provenance and adoption decisions for SONARA."},
 {name:"sonara-source-grounding",source:".ai/shared/SOURCE_GROUNDED_RESEARCH_SKILL.md",description:"Ground technical and market research in verified primary sources, contradiction checks and uncertainty."}
];
function read(p){
 if(!/^[A-Za-z0-9._/-]+$/.test(p)||p.startsWith("/")||p.split("/").includes(".."))throw Error("unsafe_path "+p);
 const full=path.join(ROOT,p),stat=fs.lstatSync(full);
 if(!stat.isFile()||stat.isSymbolicLink())throw Error("non_file "+p);
 return fs.readFileSync(full,"utf8");
}
function metadata(p,s){
 const m=/^---\r?\n([\s\S]*?)\r?\n---/.exec(s);
 if(!m)throw Error("missing_frontmatter "+p);
 const name=/^name:\s*([a-z][a-z0-9-]*)\s*$/m.exec(m[1])?.[1];
 const description=/^description:\s*(.+)$/m.exec(m[1])?.[1]?.trim();
 if(!name||!description||description.length>900)throw Error("invalid_skill_metadata "+p);
 return {name,description};
}
function header(name,description){return "---\nname: "+name+"\ndescription: "+description+"\n---\n\n";}
function portable(source){
 const match=/^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(source);
 if(!match)throw Error("missing_frontmatter");
 const note="\n## Portable package boundary\n\nThis offline package includes repository policies and knowledge pointers in references/repository. Other repository paths below might not be included. Read their authoritative files through permitted repository access; never infer missing code, license, live status or execution permission from this snapshot.\n\n";
 return match[0]+note+source.slice(match[0].length);
}
function plan(){
 const entries=fs.readdirSync(path.join(ROOT,".claude","skills"),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
 if(entries.length<12)throw Error("too_few_canonical_skills");
 const skills=entries.map(dir=>{
  const source=".claude/skills/"+dir+"/SKILL.md",raw=read(source),m=metadata(source,raw);
  if(m.name!==dir)throw Error("skill_directory_mismatch "+dir);
  return {name:m.name,body:portable(raw)};
 });
 for(const x of shared)skills.push({name:x.name,body:header(x.name,x.description)+"# SONARA shared procedure\n\nSource: "+x.source+". Full original procedure follows.\n\n"+read(x.source)});
 const formula=".agents/skills/sonara-formula-evidence/SKILL.md",f=read(formula);
 skills.push({name:metadata(formula,f).name,body:portable(f)});
 if(skills.length!==15||new Set(skills.map(x=>x.name)).size!==15)throw Error("unexpected_skill_inventory");
 const files=new Map(),targets={};
 for(const target of ["claude","openai"]){
  for(const skill of skills){
   const dir=target+"/skills/"+skill.name+"/";
   files.set(dir+"SKILL.md",skill.body);
   for(const p of policy)files.set(dir+"references/repository/"+p,read(p));
   if(skill.name==="sonara-formula-evidence")for(const p of maths)files.set(dir+"references/repository/"+p,read(p));
  }
  targets[target]={skills:skills.length};
 }
 const records=[...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,data])=>({
  path:name,sha256:createHash("sha256").update(data,"utf8").digest("hex"),
  bytes:Buffer.byteLength(data,"utf8")
 }));
 const manifest={schema_version:1,status:"offline_review_only",targets,uploaded:false,globalMemoryModified:false,files:records};
 files.set("manifest.json",JSON.stringify(manifest,null,2)+"\n");
 return {files,manifest};
}
function main(){
 const args=process.argv.slice(2),write=args.length===1&&args[0]==="--write";
 if(!(write||args.length===1&&args[0]==="--dry-run"))throw Error("Specify --write or --dry-run");
 const result=plan();
 if(write)for(const [p,data] of result.files){
   const dest=path.join(OUT,p);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,data,"utf8");
 }
 console.log(JSON.stringify({action:write?"local_files_written":"dry_run_only",targets:result.manifest.targets,files:result.manifest.files.length,uploaded:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
export {metadata,plan};
