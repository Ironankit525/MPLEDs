@echo off
REM One-command setup for the MPLADS Image Fraud Detection Module (Windows).
REM Creates a virtualenv, installs pinned dependencies, initialises the
REM database, seeds it (if real photos are present), downloads/verifies
REM CLIP, and runs the fast test suite.
REM
REM See SETUP_VERIFICATION.md for the expected output of each step and
REM troubleshooting for the most likely failures.

setlocal enabledelayedexpansion
set FAILED=0

echo === MPLADS Image Module setup ===
python --version
echo.

echo [0/6] Checking for required .env values...
set ENV_OK=1
if not exist .env set ENV_OK=0
findstr /B /C:"DATABASE_URL=" .env >nul 2>&1
if errorlevel 1 set ENV_OK=0
findstr /B /C:"JWT_SECRET_KEY=" .env >nul 2>&1
if errorlevel 1 set ENV_OK=0
if "%ENV_OK%"=="0" (
    echo.
    echo FAILED: .env is missing or missing required values.
    echo app\config.py requires DATABASE_URL and JWT_SECRET_KEY with no
    echo fallback default ^(an earlier version of this module hardcoded a
    echo live Mongo credential and a JWT secret directly in source as
    echo "hackathon" defaults - both were removed; there is nothing to
    echo silently fall back to any more^).
    echo.
    echo Create a .env file in the project root with at least:
    echo   DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/MPLADS
    echo   JWT_SECRET_KEY=^<run: python -c "import secrets; print(secrets.token_hex(32))"^>
    echo ^(CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET are optional - uploads
    echo just won't be mirrored to Cloudinary without them.^)
    echo See the README's "Required environment variables" section.
    exit /b 1
)
echo .env present with the required keys.
echo.

echo [1/6] Creating virtual environment (.venv)...
python -m venv .venv
if errorlevel 1 (
    echo FAILED: could not create a virtual environment. Is Python installed and on PATH?
    exit /b 1
)

set VENV_PY=.venv\Scripts\python.exe
set VENV_PIP=.venv\Scripts\pip.exe

echo [2/6] Installing pinned dependencies from requirements.lock...
%VENV_PIP% install --upgrade pip >nul 2>&1
%VENV_PIP% install -r requirements.lock
if errorlevel 1 (
    echo.
    echo FAILED: could not install from requirements.lock.
    echo This usually means torch/transformers publish no wheel for your Python version.
    echo See SETUP_VERIFICATION.md's troubleshooting section.
    exit /b 1
)
echo Dependencies installed.
echo.

echo [3/6] Initialising the database...
%VENV_PY% -c "from app.database import init_db; init_db()"
if errorlevel 1 (
    echo FAILED: database initialisation failed - see the error above.
    exit /b 1
)
echo Database initialised (data\mplads.db).
echo.

echo [4/6] Seeding the database with real photographs...
%VENV_PY% -m scripts.seed_database
if errorlevel 1 (
    echo.
    echo NOTE: seeding was skipped - data\real_images\ needs real photographs
    echo ^(see data\real_images\README.md^). Setup continues without a seeded
    echo corpus; add photos later and re-run: python -m scripts.seed_database
    set FAILED=1
) else (
    echo Database seeded.
)
echo.

echo [5/6] Downloading and verifying the CLIP model (this can take several minutes)...
%VENV_PY% -m scripts.download_models
if errorlevel 1 (
    echo.
    echo NOTE: CLIP download/verification failed - the pipeline still works
    echo with ENABLE_CLIP=False ^(hash + EXIF layers only^). See the error above
    echo and SETUP_VERIFICATION.md's troubleshooting section.
    set FAILED=1
) else (
    echo CLIP verified.
)
echo.

echo [6/6] Running the fast test suite...
%VENV_PY% -m pytest tests/ -m "not slow and not requires_clip" -q
if errorlevel 1 (
    echo.
    echo ==================================================
    echo SETUP FINISHED WITH TEST FAILURES - see pytest output above.
    echo ==================================================
    exit /b 1
) else (
    echo.
    if "%FAILED%"=="1" (
        echo ==================================================
        echo SETUP FINISHED WITH WARNINGS ^(see NOTE lines above^) but the fast
        echo test suite passes. Next: .venv\Scripts\activate ^&^& uvicorn app.main:app --reload
        echo ==================================================
    ) else (
        echo ==================================================
        echo SETUP COMPLETE.
        echo Next: .venv\Scripts\activate ^&^& uvicorn app.main:app --reload
        echo ==================================================
    )
)
