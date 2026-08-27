#!/usr/bin/env bash
# One-command setup for the MPLADS Image Fraud Detection Module.
# Creates a virtualenv, installs pinned dependencies, initialises the
# database, seeds it (if real photos are present), downloads/verifies
# CLIP, and runs the fast test suite.
#
# See SETUP_VERIFICATION.md for the expected output of each step and
# troubleshooting for the most likely failures.
set -uo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
FAILED=0

echo "=== MPLADS Image Module setup ==="
echo "Using interpreter: $("$PYTHON_BIN" --version 2>&1) ($PYTHON_BIN)"
echo

echo "[0/6] Checking for required .env values..."
if [ ! -f .env ] || ! grep -q "^DATABASE_URL=" .env || ! grep -q "^JWT_SECRET_KEY=" .env; then
    echo
    echo "FAILED: .env is missing or missing required values."
    echo "app/config.py requires DATABASE_URL and JWT_SECRET_KEY with no"
    echo "fallback default (an earlier version of this module hardcoded a"
    echo "live Mongo credential and a JWT secret directly in source as"
    echo "\"hackathon\" defaults — both were removed; there is nothing to"
    echo "silently fall back to any more)."
    echo
    echo "Create a .env file in the project root with at least:"
    echo "  DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/MPLADS"
    echo "  JWT_SECRET_KEY=\$(python3 -c \"import secrets; print(secrets.token_hex(32))\")"
    echo "(CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET are optional — uploads"
    echo "just won't be mirrored to Cloudinary without them.)"
    echo "See the README's \"Required environment variables\" section."
    exit 1
fi
echo ".env present with the required keys."
echo

echo "[1/6] Creating virtual environment (.venv)..."
if ! "$PYTHON_BIN" -m venv .venv; then
    echo "FAILED: could not create a virtual environment with $PYTHON_BIN."
    exit 1
fi

VENV_PY=".venv/bin/python"
VENV_PIP=".venv/bin/pip"

echo "[2/6] Installing pinned dependencies from requirements.lock..."
"$VENV_PIP" install --upgrade pip >/dev/null 2>&1
if ! "$VENV_PIP" install -r requirements.lock; then
    echo
    echo "FAILED: could not install from requirements.lock."
    echo "This usually means torch/transformers publish no wheel for $("$VENV_PY" --version 2>&1)."
    echo "See SETUP_VERIFICATION.md's troubleshooting section."
    exit 1
fi
echo "Dependencies installed."
echo

echo "[3/6] Initialising the database..."
if ! "$VENV_PY" -c "from app.database import init_db; init_db()"; then
    echo "FAILED: database initialisation failed — see the error above."
    exit 1
fi
echo "Database initialised (data/mplads.db)."
echo

echo "[4/6] Seeding the database with real photographs..."
if "$VENV_PY" -m scripts.seed_database; then
    echo "Database seeded."
else
    echo
    echo "NOTE: seeding was skipped — data/real_images/ needs real photographs"
    echo "(see data/real_images/README.md). Setup continues without a seeded"
    echo "corpus; add photos later and re-run: python -m scripts.seed_database"
    FAILED=1
fi
echo

echo "[5/6] Downloading and verifying the CLIP model (this can take several minutes)..."
if "$VENV_PY" -m scripts.download_models; then
    echo "CLIP verified."
else
    echo
    echo "NOTE: CLIP download/verification failed — the pipeline still works"
    echo "with ENABLE_CLIP=False (hash + EXIF layers only). See the error above"
    echo "and SETUP_VERIFICATION.md's troubleshooting section."
    FAILED=1
fi
echo

echo "[6/6] Running the fast test suite..."
if "$VENV_PY" -m pytest tests/ -m "not slow and not requires_clip" -q; then
    TESTS_OK=1
else
    TESTS_OK=0
    FAILED=1
fi
echo

if [ "$TESTS_OK" -eq 1 ] && [ "$FAILED" -eq 0 ]; then
    echo "=================================================="
    echo "SETUP COMPLETE."
    echo "Next: source .venv/bin/activate && uvicorn app.main:app --reload"
    echo "=================================================="
    exit 0
elif [ "$TESTS_OK" -eq 1 ]; then
    echo "=================================================="
    echo "SETUP FINISHED WITH WARNINGS (see NOTE lines above) but the fast"
    echo "test suite passes. Next: source .venv/bin/activate && uvicorn app.main:app --reload"
    echo "=================================================="
    exit 0
else
    echo "=================================================="
    echo "SETUP FINISHED WITH TEST FAILURES — see pytest output above."
    echo "=================================================="
    exit 1
fi
