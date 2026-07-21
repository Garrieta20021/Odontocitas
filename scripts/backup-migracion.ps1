# Backup completo de OdontoCitas para migración de equipo.
# Uso: .\scripts\backup-migracion.ps1
# Requiere Docker Desktop corriendo para incluir el volcado de PostgreSQL.

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..")

$fecha = Get-Date -Format "yyyy-MM-dd-HHmmss"
$backupsRoot = Join-Path $raiz "backups"
$archives = Join-Path $backupsRoot "archives"
$destino = Join-Path $backupsRoot $fecha
New-Item -ItemType Directory -Path $destino -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $destino "env") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $destino "database") -Force | Out-Null
New-Item -ItemType Directory -Path $archives -Force | Out-Null

Write-Host "Backup OdontoCitas -> $destino"

# --- Variables de entorno (chatbot, JWT, Gemini, etc.) ---
$envFiles = @(
    @{ Src = "odontocitas-api\.env"; Dst = "odontocitas-api.env" },
    @{ Src = "odontocitas\.env"; Dst = "odontocitas.env" },
    @{ Src = "odontocitas-api\.env.example"; Dst = "odontocitas-api.env.example" }
)
foreach ($f in $envFiles) {
    $ruta = Join-Path $raiz $f.Src
    if (Test-Path $ruta) {
        Copy-Item $ruta (Join-Path (Join-Path $destino "env") $f.Dst)
        Write-Host "  [ok] env: $($f.Dst)"
    }
}

# --- Base de datos PostgreSQL ---
$dbOk = $false
$dumpPath = Join-Path $destino "database\odontocitas.sql"
try {
    $dockerOk = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        $dbContainer = docker ps --format "{{.Names}}" | Select-String "odontocitas-db"
        if (-not $dbContainer) {
            Write-Host "  [..] Levantando contenedor db..."
            Push-Location $raiz
            docker compose up -d db 2>&1 | Out-Null
            Pop-Location
            Start-Sleep -Seconds 8
        }
        docker exec odontocitas-db-1 pg_dump -U postgres -d odontocitas --no-owner --no-acl | Out-File -FilePath $dumpPath -Encoding utf8
        if ((Get-Item $dumpPath).Length -gt 1000) {
            $dbOk = $true
            Write-Host "  [ok] database: odontocitas.sql"
        }
    }
} catch {
    Write-Host "  [!!] No se pudo volcar la BD: $_"
}

if (-not $dbOk) {
    @"
No se genero el volcado SQL (Docker apagado o contenedor db no disponible).

Para incluir la base de datos:
1. Abre Docker Desktop
2. Ejecuta de nuevo: .\scripts\backup-migracion.ps1

O manualmente:
  docker compose up -d db
  docker exec odontocitas-db-1 pg_dump -U postgres -d odontocitas > database\odontocitas.sql
"@ | Set-Content (Join-Path (Join-Path $destino "database") "LEEME.txt") -Encoding UTF8
    Write-Host "  [!!] database: sin volcado (ver database\LEEME.txt)"
}

# --- Código fuente (sin node_modules ni builds) ---
$codigoZip = Join-Path $destino "odontocitas-codigo.zip"
$temp = Join-Path $env:TEMP "odontocitas-backup-$fecha"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

$excluir = @("node_modules", "dist", "build", ".vite", ".cache", "__pycache__", ".venv", "Odontocitas-backups", "backups")
robocopy $raiz $temp /E /XD $excluir /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $codigoZip -Force
Remove-Item $temp -Recurse -Force
Write-Host "  [ok] codigo: odontocitas-codigo.zip"

# --- Manifiesto ---
$manifest = @"
OdontoCitas - backup de migracion
Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Equipo origen: $env:COMPUTERNAME
Ruta proyecto: $raiz

Contenido:
  - odontocitas-codigo.zip     Proyecto (frontend, API, docker-compose, scripts)
  - env/                       .env con tokens WhatsApp, Gemini, JWT
  - database/odontocitas.sql   Base de datos PostgreSQL (incluida si Docker estaba activo)

Restaurar en equipo nuevo:
  1. Instalar Docker Desktop, Node.js 20+
  2. Descomprimir odontocitas-codigo.zip en la raiz del proyecto
  3. Ejecutar: .\scripts\restaurar-migracion.ps1 -BackupDir backups\$fecha
  4. Renovar WHATSAPP_TOKEN en Meta si expiró
  5. ngrok http 3001 y actualizar webhook en Meta

Documentación bot: odontocitas-api\README-BOT-WHATSAPP.md
"@
$manifest | Set-Content (Join-Path $destino "MANIFEST.txt") -Encoding UTF8

# --- Archivo único opcional ---
$zipFinal = Join-Path $archives "odontocitas-migracion-$fecha.zip"
Compress-Archive -Path (Join-Path $destino "*") -DestinationPath $zipFinal -Force

Write-Host ""
Write-Host "Backup listo:"
Write-Host "  Carpeta: $destino"
Write-Host "  ZIP:     $zipFinal"
if (-not $dbOk) {
    Write-Host ""
    Write-Host "AVISO: Abre Docker Desktop y vuelve a ejecutar este script para incluir la base de datos."
}
