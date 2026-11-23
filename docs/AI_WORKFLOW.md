# AI workflow

## Tools used

- **Claude Code** (Anthropic's CLI agent, running in VS Code) wrote the large majority of the code, tests and documentation in this repository, working from a detailed written brief.
- **Chrome DevTools MCP**, driven by the same agent, was used to exercise the running app in a real browser.
- No other generative tools were used for code.

## Where AI accelerated the work

- Scaffolding both apps and wiring the layered backend (config, database, middleware, services, routes).
- Writing the long tail of edge-case tests (forged and unsigned JWTs, MIME/extension mismatches, binary files disguised as text, corrupt DOCX, ownership spoofing in request bodies).
- Building the DOCX test fixture: a small ZIP writer inside `server/tests/helpers.js` so the suite does not need a committed binary file or an extra dependency.
- Producing the editor UI (toolbar, autosave hook, share modal, responsive shell) and iterating on it.

## What was reviewed, changed or corrected

The generated code was run and inspected rather than trusted. Specific points where verification changed the outcome:

- **Import wiring error.** The first version of the share route imported a helper from a module that did not exist. This was found when the server was exercised and fixed by reusing `findUserByEmail` in `services/auth.js`.
- **Test cleanup on Windows.** The first full test run passed 56/56 tests but reported a failed suite hook (`EBUSY` deleting the SQLite file just after `close()`). Cleanup was made best-effort and stale `test-*.db` files are swept at the start of the next run.
- **Design choices reviewed against the brief.** The brief says never to expose passwords in frontend code, so the login page prefills only the demo *email*; the demo password lives in the README and `SUBMISSION.md`. The editor route was code-split after the first build produced a single 770 kB bundle.
- **Security-relevant behaviours were written as tests, not assumed**: algorithm-confusion (`alg: none`), wrong-secret tokens, a revoked user losing access immediately, viewers blocked from every write route, and an `ownerId` in the request body being ignored.

## Verification and testing approach

1. **Automated API tests**: `cd server && npm test` runs 56 tests (Node test runner + Supertest) against a fresh file-backed libSQL database per suite. They include a "restart" test that closes the database, reopens it and re-reads a document.
2. **Build check**: `cd client && npm run build` must succeed.
3. **Manual browser run** (local, against the real API and database), done as Alice and as Bob in an isolated browser context:
   - sign in; create a document; apply Heading 1 and bold; observe *Unsaved changes* then *Saved*; reload and confirm title and formatting were restored;
   - share with Bob as viewer, then confirm in Bob's session that the document appears under *Shared with me* and the editor is read-only (readonly title, non-editable canvas, no toolbar, Save or Share);
   - upload a `.md` file and confirm headings, bold and both list types import into an editable document;
   - check the browser console (no errors or warnings) and a 390 px wide layout.

## What was not verified

- No deployment to Vercel, Render or Turso was performed, so `render.yaml`, `vercel.json` and the Turso connection path are untested against the real services.
- DOCX upload was verified by automated tests using a generated fixture, but not through the browser with a real Word-authored file.
- The frontend has no automated tests.
- Accessibility was designed in (labels, roles, focus handling, keyboard-reachable controls) but not audited with a screen reader or an automated checker.
