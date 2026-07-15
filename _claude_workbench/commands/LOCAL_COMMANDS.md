# Local Commands

Run from repo root:

```powershell
cd C:\Users\AXPAY\famouslytrill-project
```

## Check branch/remotes

```powershell
git status
git remote -v
git branch --show-current
git log --oneline -5
```

## Install and verify

```powershell
npm install
npm run build
npm test
npm run scan:client-secrets
npm run lint
npm run verify:launch
git diff --check
```

## Commit

```powershell
git status
git add .
git commit -m "Upgrade SONARA software-in-a-service app shell and workflows"
git push github main
```

## If push is rejected

```powershell
git fetch github
git pull github main --rebase
npm run build
npm test
npm run scan:client-secrets
npm run lint
npm run verify:launch
git push github main
```

Do not run `npm audit fix --force`.
