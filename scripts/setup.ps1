$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Write-Host "=== India Civic Transparency - Setup ==="

# ---- prerequisites ----
foreach ($cmd in @("node", "npm", "python", "docker", "docker-compose")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "ERROR: $cmd is not installed. Please install it first."
        exit 1
    }
}

Write-Host "[1/5] Installing backend dependencies..."
Set-Location "$ROOT\backend"
npm install

Write-Host "[2/5] Setting up Python virtual environment..."
Set-Location "$ROOT\data_pipeline"
python -m venv .venv
& "$ROOT\data_pipeline\.venv\Scripts\Activate.ps1"
pip install -q -r requirements.txt
deactivate

Write-Host "[3/5] Copying .env files..."
Set-Location "$ROOT\backend"
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  Created backend/.env from .env.example"
} else {
    Write-Host "  backend/.env already exists, skipping"
}

Write-Host "[4/5] Starting PostgreSQL + PostGIS..."
Set-Location $ROOT
docker-compose up -d

Write-Host "[5/5] Waiting for database to be ready..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $result = docker-compose exec -T postgres pg_isready -U civic 2>$null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { Write-Error "Database did not start in time"; exit 1 }

Write-Host "[6/5] Applying database schema..."
Get-Content "$ROOT\backend\db\schema.sql" | docker-compose exec -T postgres psql -U civic -d civic_transparency

Write-Host "[7/5] Installing frontend dependencies..."
Set-Location "$ROOT\frontend"
npm install

Write-Host ""
Write-Host "=== Setup complete! ==="
Write-Host "Next steps:"
Write-Host "  make seed     # load seed data"
Write-Host "  make dev      # start backend + frontend"
