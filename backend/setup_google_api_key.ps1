# Google Maps API Key Setup Script for Windows PowerShell
# Usage: .\setup_google_api_key.ps1 YOUR_API_KEY_HERE

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

$envFile = ".env"

# Check if .env file exists
if (Test-Path $envFile) {
    # Read existing content
    $content = Get-Content $envFile
    
    # Remove old GOOGLE_PLACES_API_KEY if exists
    $content = $content | Where-Object { $_ -notmatch "^GOOGLE_PLACES_API_KEY=" }
    
    # Add new API key
    $content += "GOOGLE_PLACES_API_KEY=$ApiKey"
    
    # Write back to file
    $content | Set-Content $envFile
    
    Write-Host "✅ Google Maps API key updated in .env file" -ForegroundColor Green
} else {
    # Create new .env file
    @"
GOOGLE_PLACES_API_KEY=$ApiKey
LOCATION_PROVIDER=google
"@ | Set-Content $envFile
    
    Write-Host "✅ Created .env file with Google Maps API key" -ForegroundColor Green
}

Write-Host ""
Write-Host "📝 Configuration:" -ForegroundColor Cyan
Write-Host "   API Key: $ApiKey"
Write-Host "   Location Provider: Google Maps"
Write-Host ""
Write-Host "⚠️  Make sure to restart your backend server for changes to take effect!" -ForegroundColor Yellow
Write-Host ""

