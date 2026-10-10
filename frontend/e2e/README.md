# Playwright e2e tests

Runs the production build (`vite preview` on :4173, which proxies `/api` to
the backend) against a real Express + Postgres backend.

## Prerequisites

- Backend + Postgres reachable — default `http://localhost:5000`, e.g.
  `cd backend && npm run migrate:up && npm start` against a local Postgres.
  With docker compose the backend lands on `:5001` (AirPlay owns `:5000` on
  macOS), so run the suite as `POS_API_URL=http://localhost:5001 npm run test:e2e`.
- No seed data needed: the suite self-provisions. The first
  `POST /api/auth/register` becomes admin automatically, and products are
  created through the API when the catalog is empty.
- Env overrides: `POS_USER` / `POS_PASS` (default `e2e-admin` /
  `e2e-admin-pass`), `POS_API_URL` (default `http://localhost:5000`),
  `PLAYWRIGHT_BASE_URL` (default `http://localhost:4173`).

## Run

```bash
npm run build                      # produce the dist/ that preview serves
npx playwright install chromium    # first time only
npm run test:e2e
```
