# Ajaia Docs

A lightweight collaborative document editor inspired by Google Docs, built for the Ajaia LLC AI-Native Full Stack Developer assignment. Users sign in, write rich-text documents that autosave, import `.txt` / `.md` / `.docx` files, and share documents with other registered users as **viewers** or **editors**. Permissions are enforced by the API, not just the UI.

> Status: runs locally and passes its automated tests. It has **not** been deployed yet. See [SUBMISSION.md](SUBMISSION.md) for an honest list of what is and is not done.

## Features

- **Auth**: JWT login/logout, bcrypt-hashed passwords, two seeded demo users.
- **Dashboard**: create, rename, delete (owner only), search by title, recent documents, separate *My documents* and *Shared with me*, with owner and last-updated time.
- **Editor** (TipTap): bold, italic, underline, headings 1-3, paragraphs, bullet and numbered lists, undo/redo, editable title, save-status indicator, debounced autosave, manual save (button or Ctrl/Cmd+S). Content is stored as editor JSON and restored on reopen.
- **Import**: upload `.txt`, `.md` or `.docx` (max 2 MB). Content is extracted in memory into a new editable document.
- **Sharing**: owner shares by email as viewer or editor, changes a collaborator's role, or revokes access. Viewers are read-only; editors can edit but cannot share, delete or transfer ownership.
- **Persistence**: users, documents, owner IDs, shares and timestamps live in SQLite-compatible libSQL (local file in development, Turso in production).

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, TipTap 3, Lucide, Axios |
| Backend | Node.js, Express 5, JWT (`jsonwebtoken`), `bcryptjs`, Multer, Mammoth, Helmet, CORS, Morgan |
| Database | libSQL via `@libsql/client` (local `file:` database or Turso) |
| Tests | Node's built-in test runner + Supertest |

## Prerequisites

- Node.js 20 or newer (developed on Node 22) and npm.
- No external services are needed for local development.

## Installation

```bash
git clone <your-repo-url> ajaia-docs
cd ajaia-docs
(cd server && npm install)
(cd client && npm install)
```

## Environment configuration

**Server**: copy `server/.env.example` to `server/.env` and set the values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | yes | 16+ characters. The server refuses to start without it. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | no | Defaults to `file:./data/ajaia.db`. Use `libsql://...` for Turso |
| `DATABASE_AUTH_TOKEN` | Turso only | Turso auth token |
| `CLIENT_ORIGIN` | no | Allowed browser origin(s), comma-separated. Default `http://localhost:5173` |
| `DEMO_PASSWORD` | no | Password for the seeded demo accounts. Default `ajaia-demo-123` |
| `PORT`, `JWT_EXPIRES_IN` | no | Default `8080` and `7d` |

**Client**: `client/.env.example` documents `VITE_API_URL`. Leave it empty locally; the Vite dev server proxies `/api` to `http://localhost:8080`. `.env` files are git-ignored. Never put secrets in `VITE_*` variables, because they end up in the public bundle.

## Run locally

```bash
# terminal 1: API on http://localhost:8080
cd server && npm run dev

# terminal 2: web app on http://localhost:5173
cd client && npm run dev
```

## Database initialization

The server creates the schema and seeds the demo users automatically on every start (both steps are idempotent). To run them manually:

```bash
cd server
npm run db:init   # create tables and indexes
npm run db:seed   # insert alice@demo.com and bob@demo.com if missing
```

Note: if you change `DEMO_PASSWORD` after the demo users already exist, their stored password does not change. Delete `server/data/ajaia.db` (or the rows) to re-seed.

## Demo credentials

| User | Email | Password |
| --- | --- | --- |
| Alice | `alice@demo.com` | `ajaia-demo-123` (the `DEMO_PASSWORD` default) |
| Bob | `bob@demo.com` | `ajaia-demo-123` |

**Try sharing:** sign in as Alice, create a document, click **Share**, enter `bob@demo.com` as *Viewer*. Sign in as Bob in a private window and open *Shared with me*: the document is read-only. Switch Bob to *Editor* and he can edit it. Revoke access and it disappears for Bob.

## API overview

All routes are under `/api`. Everything except login, logout and health requires `Authorization: Bearer <token>`.

| Method and path | Purpose | Who |
| --- | --- | --- |
| `GET /health` | Health check (also pings the database) | public |
| `POST /auth/login` | Returns `{ token, user }` | public |
| `POST /auth/logout` | Stateless; the client discards its token | public |
| `GET /auth/me` | Current user | any user |
| `GET /documents?q=` | `{ owned, shared }` lists, optional title search | any user |
| `POST /documents` | Create (owner is always the caller) | any user |
| `GET /documents/:id` | Document with content and the caller's role | owner, editor, viewer |
| `PUT /documents/:id` | Update title and/or content | owner, editor |
| `DELETE /documents/:id` | Delete | owner |
| `GET /documents/:id/shares` | List collaborators | owner |
| `POST /documents/:id/shares` | Share or change a role: `{ email, role }` | owner |
| `DELETE /documents/:id/shares/:userId` | Revoke access | owner |
| `POST /uploads` | Multipart field `file` becomes a new document | any user |

A user with no access to a document receives `404` (not `403`), so document existence is not revealed. A viewer attempting a write receives `403`.

## Testing

```bash
cd server && npm test
```

56 tests cover login and token validation, document create/read/update/delete, persistence across a database reconnect, upload validation (type, MIME, size, empty, binary, corrupt DOCX), importing TXT/MD/DOCX, sharing and revoking, 404/403 for unauthorized access, and viewer-versus-editor enforcement. The client has no automated tests; it is checked by `npm run build` and manual browser testing (see SUBMISSION.md).

```bash
cd client && npm run build
```

## Deployment

Target: **Vercel** (frontend), **Render** (backend), **Turso** (database). Steps below are instructions only; deployment has not been performed or verified.

1. **Turso**: create the database and credentials.
   ```bash
   turso db create ajaia-docs
   turso db show ajaia-docs --url          # DATABASE_URL (libsql://...)
   turso db tokens create ajaia-docs       # DATABASE_AUTH_TOKEN
   ```
2. **Render**: push the repo to GitHub, then *New > Blueprint* and select the repo (it reads [render.yaml](render.yaml)). Fill in the prompted secrets: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `JWT_SECRET`, `DEMO_PASSWORD`. Set `CLIENT_ORIGIN` after step 3. Confirm `https://<service>.onrender.com/api/health` returns `{"status":"ok"}`.
3. **Vercel**: import the repo, set **Root Directory** to `client`, framework preset *Vite*. Add the environment variable `VITE_API_URL=https://<service>.onrender.com/api`. Deploy. [client/vercel.json](client/vercel.json) rewrites all paths to the SPA.
4. Go back to Render and set `CLIENT_ORIGIN` to the exact Vercel origin (for example `https://ajaia-docs.vercel.app`, no trailing slash), then redeploy the API. Preview deployments need their own origin added (comma-separated).

Render's free tier sleeps when idle, so the first request after a pause can take about a minute. Never commit `.env` files or credentials.

## Project layout

```
ajaia-docs/
  client/        React + Vite app (components, pages, hooks, services, context)
  server/        Express API (routes, middleware, database, services, tests)
  docs/          ARCHITECTURE.md, AI_WORKFLOW.md
  render.yaml    Render blueprint
  SUBMISSION.md  Implemented / incomplete / limitations
  CLAUDE.md      Conventions for AI-assisted work in this repo
```
