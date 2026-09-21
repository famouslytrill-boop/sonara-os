# Codex terminal bootstrap

Run from the repository root.

Windows:
```powershell
.\tools\codex-terminal\bootstrap.ps1 -Execute
```

macOS/Linux:
```bash
bash tools/codex-terminal/bootstrap.sh --execute
```

Add `-Repos` / `--repos` to clone reviewed candidate sources to
`~/.sonara/external` at immutable resolved SHAs. The bootstrap never executes
third-party repository setup scripts or activates a provider/model in production.

List registered models:
```bash
python tools/codex-terminal/download-model.py --list
```

Download one reviewed model explicitly:
```bash
python tools/codex-terminal/download-model.py --model MODEL_ID --execute
```

Repository `AGENTS.md`, the maintained open-source registry, owner approval,
tenant/security gates and Provider Gateway remain authoritative.
