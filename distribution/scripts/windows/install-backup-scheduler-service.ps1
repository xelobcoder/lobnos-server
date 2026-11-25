param(
     [string]$ServiceName = "bkspls",
     [string]$DisplayName = "bkspls",
     [string]$Description = "bkspls backup scheduler service",
     [switch]$BuildBeforeInstall,
     [switch]$StartNow,
     [string]$NodePath,
     [string]$NssmPath
)

$ErrorActionPreference = "Stop"
$ServiceName = $ServiceName.Trim().Trim("'").Trim('"')
$DisplayName = $DisplayName.Trim().Trim("'").Trim('"')
$Description = $Description.Trim().Trim("'").Trim('"')

function Test-IsAdministrator {
     $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
     $principal = New-Object Security.Principal.WindowsPrincipal($identity)
     return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
     $argList = @(
          "-ExecutionPolicy", "Bypass",
          "-File", "`"$PSCommandPath`"",
          "-ServiceName", "`"$ServiceName`"",
          "-DisplayName", "`"$DisplayName`"",
          "-Description", "`"$Description`""
     )

     if ($BuildBeforeInstall) { $argList += "-BuildBeforeInstall" }
     if ($StartNow) { $argList += "-StartNow" }
     if (-not [string]::IsNullOrWhiteSpace($NodePath)) {
          $argList += @("-NodePath", "`"$NodePath`"")
     }

     try {
          Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs | Out-Null
          Write-Host "Elevation requested. Approve the UAC prompt to continue backup scheduler service installation."
          exit 0
     }
     catch {
          throw "Administrator rights are required to create a Windows service. Re-run in an elevated PowerShell or approve the UAC prompt."
     }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\")).Path
$runtimeEntry = Join-Path $repoRoot "dist\src\start.js"
$schedulerEntry = Join-Path $repoRoot "dist\src\scripts\backup-scheduler.js"

if ($BuildBeforeInstall) {
     Write-Host "Building TypeScript..."
     Push-Location $repoRoot
     try {
          npm run build | Out-Host
     }
     finally {
          Pop-Location
     }

     if (-not (Test-Path $runtimeEntry)) {
          throw "Build completed but '$runtimeEntry' was not found."
     }
}

if (-not (Test-Path $runtimeEntry)) {
     throw "Build output not found at '$runtimeEntry'. Run npm run build first, or use -BuildBeforeInstall."
}

if (-not (Test-Path $schedulerEntry)) {
     throw "Scheduler entry script not found at '$schedulerEntry'."
}

if ([string]::IsNullOrWhiteSpace($NodePath)) {
     $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
     if (-not $nodeCommand) {
          throw "Node.js was not found in PATH. Install Node.js or provide -NodePath."
     }
     $NodePath = $nodeCommand.Source
}

if ([string]::IsNullOrWhiteSpace($NssmPath)) {
     $nssmCommand = Get-Command nssm -ErrorAction SilentlyContinue
     if ($nssmCommand) {
          $NssmPath = $nssmCommand.Source
     }
}

if ([string]::IsNullOrWhiteSpace($NssmPath)) {
     $localNssm = Join-Path $repoRoot "scripts\windows\tools\nssm.exe"
     if (Test-Path $localNssm) {
          $NssmPath = $localNssm
     }
}

if ([string]::IsNullOrWhiteSpace($NssmPath) -or -not (Test-Path $NssmPath)) {
     throw "NSSM was not found. Install NSSM (nssm.exe) and add it to PATH, then re-run."
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
     throw "Service '$ServiceName' already exists. Use npm run service:backup:uninstall:win first if you want to recreate it."
}

$logsDir = Join-Path $repoRoot "logs"
if (-not (Test-Path $logsDir)) {
     New-Item -ItemType Directory -Path $logsDir | Out-Null
}

$serviceStdOut = Join-Path $logsDir "backup-scheduler-service-out.log"
$serviceStdErr = Join-Path $logsDir "backup-scheduler-service-error.log"

& $NssmPath install $ServiceName $NodePath "--env-file=.env" ".\\dist\\src\\scripts\\backup-scheduler.js" "start" | Out-Null
& $NssmPath set $ServiceName AppDirectory $repoRoot | Out-Null
& $NssmPath set $ServiceName DisplayName $DisplayName | Out-Null
& $NssmPath set $ServiceName Description $Description | Out-Null
& $NssmPath set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $NssmPath set $ServiceName AppStdout $serviceStdOut | Out-Null
& $NssmPath set $ServiceName AppStderr $serviceStdErr | Out-Null
& $NssmPath set $ServiceName AppRotateFiles 1 | Out-Null
& $NssmPath set $ServiceName AppRotateOnline 1 | Out-Null

sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null

if ($StartNow) {
     Start-Service -Name $ServiceName
     Write-Host "Backup scheduler service '$ServiceName' installed and started."
}
else {
     Write-Host "Backup scheduler service '$ServiceName' installed. Start with: Start-Service -Name $ServiceName"
}

Write-Host "Done."
