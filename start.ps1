param(
    [switch]$Reset
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$VenvDir = Join-Path $BackendDir ".venv"
$PythonBin = Join-Path $VenvDir "Scripts\python.exe"
$PipBin = Join-Path $VenvDir "Scripts\pip.exe"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  DairyTrace - Farm-to-Paneer Traceability & Smart Recall" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path $PythonBin)) {
    Write-Host "[1/4] Creating Python virtual environment in backend\.venv..."
    python -m venv $VenvDir
}

try {
    & $PythonBin -c "import fastapi, uvicorn, sqlalchemy, qrcode" 2>$null
    Write-Host "[1/4] Backend Python dependencies verified."
} catch {
    Write-Host "[1/4] Installing backend Python dependencies..."
    & $PipBin install -r (Join-Path $BackendDir "requirements.txt")
}

$DbFile = Join-Path $BackendDir "dairytrace.db"
if ((-not (Test-Path $DbFile)) -or $Reset) {
    Write-Host "[2/4] Seeding DairyTrace SQLite database..."
    Push-Location $BackendDir
    try {
        & $PythonBin -m app.manage seed
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[2/4] Existing SQLite database found at backend\dairytrace.db (pass -Reset to re-seed)."
}

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "[3/4] Installing frontend npm dependencies..."
    Push-Location $FrontendDir
    try {
        npm install
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[3/4] Frontend node_modules verified."
}

Write-Host "[4/4] Starting FastAPI backend (http://127.0.0.1:8000) and Vite frontend (http://127.0.0.1:5173)..."
$BackendProc = Start-Process -FilePath $PythonBin `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $BackendDir -PassThru -NoNewWindow

$FrontendProc = Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173" `
    -WorkingDirectory $FrontendDir -PassThru -NoNewWindow

Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor Green
Write-Host "  Frontend App      : http://127.0.0.1:5173"
Write-Host "  Backend API Docs  : http://127.0.0.1:8000/docs"
Write-Host "------------------------------------------------------------" -ForegroundColor Green
Write-Host "  Demo Staff Accounts (server-verified JWT):"
Write-Host "    Inspector  : inspector@dairytrace.demo  /  Inspect@2026"
Write-Host "    QA Officer : qa@dairytrace.demo         /  QaOfficer@2026"
Write-Host "------------------------------------------------------------" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both servers."

try {
    Wait-Process -Id $BackendProc.Id, $FrontendProc.Id
} finally {
    if (-not $BackendProc.HasExited) { Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue }
    if (-not $FrontendProc.HasExited) { Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue }
}
