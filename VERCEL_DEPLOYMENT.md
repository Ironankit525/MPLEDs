# Deploy the complete MPLADS application on Vercel

This repository deploys as one Vercel project and one public domain:

- `frontend/` is a Vite service serving the React single-page application.
- `Dockerfile.vercel` is a container service running `app.main:app`.
- `/api/*`, `/health`, and the FastAPI documentation routes go to the backend.
- Every other path goes to Vite, whose internal rewrite supports React Router
  deep links such as `/app/admin/users`.

The backend is deliberately a container, not a standard Python Function. The
mandatory SigLIP model, CLIP, EasyOCR, Torch, and OpenCV exceed the standard
Python bundle. The image downloads and shards the model files during the build,
then runs fully offline at request time. It never disables the mandatory model.

## 1. Create the Vercel project

1. Import this Git repository in Vercel and keep the project Root Directory at
   the repository root (`.`).
2. In **Settings -> Build and Deployment**, set **Framework Preset** to
   **Services**. A deployment is not treated as a multi-service build unless
   this preset and the `services` block in `vercel.json` are both present.
3. Keep Fluid compute enabled.
4. In **Settings -> Functions**, use the **Performance** instance for the
   backend (4 GB / 2 vCPU). SigLIP and CLIP remain resident together; the
   Standard 2 GB instance has too little reliable headroom once OCR runs.
5. New Vercel projects are enrolled in Large Functions automatically. For a
   project created before 30 June 2026, add
   `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` and redeploy.

Vercel Services, container Functions, and Large Functions are currently beta
features. Do a Preview deployment before using the Production environment.

## 2. Configure environment variables

Add these in **Settings -> Environment Variables** for Preview and Production.
Use real secret values; do not paste them into `vercel.json` or commit `.env`.

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET_KEY` | Yes | Signs login tokens; use a new random 32-byte-or-longer value |
| `CLOUDINARY_CLOUD_NAME` | Yes | Durable evidence-image storage |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API credential |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API credential |
| `GEMINI_API_KEY` | No | Stakeholder AI summaries/report chat |
| `GEMINI_MODEL` | No | Overrides the configured Gemini model |
| `VERCEL_SUPPORT_LARGE_FUNCTIONS` | Older projects | Set to `1` when Large Functions is not already enabled |

Do **not** set `VITE_API_URL` on Vercel. The frontend intentionally calls the
same deployment with relative `/api/*` URLs, which also makes Preview URLs and
custom domains work without CORS configuration.

Do **not** set `ENABLE_SCREEN_MODEL=False` or
`ALLOW_VISUAL_MODEL_TEST_BYPASS=True`. The API fails closed when its mandatory
SigLIP model is unavailable.

Cloudinary is mandatory on Vercel because container Functions are stateless.
The application now refuses to start with incomplete storage credentials and
refuses a submission if the durable upload fails, so MongoDB cannot receive a
dead `/tmp` file path.

If MongoDB Atlas uses an IP access list, remember that Vercel container
Functions do not currently provide Static IPs. For a short-lived SIH demo, use
a least-privilege database user and Atlas network rules appropriate for that
constraint; rotate any credentials that have previously been shared.

## 3. Deploy

Push the files to the branch connected to Vercel, or use the CLI from the
repository root:

```bash
npm install --global vercel
vercel login
vercel link
vercel
vercel --prod
```

The first build is intentionally large because it downloads SigLIP, CLIP, and
EasyOCR into the container image. Later builds can reuse Docker layers when the
runtime manifest and model-cache script have not changed.

## 4. Verify the Preview deployment

Replace `$DEPLOYMENT_URL` with the generated HTTPS URL:

```bash
curl -fsS "$DEPLOYMENT_URL/health"
curl -fsS "$DEPLOYMENT_URL/openapi.json" | head
```

Then verify in a browser:

1. Refresh a deep link such as `/app/upload`; it must return the React app.
2. Register a public account and confirm its role is `submitter`.
3. Log in and upload a real JPEG below 4 MB.
4. Confirm the saved submission contains a Cloudinary HTTPS image URL and is
   still visible after the backend scales down and starts again.
5. Confirm browser Network requests use the Vercel domain, never `localhost`.
6. Check `/health`: `database` should be `connected` and
   `visual_model_status` should be `ready`.

Vercel limits the complete Function request body to 4.5 MB, so the application
caps the image at 4 MiB to leave room for multipart form metadata.

## Local development

```bash
cp .env.example .env
uvicorn app.main:app --reload
npm --prefix frontend install
npm --prefix frontend run dev
```

The Vite development server proxies `/api` and `/health` to port 8000, matching
the same-origin routing used on Vercel.
