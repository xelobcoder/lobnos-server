# Prime Laboratory Software Runtime (Windows Service) Installation Guide

This guide explains how to run the PLS backend as a Windows Service so it:
- Starts automatically when the PC boots
- Keeps running in the background (no terminal window to close)
- Waits/retries until the database is available

## Prerequisites
- Windows 10/11 or Windows Server
- Node.js installed
- The backend folder contains built output: `dist/src/start.js`
- `.env` file is present in the project root (same folder as `package.json`)

## Service Name
- ServiceName (internal): `PrimeLabSystemRuntime`
- DisplayName: `Prime Lab System Runtime`

## Backup Scheduler Service Name
- ServiceName (internal): `bkspls`
- DisplayName: `Prime Lab Backup Scheduler`

## 1) Install NSSM (one-time)
Run in PowerShell:

```powershell
npm run service:prereq:win
```

## 2) Install and start the service
Run:

```powershell
npm run start
```

## 3) Check service status

```powershell
npm run service:status:win
```

## 4) Restart / stop the service

```powershell
npm run service:restart:win
npm run service:stop:win
```

## 5) Uninstall the service

```powershell
npm run service:uninstall:win
```

## Troubleshooting
### Service installs but does not start
- Confirm `dist/src/start.js` exists.
- Confirm `.env` is present and contains the correct DB credentials.

### Database not ready (startup retries)
- If MySQL starts late after a power outage, the service will keep retrying until it can connect.

