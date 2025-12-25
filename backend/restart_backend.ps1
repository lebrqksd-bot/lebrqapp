# Restart LeBRQ Backend Server
# This script kills the existing backend process and restarts it

Write-Host "🔄 Restarting LeBRQ Backend Server..." -ForegroundColor Yellow
Write-Host ""

# Find and kill existing backend processes
$processes = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*uvicorn*" -or $_.CommandLine -like "*app.core*"
}

if ($processes) {
    Write-Host "Stopping existing backend processes..." -ForegroundColor Yellow
    foreach ($proc in $processes) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Stopped process $($proc.Id)" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  Could not stop process $($proc.Id)" -ForegroundColor Red
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "No existing backend processes found." -ForegroundColor Cyan
}

# Wait a moment for ports to be released
Write-Host ""
Write-Host "Waiting for ports to be released..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Check if port 8000 is still in use
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  Port 8000 is still in use. Trying to kill processes using it..." -ForegroundColor Yellow
    $portProcesses = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $portProcesses) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Stopped process $pid using port 8000" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  Could not stop process $pid" -ForegroundColor Red
        }
    }
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "🚀 Starting backend server..." -ForegroundColor Green
Write-Host ""

# Change to backend directory
Set-Location $PSScriptRoot

# Check if virtual environment exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "✓ Activating virtual environment..." -ForegroundColor Green
    & "venv\Scripts\Activate.ps1"
} else {
    Write-Host "⚠️  No virtual environment found. Using global Python..." -ForegroundColor Yellow
}

# Start the server
Write-Host "Starting uvicorn..." -ForegroundColor Green
Write-Host "Backend will run on: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "API endpoints:https://taxtower.in:8002/api
" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python -m uvicorn app.core:app --reload --host 127.0.0.1 --port 8000

