# Deploying MediRemind

The app is a **two-service** deployment: an Express API with a PostgreSQL database,
and a static React client. Configuration for Render (API + DB) and Netlify (client)
is already checked in.

## What changes for production

| Concern | Development | Production |
|---|---|---|
| Database | SQLite file (`server/prisma/dev.db`) | PostgreSQL, via `prisma/schema.postgres.prisma` |
| Session store | `memorystore` (in-process) | PostgreSQL-backed (`connect-pg-simple`), table `user_sessions` |
| Cookie `SameSite` | `lax` | `none` (required for cross-domain cookies) |
| Cookie `Secure` | off | on (HTTPS only) |

`server/src/config.ts` **refuses to start** in production unless `DATABASE_URL` is a
PostgreSQL URL and `SESSION_SECRET` is set. This prevents a local `.env` from
silently leaving production on SQLite and in-memory sessions.

## Prerequisites

- A GitHub repo containing this code (already done).
- A [Render](https://render.com) account (API + managed Postgres, free tier).
- A [Netlify](https://netlify.com) account (static client, free tier).

## Step 1 — Deploy the API + database (Render)

1. Render dashboard → **New** → **Blueprint**.
2. Select this repository. Render reads `render.yaml` and creates:
   - `mediremind-db` — a free PostgreSQL instance.
   - `mediremind-api` — the web service.
3. When prompted, set **`CORS_ORIGIN`** to your Netlify URL (from Step 2). You can
   add it after the first deploy and re-deploy.
4. Note the API URL, e.g. `https://mediremind-api.onrender.com`.
5. Verify: `https://<your-api>/api/health` → `{"status":"ok",...}`.

The build command runs `db:use:postgres` (generates the Postgres schema),
`db:generate:postgres`, the server build, and `db:push:postgres` (creates tables).

## Step 2 — Deploy the client (Netlify)

1. Netlify → **Add new site** → **Import an existing project** → pick this repo.
2. Netlify reads `netlify.toml` (publish dir `client/dist`, SPA redirects).
3. Add an environment variable **at build time**:
   - `VITE_API_BASE_URL` = `https://<your-api>.onrender.com`
4. Deploy, then copy the site URL (e.g. `https://mediremind.netlify.app`).

## Step 3 — Connect the two

1. Back in Render, set `CORS_ORIGIN` to the Netlify URL, then redeploy the API.
2. In Netlify, confirm `VITE_API_BASE_URL` points at the API, then redeploy.

## Step 4 — Create the demo data (optional)

Seeding creates fictional demo accounts. From a machine with the production
`DATABASE_URL`:

```bash
cd server
DATABASE_URL="postgresql://..." npm run db:seed
```

To create a chemist (public signup cannot):

```bash
cd server
DATABASE_URL="postgresql://..." npx tsx scripts/provision-chemist.ts
```

## Free-tier caveats

- **Render free services sleep** after ~15 minutes idle. The first request after
  sleeping takes ~30–60s to wake.
- **Free PostgreSQL expires** after the trial window (typically 30 days). After
  that the database is deleted; export anything you care about first.
- **Do not seed real patient data.** This is a demo app; only fictional data.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `sh: 1: tsx: not found` during build | A build script used `tsx` (a devDependency). Production builds omit devDependencies; build scripts must run on plain Node. |
| `Invalid production configuration` on boot | `DATABASE_URL` is not a Postgres URL, or `SESSION_SECRET` is unset. |
| Login works, then you are logged out on refresh | `CORS_ORIGIN` does not exactly match the client origin, or `COOKIE_SAME_SITE` is not `none`. |
| API calls fail with CORS errors | Client origin missing from `CORS_ORIGIN` (comma-separated, no trailing slash). |
| CSV download saves an HTML file | `VITE_API_BASE_URL` was not set when the client was built; rebuild the client. |
| Tables missing | The build's `db:push:postgres` step did not run; check the Render build log. |
| `prisma: not found` during build | The `prisma` CLI must be a **production** dependency (it is, in `server/package.json`); if moved back to devDependencies the build will fail. |
