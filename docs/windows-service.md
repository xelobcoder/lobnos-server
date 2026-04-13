# Running Lobnos Server as a Windows Service

Yes, this app can run in the background as a real Windows Service.

## What was added

- scripts/windows/install-service.ps1
- scripts/windows/uninstall-service.ps1
- scripts/windows/service-control.ps1
- npm scripts in package.json for install/start/stop/status/uninstall

## One-time prerequisites

1. Install Node.js and ensure `node` is available in PATH.
2. Ensure `.env` exists in the repository root.
3. Install NSSM (`nssm.exe`) and ensure it is available in PATH.
4. You need administrator rights to create/remove/control services.

Install NSSM using the project bootstrap script:

```powershell
npm run service:prereq:win
```

The bootstrap tries, in order:

- winget
- Chocolatey
- Scoop
- direct download into `scripts/windows/tools/nssm.exe`

The service install and uninstall scripts automatically detect both PATH and the local fallback copy.

## Install and start service

From repository root:

```powershell
npm run service:install:win
```

If your terminal is not elevated, the installer now requests elevation via UAC automatically.
Approve the prompt to continue.

This command:

- builds TypeScript output
- installs service name `LobnosServer`
- sets startup to Automatic
- starts the service immediately
- configures restart on failure
- writes service logs to `logs/lobnos-service-out.log` and `logs/lobnos-service-error.log`

Why NSSM is required:

- A plain `New-Service` command that points to `node app.js` is not a true Windows service process.
- Windows Service Control Manager waits for service handshake and times out (Event IDs 7009/7000).
- NSSM wraps Node correctly so the app can run as a managed Windows service.

## Manage service

```powershell
npm run service:status:win
npm run service:stop:win
npm run service:start:win
npm run service:restart:win
npm run service:uninstall:win
```

If your terminal is not elevated, start/stop/restart commands request UAC automatically.

## Optional custom install

You can run installer directly if you want custom service name:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/windows/install-service.ps1 -ServiceName "LobnosServerProd" -DisplayName "Lobnos Server Prod" -BuildBeforeInstall -StartNow
```

## Notes

- The service runs `node --env-file=.env .\\dist\\src\\app.js` from repo root.
- If you update TypeScript source, run `npm run build` and restart service.
- The development watch tasks (`npm run dev`, `npx tsc --w`) are not needed for service mode.
