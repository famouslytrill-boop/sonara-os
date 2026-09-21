#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, os, pathlib, subprocess, venv
HERE=pathlib.Path(__file__).resolve().parent
DATA=json.loads((HERE/"models.json").read_text(encoding="utf-8"))
MODELS={m["id"]:m for m in DATA["models"]}
p=argparse.ArgumentParser()
p.add_argument("--list",action="store_true")
p.add_argument("--model")
p.add_argument("--execute",action="store_true")
p.add_argument("--allow-review-status",action="store_true")
a=p.parse_args()
if a.list:
    for m in DATA["models"]: print(f'{m["id"]:<60} {m["status"]:<22} {m["license"]}')
    raise SystemExit(0)
if not a.model: p.error("Use --list or --model MODEL_ID.")
m=MODELS.get(a.model)
if not m: raise SystemExit("Model is not in the governed manifest.")
blocked={"license-review","terms-review","custom-license-review"}
if m["status"] in blocked and not a.allow_review_status:
    raise SystemExit(f'{a.model}: {m["status"]}; review/accept current model terms first.')
root=pathlib.Path(os.path.expanduser(DATA["policy"]["modelRoot"]))
target=root/a.model.replace("/","__")
print(f'Model: {a.model}\nLicense: {m["license"]}\nStatus: {m["status"]}\nTarget: {target}')
if not a.execute:
    print("PLAN ONLY: add --execute to download."); raise SystemExit(0)
venv_dir=pathlib.Path.home()/".sonara"/"toolchains"/"huggingface"/".venv"
if not venv_dir.exists(): venv.create(venv_dir,with_pip=True)
if os.name=="nt":
    py=venv_dir/"Scripts"/"python.exe"; hf=venv_dir/"Scripts"/"hf.exe"
else:
    py=venv_dir/"bin"/"python"; hf=venv_dir/"bin"/"hf"
subprocess.check_call([str(py),"-m","pip","install","--upgrade","huggingface_hub"])
target.mkdir(parents=True,exist_ok=True)
subprocess.check_call([str(hf),"download",a.model,"--local-dir",str(target)])
print("Downloaded only; not activated in SONARA production.")
