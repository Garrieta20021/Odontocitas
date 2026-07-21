# Restaura OdontoCitas en un equipo nuevo después del backup de migración.
# Uso (desde la raíz del proyecto): .\scripts\restaurar-migracion.ps1 [-BackupDir "ruta\al\backup"]

param(
    [string]$BackupDir = ""
)

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..")
$backupsRoot = Join-Path $raiz "backups"

if (-not $BackupDir) {
    $candidatos = Get-ChildItem $backupsRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}-' -or $_.Name -like 'odontocitas-migracion-*' } |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($candidatos) { $BackupDir = $candidatos.FullName }
}

if (-not $BackupDir -or -not (Test-Path $BackupDir)) {
    Write-Host "Indica la carpeta del backup: .\scripts\restaurar-migracion.ps1 -BackupDir '.\backups\2026-06-28-170819'"
    exit 1
}

Write-Host "Restaurando desde: $BackupDir"

# --- .env ---
$envApi = Join-Path $BackupDir "env\odontocitas-api.env"
$envFe = Join-Path $BackupDir "env\odontocitas.env"
if (Test-Path $envApi) {
    Copy-Item $envApi (Join-Path $raiz "odontocitas-api\.env") -Force
    Write-Host "  [ok] odontocitas-api\.env"
}
if (Test-Path $envFe) {
    Copy-Item $envFe (Join-Path $raiz "odontocitas\.env") -Force
    Write-Host "  [ok] odontocitas\.env"
} elseif (-not (Test-Path (Join-Path $raiz "odontocitas\.env"))) {
    "VITE_API_URL=http://localhost:3001/api" | Set-Content (Join-Path $raiz "odontocitas\.env") -Encoding UTF8
    Write-Host "  [ok] odontocitas\.env (creado por defecto)"
}

# --- Docker ---
Push-Location $raiz
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [!!] Abre Docker Desktop y vuelve a ejecutar este script."
    Pop-Location
    exit 1
}

Write-Host "  [..] docker compose up -d..."
docker compose up -d
Start-Sleep -Seconds 12

# --- Base de datos ---
$sql = Join-Path $BackupDir "database\odontocitas.sql"
if (Test-Path $sql -and (Get-Item $sql).Length -gt 1000) {
    Write-Host "  [..] Restaurando base de datos..."
    Get-Content $sql -Raw | docker exec -i odontocitas-db-1 psql -U postgres -d odontocitas -v ON_ERROR_STOP=1 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [ok] database restaurada"
    } else {
        Write-Host "  [!!] Error al restaurar SQL; revisa el archivo manualmente."
    }
} else {
    Write-Host "  [!!] Sin odontocitas.sql; se usarán migrate + seed al arrancar la API."
}

docker compose restart api
Pop-Location

# --- Frontend deps ---
$fe = Join-Path $raiz "odontocitas"
if (Test-Path $fe) {
    Push-Location $fe
    if (-not (Test-Path "node_modules")) {
        Write-Host "  [..] npm install (frontend)..."
        npm install 2>&1 | Out-Null
    }
    Pop-Location
}

Write-Host ""
Write-Host "Restauración completada."
Write-Host "  API:       http://localhost:3001/health"
Write-Host "  Frontend:  cd odontocitas && npm run dev"
Write-Host "  WhatsApp:  ngrok http 3001 + webhook en Meta"
Write-Host "  Token:     renueva WHATSAPP_TOKEN en .env si expiró"
