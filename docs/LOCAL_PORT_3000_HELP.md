# Local Port 3000 Help

`EADDRINUSE` means something is already listening on the port. It is not a build failure.

Check what is using port 3000:

```powershell
netstat -ano | findstr :3000
```

Kill a process:

```powershell
taskkill /PID <PID> /F
```

Start the production server on port 3001:

```powershell
$env:PORT=3001; npm run start
```

Open:

```text
http://localhost:3000
http://localhost:3001
```
