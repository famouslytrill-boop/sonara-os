#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import venv

HERE = pathlib.Path(__file__).resolve().parent
BLOCKED = {"license-review", "terms-review", "custom-license-review"}


def load_manifest():
    return json.loads((HERE / "models.json").read_text(encoding="utf-8"))


def build_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--model")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--allow-review-status", action="store_true")
    return parser


def main(argv=None):
    data = load_manifest()
    models = {model["id"]: model for model in data["models"]}
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.list:
        for model in data["models"]:
            print(f'{model["id"]:<60} {model["status"]:<22} {model["license"]}')
        return 0

    if not args.model:
        parser.error("Use --list or --model MODEL_ID.")

    model = models.get(args.model)
    if not model:
        raise SystemExit("Model is not in the governed manifest.")
    if model["status"] in BLOCKED and not args.allow_review_status:
        raise SystemExit(
            f'{args.model}: {model["status"]}; review/accept current model terms first.'
        )

    root = pathlib.Path(os.path.expanduser(data["policy"]["modelRoot"]))
    target = root / args.model.replace("/", "__")
    print(
        f'Model: {args.model}\nLicense: {model["license"]}\n'
        f'Status: {model["status"]}\nTarget: {target}'
    )
    if not args.execute:
        print("PLAN ONLY: add --execute to download.")
        return 0

    venv_dir = pathlib.Path.home() / ".sonara" / "toolchains" / "huggingface" / ".venv"
    if not venv_dir.exists():
        venv.create(venv_dir, with_pip=True)
    if os.name == "nt":
        python = venv_dir / "Scripts" / "python.exe"
        hf = venv_dir / "Scripts" / "hf.exe"
    else:
        python = venv_dir / "bin" / "python"
        hf = venv_dir / "bin" / "hf"

    subprocess.check_call([str(python), "-m", "pip", "install", "--upgrade", "huggingface_hub"])
    target.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([str(hf), "download", args.model, "--local-dir", str(target)])
    print("Downloaded only; not activated in SONARA production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
