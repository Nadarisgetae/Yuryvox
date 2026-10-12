# Yuryvox

API-only archival-collage explainer pipeline. **Follow `DOCS/Yuryvox Masterplan v1.md` for status, phases, and the work journal.** Agent contracts: `DOCS/Yuryvox_Agent_Instructions.md`.

## Phase 1

- Next.js 14 App Router, TypeScript, Jest, ESLint, Prettier
- Host target: **Vercel**, Node **20** (`.nvmrc`). This machine may run a newer Node locally.
- Long jobs (Agents 5–7) need a worker later; not in this phase.

```bash
npm install
copy .env.example .env.local
npm test
npm run dev
```

Open http://localhost:3000 — credentials show configured/missing only, never values.

- `GET /api/health` — liveness + which keys are present
- `GET /api/smoke` — adapter pings; live HTTP only if `YURYVOX_SMOKE_LIVE=true`

## Credentials

See `.env.example`. Do not commit `.env.local`. Paid providers wait for Phase 12.
