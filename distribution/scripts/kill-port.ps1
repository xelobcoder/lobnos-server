param (
    [int]$Port = 0
)

if ($Port -eq 0) {
    # Try to load from .env file in current directory
    $envFile = Join-Path $PSScriptRoot "..\.env"
    if (Test-Path $envFile) {
        $content = Get-Content $envFile
        $devPort = $content | Select-String "DEVELOPMENT_PORT=(\d+)" | ForEach-Object { $_.Matches.Groups[1].Value }
        if ($devPort) {
            $Port = [int]$devPort
        } else {
            $portVal = $content | Select-String "PORT=(\d+)" | ForEach-Object { $_.Matches.Groups[1].Value }
            if ($portVal) {
                $Port = [int]$portVal
            }
        }
    }
}

if ($Port -eq 0) {
    $Port = 2399 # Default fallback
}

# Check for administrative privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# Determine if we should attempt elevation
$isInteractive = [Environment]::UserInteractive
$silent = $MyInvocation.BoundParameters.ContainsKey('Silent') -or ($args -contains "-Silent")

if (-not $isAdmin -and $isInteractive -and -not $silent) {
    Write-Host "Requesting administrative privileges to kill process on port $Port..." -ForegroundColor Cyan
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port -Silent"
    try {
        Start-Process powershell.exe -ArgumentList $arguments -Verb RunAs -Wait
    } catch {
        Write-Host "Warning: Failed to elevate privileges: $($_.Exception.Message). Attempting to proceed without elevation..." -ForegroundColor Yellow
    }
    if ($isInteractive) { exit 0 }
}

Write-Host "Searching for processes using port $Port..." -ForegroundColor Cyan

# Find processes using the port
$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connections) {
    # Group by PID to handle cases where one process listens on multiple addresses
    $groupedConnections = $connections | Group-Object OwningProcess
    
    foreach ($group in $groupedConnections) {
        $processId = $group.Name
        
        # Skip System and Idle processes
        if ($processId -eq 0 -or $processId -eq 4) {
            Write-Host "Skipping System/Idle process (PID: $processId) on port $Port" -ForegroundColor Gray
            continue
        }

        $addresses = $group.Group.LocalAddress | Sort-Object -Unique
        $addressStr = $addresses -join ", "
        
        try {
            $procObj = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if (-not $procObj) {
                Write-Host "Process PID $processId already exited." -ForegroundColor Gray
                continue
            }

            Write-Host "Terminating process: $($procObj.Name) (PID: $processId) on port $Port" -ForegroundColor Yellow
            Write-Host "Listening on addresses: $addressStr" -ForegroundColor Gray

            # Try to see if this process is associated with a service
            $service = Get-WmiObject -Class Win32_Service -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
            if (-not $service) {
                # Sometimes the process is a child of a service (like NSSM)
                try {
                    $parent = $procObj.Parent
                    if (-not $parent) {
                        # Fallback for older PowerShell versions
                        $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId = $processId").ParentProcessId
                        if ($parentPid) { $parent = Get-Process -Id $parentPid -ErrorAction SilentlyContinue }
                    }

                    if ($parent) {
                        $parentPid = $parent.Id
                        $service = Get-WmiObject -Class Win32_Service -Filter "ProcessId = $parentPid" -ErrorAction SilentlyContinue
                        if ($service) {
                            Write-Host "Process is a child of service: $($service.Name) (Parent PID: $parentPid)" -ForegroundColor Cyan
                        } elseif ($parent.Name -eq "nssm") {
                            Write-Host "Process is managed by NSSM (PID: $parentPid). This is likely a service." -ForegroundColor Cyan
                        }
                    }
                } catch {}
            }
            
            if ($service) {
                Write-Host "Process belongs to service: $($service.Name). Force-stopping service..." -ForegroundColor Cyan
                Stop-Service -Name $service.Name -Force -ErrorAction SilentlyContinue
                cmd /c "sc stop $($service.Name)"
                cmd /c "net stop $($service.Name) /y"
                Start-Sleep -Seconds 2
            }
            
            # Identify the target PID to kill (parent if it's a managed process)
            $targetPid = $processId
            try {
                $parent = $procObj.Parent
                if (-not $parent) {
                    $ppid = (Get-CimInstance Win32_Process -Filter "ProcessId = $processId").ParentProcessId
                    if ($ppid) { $parent = Get-Process -Id $ppid -ErrorAction SilentlyContinue }
                }

                if ($parent -and $parent.Id -gt 100 -and $parent.Name -ne "explorer" -and $parent.Name -ne "services" -and $parent.Name -ne "wininit") {
                    Write-Host "Found parent process: $($parent.Name) (PID: $($parent.Id)). Killing parent and all children..." -ForegroundColor Gray
                    $targetPid = $parent.Id
                }
            } catch {}

            $taskkillArgs = @("/F", "/T", "/PID", $targetPid)
            Write-Host "Running: taskkill /F /T /PID $targetPid" -ForegroundColor Gray
            
            # Use Start-Process with RunAs if we are not admin, otherwise just run it
            if (-not $isAdmin -and $isInteractive -and -not $silent) {
                try {
                    Start-Process taskkill.exe -ArgumentList $taskkillArgs -Verb RunAs -Wait
                } catch {
                    & taskkill.exe /F /T /PID $targetPid 2>&1 | Out-Null
                }
            } else {
                # In non-interactive or silent mode, just try to run it directly
                # If we are already admin (like in a service context), this will work
                & taskkill.exe /F /T /PID $targetPid 2>&1 | Out-Null
            }
            
            # Verify if it's still there
            Start-Sleep -Milliseconds 800
            if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
                Write-Host "Warning: PID $processId still exists. Attempting direct Stop-Process..." -ForegroundColor Yellow
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            } else {
                Write-Host "Successfully terminated PID $targetPid and its children" -ForegroundColor Green
            }
        }
        catch {
            $errMessage = $_.Exception.Message
            Write-Host "Warning: Could not terminate PID $processId." -ForegroundColor Red
            if ($errMessage -like "*Access is denied*") {
                Write-Host "Access Denied: This process is protected. Run as Administrator." -ForegroundColor Yellow
            } else {
                Write-Host "Error: $errMessage" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "No active processes found on port $Port." -ForegroundColor Gray
}
