Write-Host "🔍 PaMarket Bundle Bottleneck Analysis..." -ForegroundColor Cyan

$root = "C:\Projects\PaMarket"
$bundlePath = "$root\www\js\bundle.js"
$appPath = "$root\www\js\app.js"

if (!(Test-Path $bundlePath)) {
    Write-Host "❌ bundle.js not found" -ForegroundColor Red
    exit
}

$bundle = Get-Content $bundlePath -Raw
$app = Get-Content $appPath -Raw

$issues = @()

function Count-Match($text, $pattern) {
    return ([regex]::Matches($text, $pattern)).Count
}

Write-Host "`n📦 File Sizes:" -ForegroundColor Yellow
Write-Host "bundle.js: $([math]::Round((Get-Item $bundlePath).Length / 1KB, 2)) KB"
Write-Host "app.js: $([math]::Round((Get-Item $appPath).Length / 1KB, 2)) KB"

# -------------------------
# 1. Supabase Hotspot
# -------------------------
$supabaseCalls = Count-Match $bundle "window\.supabase|from\("
Write-Host "`n🔥 Supabase calls in bundle: $supabaseCalls"

if ($supabaseCalls -gt 200) {
    $issues += "HIGH Supabase usage in bundle (query-heavy startup risk)"
}

# -------------------------
# 2. Realtime risk
# -------------------------
$channels = Count-Match $bundle "channel\("
Write-Host "📡 Realtime channels: $channels"

if ($channels -gt 3) {
    $issues += "Too many realtime channels (startup lag + memory drain)"
}

# -------------------------
# 3. Notification loops
# -------------------------
$notif = Count-Match $bundle "syncNotifications|Notifications"
Write-Host "🔔 Notification references: $notif"

if ($notif -gt 10) {
    $issues += "Notification system too deeply embedded in bundle"
}

# -------------------------
# 4. DOM-heavy rendering
# -------------------------
$domHeavy = Count-Match $bundle "innerHTML|createElement|insertAdjacent"
Write-Host "🖼 DOM operations: $domHeavy"

if ($domHeavy -gt 300) {
    $issues += "Heavy DOM rendering inside bundle (UI blocking risk)"
}

# -------------------------
# 5. Loops & polling
# -------------------------
$loops = Count-Match $bundle "setInterval|setTimeout|requestAnimationFrame"
Write-Host "⏱ Loops / timers: $loops"

if ($loops -gt 10) {
    $issues += "Excessive timers (background CPU load)"
}

# -------------------------
# 6. Duplication vs app.js
# -------------------------
$dupSupabase = (Count-Match $bundle "from\(") - (Count-Match $app "from\(")
Write-Host "`n🔁 Supabase duplication vs app.js: $dupSupabase"

if ($dupSupabase -gt 50) {
    $issues += "High duplication between bundle.js and app.js"
}

# -------------------------
# RESULT
# -------------------------
Write-Host "`n📊 FINAL BOTTLETLENECK REPORT:" -ForegroundColor Yellow

if ($issues.Count -eq 0) {
    Write-Host "✅ NO MAJOR BOTTLENECKS FOUND" -ForegroundColor Green
} else {
    $issues | ForEach-Object { Write-Host "❌ $_" -ForegroundColor Red }
}

Write-Host "`n✔ Done" -ForegroundColor Cyan
