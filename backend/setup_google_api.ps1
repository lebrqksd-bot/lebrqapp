# Google Places API Setup Script for Windows PowerShell
# Run this after getting your API key from Google Cloud Console

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Google Places API Setup for Lebrq Booking System      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if API key is provided as argument
$apiKey = $args[0]

if (-not $apiKey) {
    Write-Host "❌ No API key provided!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\setup_google_api.ps1 YOUR_API_KEY_HERE" -ForegroundColor White
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  .\setup_google_api.ps1 AIzaSyXXXXXXXXXXXXXXXXXX" -ForegroundColor White
    Write-Host ""
    Write-Host "To get an API key:" -ForegroundColor Cyan
    Write-Host "  1. Go to: https://console.cloud.google.com/" -ForegroundColor White
    Write-Host "  2. Create a project" -ForegroundColor White
    Write-Host "  3. Enable 'Places API (New)' and 'Distance Matrix API'" -ForegroundColor White
    Write-Host "  4. Create credentials → API Key" -ForegroundColor White
    Write-Host "  5. Copy the key and run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "🔑 API Key received: $($apiKey.Substring(0, 15))..." -ForegroundColor Green
Write-Host ""

# Create or update .env file
$envFile = ".env"
$envContent = ""

if (Test-Path $envFile) {
    Write-Host "📝 Found existing .env file, updating..." -ForegroundColor Yellow
    $envContent = Get-Content $envFile -Raw
    
    # Remove old GOOGLE_PLACES_API_KEY if exists
    $envContent = $envContent -replace "GOOGLE_PLACES_API_KEY=.*`n", ""
    $envContent = $envContent -replace "USE_MOCK_LOCATION_DATA=.*`n", ""
} else {
    Write-Host "📝 Creating new .env file..." -ForegroundColor Yellow
    $envContent = @"
# Database Configuration
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DB=lebrq

# App Configuration
APP_NAME=Lebrq API
API_PREFIX=/api
SECRET_KEY=change-me-please
ACCESS_TOKEN_EXPIRE_MINUTES=720
LOCAL_TIMEZONE=Asia/Kolkata

"@
}

# Add Google Places API configuration
$envContent += @"

# Google Places API Configuration
GOOGLE_PLACES_API_KEY=$apiKey
USE_MOCK_LOCATION_DATA=false

"@

# Write to .env file
Set-Content -Path $envFile -Value $envContent

Write-Host "✅ .env file updated successfully!" -ForegroundColor Green
Write-Host ""

# Display current configuration
Write-Host "📋 Current Configuration:" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  API Key: $($apiKey.Substring(0, 15))...****" -ForegroundColor White
Write-Host "  Mock Mode: Disabled" -ForegroundColor White
Write-Host "  .env Location: $(Get-Location)\$envFile" -ForegroundColor White
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Test if backend server is running
$serverRunning = $false
try {
    $response = Invoke-WebRequest -Uri "https://taxtower.in:8002/api
/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $serverRunning = $true
    }
} catch {
    # Server not running
}

if ($serverRunning) {
    Write-Host "⚠️  Backend server is running!" -ForegroundColor Yellow
    Write-Host "   You need to restart it for changes to take effect." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   To restart:" -ForegroundColor Cyan
    Write-Host "   1. Press Ctrl+C in the backend terminal" -ForegroundColor White
    Write-Host "   2. Run: python -m uvicorn app.core:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "🚀 Starting backend server..." -ForegroundColor Green
    Write-Host ""
    Write-Host "Running: python -m uvicorn app.core:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
    Write-Host ""
    
    # Start the backend server
    python -m uvicorn app.core:app --reload --host 0.0.0.0 --port 8000
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                     Setup Complete! ✨                     ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Refresh your browser" -ForegroundColor White
Write-Host "  2. Go to Grant Hall booking page" -ForegroundColor White
Write-Host "  3. Type a location (e.g., 'Cochin Airport')" -ForegroundColor White
Write-Host "  4. You should see REAL suggestions from Google!" -ForegroundColor White
Write-Host ""
Write-Host "📊 Check backend logs for:" -ForegroundColor Yellow
Write-Host "   ✅ INFO: [Locations] Calling Google Places API" -ForegroundColor Green
Write-Host "   ❌ NOT: [Locations] Using mock data" -ForegroundColor Red
Write-Host ""

