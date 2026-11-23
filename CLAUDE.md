# CLAUDE.md

Guidance for AI-assisted work in this repository.

## Project

Ajaia Docs: a small Google-Docs-style editor. `client/` is React + Vite + Tailwind + TipTap; `server/` is Express + libSQL. Read `docs/ARCHITECTURE.md` before changing auth, permissions or the schema.

## Commands

```bash
cd server && npm install && npm run dev     # API on :8080 (needs server/.env, see .env.example)
cd server && npm test                       # automated tests (must stay green)
cd client && npm install && npm run dev     # web app on :5173, proxies /api to :8080
cd client && npm run build                  # must succeed before finishing a change
```

## Rules

- **Permissions live on the server.** Every `/documents/:id` route goes through `loadDocumentAccess` and then `requireWriter` or `requireOwner`. Never read an owner id or role from the request body. Hiding a button is not access control.
- **Users without access get 404, viewers writing get 403.** Keep this distinction.
- **Parameterized SQL only.** No user input in SQL strings. SQL lives in `server/services/`; routes stay thin.
- **No secrets in code or in the client.** `.env` files are git-ignored; `VITE_*` values are public. Do not commit `.env`, `server/data/`, or database files.
- **Uploads stay in memory** (Multer memory storage) and are never written to disk or executed. Keep the allowlist and size limit.
- Add or update a test for any change to auth, sharing, uploads or persistence, then run `npm test`.
- Keep dependencies minimal. Do not add real-time collaboration, comments or version history without being asked.
- Do not claim deployment works unless it was actually deployed and checked. Keep `SUBMISSION.md` honest when features change.

## Conventions

- ES modules throughout. Server errors: throw `AppError(status, message)`; the central handler formats it.
- Client HTTP goes only through `client/src/services/api.js`. Shared UI primitives are in `components/ui.jsx`.
- Tests use the Node test runner and Supertest with a fresh file database per suite (`server/tests/helpers.js`).
