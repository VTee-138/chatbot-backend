# ========================================
# 🔄 Backend Environment Switcher 
# ========================================

param(
    [string]$Mode = "menu"
)

Write-Host "🔄 Backend Environment Switcher" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

function Show-Menu {
    Write-Host ""
    Write-Host "Available environments:" -ForegroundColor Yellow
    Write-Host "1. 🏠 Local Development (localhost)" -ForegroundColor Green
    Write-Host "2. 🚀 Production (aipencil.name.vn)" -ForegroundColor Blue  
    Write-Host "3. 📋 Check Current Config" -ForegroundColor Magenta
    Write-Host "0. Exit" -ForegroundColor Red
    Write-Host ""
}

function Switch-ToLocal {
    Write-Host "🏠 Switching Backend to Local Development..." -ForegroundColor Green
    
    # Set local environment
    $env:NODE_ENV = "development"
    
    Write-Host "✅ Switched to Local Development" -ForegroundColor Green
    Write-Host "📋 Current settings:" -ForegroundColor Yellow
    Write-Host "   NODE_ENV: development" -ForegroundColor White
    Write-Host "   Port:     8000" -ForegroundColor White
    Write-Host "   CORS:     http://localhost:3001" -ForegroundColor White
    Write-Host "   Cookies:  Secure=false, SameSite=lax" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Start backend:" -ForegroundColor Yellow
    Write-Host "   npm start" -ForegroundColor Cyan
}

function Switch-ToProduction {
    Write-Host "🚀 Switching Backend to Production..." -ForegroundColor Blue
    
    # Set production environment  
    $env:NODE_ENV = "production"
    
    Write-Host "✅ Switched to Production" -ForegroundColor Green
    Write-Host "📋 Current settings:" -ForegroundColor Yellow
    Write-Host "   NODE_ENV: production" -ForegroundColor White
    Write-Host "   Port:     8000" -ForegroundColor White
    Write-Host "   CORS:     https://chatbot.aipencil.name.vn" -ForegroundColor White
    Write-Host "   Cookies:  Secure=true, SameSite=none" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Start backend:" -ForegroundColor Yellow
    Write-Host "   npm start" -ForegroundColor Cyan
}

function Show-CurrentConfig {
    Write-Host "📋 Current Backend Configuration" -ForegroundColor Magenta
    Write-Host "===============================" -ForegroundColor Magenta
    
    # Check existing files
    Write-Host "`n📁 Environment files:" -ForegroundColor Yellow
    $envFiles = @('.env', '.env.local', '.env.production')
    
    foreach ($file in $envFiles) {
        if (Test-Path $file) {
            Write-Host "   ✅ $file" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $file (missing)" -ForegroundColor Red
        }
    }
    
    # Show current NODE_ENV
    $nodeEnv = $env:NODE_ENV
    if (-not $nodeEnv) { $nodeEnv = "development" }
    Write-Host "`n🏷️  Current NODE_ENV: $nodeEnv" -ForegroundColor Yellow
    
    # Show which env file will be used
    $envFileUsed = if ($nodeEnv -eq "production") { ".env.production" } else { ".env" }
    Write-Host "📄 Using environment file: $envFileUsed" -ForegroundColor Yellow
    
    # Show key variables
    if (Test-Path $envFileUsed) {
        Write-Host "`n📋 Key variables from $envFileUsed" -ForegroundColor Yellow
        $content = Get-Content $envFileUsed
        $content | Where-Object { 
            $_ -match "^[^#].*=" -and (
                $_ -match "CORS_ORIGIN" -or 
                $_ -match "FRONTEND_URL" -or 
                $_ -match "NODE_ENV" -or
                $_ -match "COOKIE_"
            )
        } | ForEach-Object {
            Write-Host "   $_" -ForegroundColor White
        }
    }
    
    Write-Host "`n💡 Quick commands:" -ForegroundColor Cyan
    Write-Host "   .\scripts\switch-backend-env.ps1 local    # Switch to local" -ForegroundColor White
    Write-Host "   .\scripts\switch-backend-env.ps1 prod     # Switch to production" -ForegroundColor White
    Write-Host "   npm start                                 # Start backend" -ForegroundColor White
}

# Handle command line arguments
switch ($Mode.ToLower()) {
    "local" { 
        Switch-ToLocal 
        return
    }
    "prod" { 
        Switch-ToProduction 
        return
    }
    "check" { 
        Show-CurrentConfig 
        return
    }
}

# Interactive menu
do {
    Show-Menu
    $choice = Read-Host "Choose environment (0-3)"
    
    switch ($choice) {
        "1" { Switch-ToLocal }
        "2" { Switch-ToProduction }
        "3" { Show-CurrentConfig }
        "0" { 
            Write-Host "👋 Goodbye!" -ForegroundColor Green
            break
        }
        default { 
            Write-Host "❌ Invalid choice. Please try again." -ForegroundColor Red
        }
    }
    
    if ($choice -ne "0" -and $choice -ne "3") {
        Write-Host "`nPress Enter to continue..." -ForegroundColor Gray
        Read-Host
    }
    
} while ($choice -ne "0")