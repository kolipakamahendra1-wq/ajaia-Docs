# Architecture

## Overview

```
Browser (React SPA, Vercel)
   |  HTTPS, JSON, Authorization: Bearer <JWT>
   v
Express API (Render)  --  helmet, CORS allowlist, morgan, JSON body limit
   |  parameterized SQL over @libsql/client
   v
libSQL: local file (development)  |  Turso (production)
```

The frontend and backend are separate deployables with separate environment variables. The browser never talks to the database. The only configuration the client knows is the API base URL.

## Backend structure (`server/`)

| Path | Responsibility |
| --- | --- |
| `app.js` | `createApp({ db })`: wires middleware and routes. Taking the database as an argument is what lets tests run against an isolated database. |
| `server.js` | Entry point: validates config, initializes schema, seeds demo users, listens. |
| `config.js` | Reads environment variables. `assertConfig()` refuses to start without a strong `JWT_SECRET`. |
| `database/` | `client.js` (libSQL client), `schema.js` (DDL), `init.js`, `seed.js`. |
| `middleware/` | `auth.js` (JWT), `access.js` (per-document role checks), `validate.js` (input parsing), `errors.js` (central error handler). |
| `services/` | `documents.js` (all document and share SQL), `auth.js` (tokens, credential check), `importer.js` (TXT/MD/DOCX to editor JSON). |
| `routes/` | Thin HTTP handlers: `auth`, `documents`, `shares`, `uploads`. |

## Database schema

```
users
  id PK AUTOINCREMENT | email UNIQUE (NOCASE) | name | password_hash | created_at | updated_at

documents
  id PK (UUID text) | owner_id FK -> users.id ON DELETE CASCADE | title | content (TipTap JSON as text)
  created_at | updated_at

document_shares
  id PK AUTOINCREMENT
  document_id FK -> documents.id ON DELETE CASCADE
  user_id     FK -> users.id     ON DELETE CASCADE
  role TEXT CHECK (role IN ('viewer','editor'))
  created_at
  UNIQUE (document_id, user_id)
```

Indexes: `documents(owner_id)`, `documents(updated_at DESC)`, `document_shares(user_id)`. The unique `(document_id, user_id)` constraint also indexes share lookups by document. Foreign keys are switched on with `PRAGMA foreign_keys = ON` at startup. Every query uses bound parameters; the only interpolated SQL fragments are fixed strings chosen in code (for example which columns to update), never user input. Search terms are escaped so `%` and `_` match literally.

The owner is stored on the document row and is **not** a share row, so a document always has exactly one owner and that owner cannot be demoted by the sharing API. There is no endpoint that changes `owner_id`, so ownership cannot be transferred.

## API design

REST over JSON under `/api`. The full table is in the [README](../README.md#api-overview). Conventions:

- `GET /documents` returns `{ owned, shared }` summaries without content (smaller payload); `GET /documents/:id` returns content and the caller's `role`.
- `PUT /documents/:id` accepts `title` and/or `content` and only writes the fields sent. The server sets `updated_at`.
- Errors are `{ "error": "message" }` with a meaningful status: 400 validation, 401 unauthenticated, 403 insufficient role, 404 not found or no access, 413 too large, 415 unsupported file type, 500 unexpected (details are logged server-side only).

## Authentication and authorization

**Authentication.** `POST /auth/login` checks the password with bcrypt (cost 12) and returns an HS256 JWT whose only claim is the user id (`sub`). The `authenticate` middleware verifies the signature with an explicit algorithm allowlist (so `alg: none` is rejected), then loads the user from the database. A deleted user's token therefore stops working immediately. Login runs a bcrypt comparison against a dummy hash for unknown emails and returns one generic message, so response time and text do not reveal which emails exist.

**Authorization.** Done on the server in two small middleware steps, in this order, on every `/documents/:id` route:

1. `loadDocumentAccess` resolves the caller's role in one query: `owner` (document `owner_id` equals the JWT user), else the role in `document_shares`, else none. No role means `404`.
2. `requireWriter` (owner or editor) guards `PUT`; `requireOwner` guards `DELETE` and every `/shares` route.

Nothing identity-related is read from the request body: the owner of a new or imported document is always the JWT user, and an `ownerId` in a body is ignored (covered by a test). The React UI hides controls the user cannot use, but that is cosmetic; the API refuses the requests regardless.

## Frontend structure (`client/src/`)

- `pages/`: `Landing`, `Login`, `Dashboard` (used for both *My documents* and *Shared with me*), `Editor`, `NotFound`.
- `components/`: `AppShell` (sidebar, search, mobile drawer), `DocumentList`, `Toolbar`, `ShareModal`, `Dialogs`, `SaveStatus`, `ProtectedRoute`, and `ui` primitives (button, modal, spinner, empty/error states).
- `context/`: `AuthContext` (token + current user) and `ToastContext`.
- `hooks/`: `useAutosave`, `useDebounce`.
- `services/`: `api.js` (the only module that talks HTTP), `format.js`.
- Routing: `/` landing, `/login`, `/app/documents`, `/app/shared`, `/app/doc/:id`. The editor route is code-split so TipTap is only downloaded when a document is opened.

## Important technical decisions

**libSQL for both environments.** One client library and one SQL dialect for the local file database and Turso, so development matches production. The cost: `@libsql/client` is async-only, and a file database held open by Windows can briefly lock its file after `close()` (handled in test cleanup).

**Bearer token in `localStorage`, not a cookie.** The frontend (Vercel) and API (Render) are on different sites; cookies would need `SameSite=None`, CSRF protection and tighter CORS. A bearer token keeps the cross-origin setup simple. Trade-off: any XSS could read the token. React escapes rendered text and document content is rendered by TipTap from JSON (never injected as raw HTML), which limits that risk, but httpOnly cookies would be the stronger production choice.

**Stateless logout.** Logout discards the token on the client. A stolen token stays valid until it expires (default 7 days). A server-side denylist or short-lived tokens with refresh would close that gap.

**Content stored as TipTap/ProseMirror JSON.** It restores formatting exactly and avoids HTML sanitization. The server validates only the structure (`type: "doc"`, array content, 1 MB cap); it does not validate every node type.

**Autosave design.** `useAutosave` merges edits into one pending batch, debounces 1 second, and serializes saves through a promise chain so requests reach the server in order and never overlap. A failed batch is kept and merged under newer edits, so nothing is lost; the status shows an error. Pending edits are flushed when leaving the editor, and the tab warns on close while unsaved.

**Uploads kept in memory.** Multer uses memory storage with a 2 MB cap, so uploaded bytes never touch disk and are never executed. Validation layers: extension plus MIME allowlist (MIME alone is not trusted), then content checks (UTF-8 text without NUL bytes; ZIP signature plus a successful Mammoth parse for DOCX). DOCX is converted to Markdown by Mammoth and then through the same Markdown-to-editor-JSON converter as `.md` files, which keeps one import path. Loss: tables, images and underline do not survive DOCX import.

**404 instead of 403 for inaccessible documents** avoids revealing which document IDs exist.

**Last write wins.** There is no real-time collaboration or conflict detection: if two editors change the same document, the later save overwrites the earlier one. This was out of scope by design.
