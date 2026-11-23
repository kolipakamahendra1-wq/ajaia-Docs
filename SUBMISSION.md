# Submission: Ajaia Docs

## Implemented features

All five core requirements work end to end locally.

- **Authentication**: login, stateless logout, `GET /auth/me`; bcrypt password hashing; JWT; secrets from environment variables; seeded demo users Alice and Bob.
- **Document dashboard**: create, rename, delete (owner only), title search, recently updated documents, separate *My documents* and *Shared with me*, each row showing title, owner and last-updated time; sidebar navigation; responsive layout with loading, empty and error states and toast notifications.
- **Rich-text editor** (TipTap): bold, italic, underline, headings 1-3, paragraphs, bullet and numbered lists, undo/redo, editable title, save-status indicator, debounced autosave, manual save (button and Ctrl/Cmd+S), reopening saved documents with formatting restored.
- **File upload**: `.txt`, `.md`, `.docx` up to 2 MB, validated and extracted in memory into a new editable document that can be modified and saved.
- **Sharing**: share by email as viewer or editor, change a role, revoke access, separate shared list. Enforced in backend middleware: viewers cannot write; editors cannot share, delete or transfer ownership; users without access get 404.
- **Persistence**: users, documents, content, owner IDs, shares and timestamps in libSQL (local file for development, Turso-compatible for production). Survives refresh and server restart (verified).
- **Database**: `users`, `documents`, `document_shares` with primary keys, foreign keys, a unique share constraint, indexes, init and seed scripts, parameterized queries.
- **Backend hardening**: auth, ownership and permission middleware, input validation, central error handler, CORS allowlist, Helmet, request logging, `/api/health`.
- **Tests**: 56 automated server tests, all passing.
- **Deployment preparation**: `render.yaml`, `client/vercel.json`, separate env templates, deployment instructions in the README.

## Demo credentials

| User | Email | Password |
| --- | --- | --- |
| Alice | `alice@demo.com` | `ajaia-demo-123` |
| Bob | `bob@demo.com` | `ajaia-demo-123` |

This is the default of the `DEMO_PASSWORD` environment variable. On any deployed instance the password is whatever was set there.

## Deployment links

Not deployed yet. These are placeholders to fill in after deploying:

- Frontend (Vercel): `TODO`
- Backend API (Render): `TODO`
- Health check: `TODO/api/health`
- Repository: `TODO`

## Incomplete or unverified

- **Not deployed.** The Vercel, Render and Turso configuration is written but has not been run against the real services.
- **No frontend automated tests.** The UI was verified by `npm run build` and a manual browser session, not by a test suite.
- **DOCX through the browser.** DOCX import is covered by server tests with a generated fixture; I did not upload a real Word document through the UI.
- **Not done by design** (per the brief): real-time collaboration, comments, version history.

## Known limitations

- **Last write wins.** Two people editing the same document at once can overwrite each other. There is no live sync or conflict detection.
- **Token in `localStorage`** and **stateless logout**: a stolen token remains valid until it expires (7 days by default). An httpOnly cookie plus a server-side session or denylist would be stronger.
- **No login rate limiting** or account lockout.
- **Import fidelity.** DOCX tables, images and underline are not preserved; Markdown support covers headings, lists, bold and italic only. Headings deeper than level 3 are mapped to level 3.
- **Sharing only works with already-registered users**, and there is no user-registration screen: accounts are the two seeded ones, plus any added directly in the database.
- **Seeding runs at every start**, so the demo accounts exist on any deployment, and changing `DEMO_PASSWORD` later does not change existing accounts.
- **Render free tier sleeps** when idle; the first request after a pause is slow.
- **Content validation is structural**: the server checks the shape and size of editor JSON, not every node type.
- **Lists are not paginated**; fine for a demo, not for thousands of documents.

## Next improvements

1. Deploy and verify end to end; record the live URLs above.
2. Real-time collaboration (for example Yjs with TipTap) with presence, and conflict handling until then (version check on save).
3. Version history with restore.
4. httpOnly-cookie sessions with server-side revocation, and login rate limiting.
5. User registration, invitations to unregistered emails, and an ownership-transfer flow.
6. Frontend tests (component tests and a Playwright smoke test of the sharing flow) and an accessibility audit.
7. Richer import (tables, images, underline) and export to DOCX/Markdown.
8. Pagination and server-side full-text search.
