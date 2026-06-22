Write-Host "🔍 PaMarket Architecture Verification Starting..." -ForegroundColor Cyan

$root = "C:\Projects\PaMarket"

# RULES
$issues = @()

function Check-File($file) {
    $content = Get-Content $file -Raw

    # 1. Dangerous limits
    if ($content -match "\.limit\((300|1000|500)\)") {
        $issues += "$file -> High limit detected"
    }

    # 2. Duplicate Supabase calls safety
    if ($content -match "\.from\(.+\)\.from\(") {
        $issues += "$file -> Invalid chained from()"
    }

    # 3. Missing safety guard
    if ($content -match "from\('") {
        if ($content -notmatch "window\.supabase") {
            $issues += "$file -> Supabase used without safety guard"
        }
    }

    # 4. Double dot bug
    if ($content -match "\.\.\s*select") {
        $issues += "$file -> Syntax bug: double dot '..select'"
    }

    # 5. Console performance risk
    if ($content -match "console\.log") {
        $issues += "$file -> console.log found (performance noise)"
    }
}

Get-ChildItem $root -Recurse -Include *.js | ForEach-Object {
    Check-File $_.FullName
}

Write-Host "`n📊 Verification Results:" -ForegroundColor Yellow

if ($issues.Count -eq 0) {
    Write-Host "✅ CLEAN: No architecture violations found" -ForegroundColor Green
} else {
    $issues | ForEach-Object { Write-Host "❌ $_" -ForegroundColor Red }
}

Write-Host "`n✔ Done" -ForegroundColor Cyan
