# Setup verification checklist

Follow this on a clean machine (teammate laptop, demo machine) to confirm
the module actually works there — don't assume "it worked on my machine"
transfers.

## 1. Prerequisites

- Python **3.10 or higher** (see `pyproject.toml`'s `requires-python` note
  — verified by static analysis, not by executing on 3.10/3.11/3.12,
  since only 3.14 was available on the development machine).
- ~2 GB free disk space (CLIP model + PyTorch).
- Internet access for the CLIP model download (Task 3.1 in `setup.sh`/`setup.bat`).

Check your Python version:
```bash
python3 --version
```
Expected: `Python 3.10.x` or higher.

## 2. Create `.env` before running the setup script

The setup script now checks for this first (step `[0/6]`) and refuses
to continue without it — `app/config.py` requires `DATABASE_URL` and
`JWT_SECRET_KEY` with no fallback default (see the README's "Required
environment variables" section for why: both used to be hardcoded
"hackathon" defaults in source, which have since been removed).

```bash
cat > .env <<'EOF'
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/MPLADS
JWT_SECRET_KEY=<paste output of: python3 -c "import secrets; print(secrets.token_hex(32))">
CLOUDINARY_CLOUD_NAME=<optional>
CLOUDINARY_API_KEY=<optional>
CLOUDINARY_API_SECRET=<optional>
EOF
```

## 3. Run the setup script

**macOS/Linux:**
```bash
./setup.sh
```
**Windows:**
```
setup.bat
```

## 4. Expected output, step by step

| Step | What it does | Expected result |
|---|---|---|
| [0/6] | Checks `.env` has `DATABASE_URL` and `JWT_SECRET_KEY` | `.env present with the required keys.` — if this fails, go back to step 2 above. |
| [1/6] | Creates `.venv/` | No errors. A `.venv/` directory appears. |
| [2/6] | `pip install -r requirements.lock` | `Dependencies installed.` — takes a few minutes (torch is ~110 MB). |
| [3/6] | `init_db()` | `Database initialised (data/mplads.db).` |
| [4/6] | `scripts.seed_database` | Either `Database seeded.` **or** a NOTE that `data/real_images/` needs photos — both are non-fatal; see below. |
| [5/6] | `scripts.download_models` | `CLIP is verified and working.` — takes several minutes on first run (~1.7 GB download). If it fails, see Troubleshooting below; the pipeline still works with `ENABLE_CLIP=False`. |
| [6/6] | `pytest tests/ -m "not slow and not requires_clip"` | `NN passed` with **zero failures**. This is the pass/fail gate for the whole script. |

Final line should be:
```
SETUP COMPLETE.
Next: source .venv/bin/activate && uvicorn app.main:app --reload
```
(or the WARNINGS variant if step 4 or 5 printed a NOTE — that's fine, it
just means real photos or CLIP aren't set up yet.)

## 5. Manual follow-up verification

```bash
source .venv/bin/activate          # .venv\Scripts\activate on Windows
uvicorn app.main:app --reload
```
Then in another terminal:
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok","database":"connected",...}`.

Open `http://localhost:8000/docs` in a browser — the Swagger UI should load.

## 6. Troubleshooting

### "torch has no wheel for this Python version"
`pip install -r requirements.lock` fails during the torch/torchvision step
with something like `ERROR: Could not find a version that satisfies the
requirement torch==...`. This means the demo machine's Python version is
too new (or too old/unusual) for the exact torch build pinned in the lock
file.

Fix: check https://pytorch.org for a wheel matching your Python version,
install it manually (`pip install torch==<compatible-version>`), then
re-run `pip install -r requirements.lock` — pip will skip torch since
it's already satisfied. If no compatible wheel exists at all, install
everything except torch/torchvision/transformers and run with
`ENABLE_CLIP=False` — the pipeline degrades gracefully (confirmed by
`app/embeddings.py`'s `_ensure_loaded()`, which catches `ImportError` and
continues with hash + EXIF checks only).

### CLIP download interrupted or times out
`scripts.download_models` fails partway through the ~1.7 GB download
(flaky network, corporate proxy, timeout). Re-running the same command is
usually enough — Hugging Face Hub resumes partially-downloaded files
rather than restarting from zero. If it keeps failing, download on a
machine with a reliable connection first, then copy the cache directory
(`~/.cache/huggingface/hub/models--openai--clip-vit-base-patch32/`,
printed by the script on success) to the demo machine at the same path.

### "Only N real photo(s) found in data/real_images (need at least 20)"
Expected on a fresh clone — `data/real_images/` is intentionally empty
by default (see its README.md). Add 30–40 real photographs before
running `scripts.seed_database` again. The rest of setup still completes
without a seeded corpus; you just won't have baseline data to test
duplicate detection against until you do this.

### "Address already in use" when starting the server
Port 8000 is taken by another process. Either stop it, or run on a
different port:
```bash
uvicorn app.main:app --reload --port 8001
```

### Tests fail on step [6/6]
Run with `-v` for detail: `.venv/bin/pytest tests/ -m "not slow and not requires_clip" -v`.
If failures are all in one file, that's usually a version-specific stdlib
or dependency behavior difference — open an issue with the Python version
and the failing test names rather than assuming the module itself is
broken; the fast suite is expected to pass unmodified across the
supported Python range.
