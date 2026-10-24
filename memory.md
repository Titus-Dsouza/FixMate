# FixMate Development Memory

## Phase 1 — Frontend Setup

Created the responsive, static FixMate frontend foundation with semantic HTML, shared CSS, and minimal vanilla JavaScript.

## Phase 2 — Civilian Interface

Implemented the three civilian options inside the existing welcome and role-selection flow. Civilian opens the new interface; Government Official remains on the existing placeholder. No backend or official workflow was added.

### Files changed

- `frontend/index.html` — Added civilian navigation; complaint form, review and local confirmation; complaint list with separate user and demo records; and the fictional area report. Preserved the welcome and role-selection screens.
- `frontend/css/styles.css` — Added responsive civilian forms, navigation, status cards, demo statistics, category/department breakdowns, ranking table, and focus/reduced-motion behavior using FixMate's forest-green and warm-white palette.
- `frontend/js/main.js` — Added role routing, civilian option navigation, required-field and photo validation, photo preview, review/edit/confirmation flow, prototype reference IDs, localStorage persistence, demo complaint rendering, status colors, dates, and unresolved duration.
- `Phase.md` — Marked Phase 2 homepage, complaint submission form, My Complaints, and Politician & Area Report checklist items complete.
- `memory.md` — Updated with the current implementation and test record.

### Behavior and decisions

- Complaint categories are Roads & Footpaths, Garbage & Waste, Drainage & Waterlogging, and Water Supply & Leakage. Locality is a typed Pune locality with optional suggestions; description is required; JPG, PNG, and WebP photos are optional, previewed, and limited to 5 MB.
- Submissions require a review step and are saved as `Awaiting review` prototype entries. They receive `FM-PROT-...` references and are stored in this browser's localStorage when available. Confirmation says explicitly that no government complaint is registered and AI/department routing are not connected.
- Photo previews and filenames appear during review; the image itself is not retained in localStorage. Submitted descriptions and metadata persist in localStorage. If storage is blocked, the entry is session-only and the confirmation says so.
- My Complaints separates the user's submissions and useful empty state from clearly tagged fictional examples. Example status colors follow the design: red unresolved, yellow awaiting review, orange uncertain, green citizen-confirmed completion. New entries cannot be changed to another status; no official/AI status controls exist.
- The area report's counts, breakdowns, overdue total, and neutral sample-area monthly ranking are fictional demonstration values. It contains no politician or real official names, and prominently says rankings are not authoritative.
- No theme switcher existed; the screens use the existing light palette. No libraries or external assets were added.

### Run locally

From the repository root: `python3 -m http.server 8000 --directory frontend`, then open `http://localhost:8000`.

### Verification performed

- `node --check frontend/js/main.js` — passed.
- Python HTML audit — passed: unique IDs, all form fields have labels, required categories and three navigation options exist, prototype/demo disclosures are present, and responsive/reduced-motion/status styles exist.
- Node mock-DOM interaction checks against the actual JavaScript — passed: welcome → role choice → all three civilian options; Government Official remains on its placeholder; form rejects missing required values, supports review/edit/save, writes a prototype entry, and shows the correct status.
- Photo test with mock files — passed: unsupported type and over-5-MB files are rejected; supported image preview and review attachment work; object URL is released after save.
- Storage test — passed: complaint metadata is present in localStorage and remains visible after reinitializing the app; the empty state appears before the first saved record.
- `git diff --check` and whitespace checks — passed.
- Browser rendering, real keyboard use, and browser-console inspection were unavailable because this environment has no browser runtime. Mock-DOM tests are not browser tests.

### Limitations and next steps

- All complaint and area report data are local prototype/demo content; there is no API, official registration, AI analysis, department routing, or real area data.
- Uploaded photo bytes are only previewed during the current form session and are not persisted.
- A person cannot change a complaint to citizen-confirmed in this prototype; green status appears only on explicitly labelled demo examples.
- Phase 2 checklist items are complete. Wait for explicit instruction before starting Phase 3 (government interface).

## Phase 2 refinement — Description, Department, Status, and Area Report

### Changes

- `frontend/index.html` — Added the exact category helper; retained free-text Pune locality with optional datalist suggestions; made description optional with the future-AI/pending helper; added the suggested department selector and review row; renamed the civilian report navigation/heading to Area Report; replaced leaderboard content with area-level Monthly Area Progress; updated the report headings and statistics.
- `frontend/js/main.js` — Added category-to-department mapping with manual override and “Use suggested department” reset; saves selected department; allows blank descriptions and stores `descriptionPending`; displays pending copy without claiming AI generated it; applies status-specific classes to complete complaint cards.
- `frontend/css/styles.css` — Added full-card red/yellow/orange/green status tints, department suggestion styling, and responsive monthly area progress rows; removed unused dot and ranking styles.
- `memory.md` — Recorded this refinement and its checks.

### Verification performed

- `node --check frontend/js/main.js` — passed.
- Node mock-DOM behavior test — passed: all four category mappings, override persistence across category changes, reset to suggested department, blank-description validation/review/save, pending-description feedback, and department persistence.
- The same behavior test confirmed all four demo complaint states receive their full-card color classes and new submissions receive the awaiting-review class.
- HTML/CSS audit — passed: helper copy, free-text locality, optional description (no required/minlength constraint), optional photo, review and department controls, area-level headings and demo disclosures, responsive rules, reduced-motion styles, and no politician/leader ranking labels in the frontend.
- `git diff --check` and whitespace audit — passed.
- Browser visual rendering and console testing remain unavailable in this environment; the interaction checks use a mock DOM.

### Limitations and next steps

- Department suggestions are frontend-only heuristics; jurisdiction is not checked and no department is officially assigned.
- Blank descriptions remain pending. Gemini is not integrated; no AI description is generated.
- Uploaded photo bytes remain session-only; localStorage keeps the filename and complaint metadata.
- Area counts and progress periods remain fictional demo values and do not describe actual Pune performance.
- `Phase.md` was not changed in this refinement. Government interface/backend work remains for a later phase after explicit instruction.


## Gemini complaint sorting frontend seam

### Implementation

- `frontend/index.html` — Removed the citizen-facing department selector. The form sends the selected category, free-text locality, optional description, and optional photo to a same-origin analysis endpoint. Review shows the original details and photo, the original and Gemini-suggested categories, a recommended department, editable final category and description, severity/confidence/reasoning/uncertainties when a valid analysis is returned, and clear uncertainty/manual-fallback notices.
- `frontend/js/main.js` — Added a 15-second POST integration point at `/api/complaints/analyze/` using multipart `FormData`; no browser API key or Gemini SDK. Results are accepted only when category, department, severity, description, reasoning, confidence, review flag, and uncertainty fields match the frontend schema. HTTP/network/timeout/JSON/schema failures enter a manual report flow without showing invented AI output. On confirmation, the prototype stores original and final categories/descriptions, AI suggestions separately, description source, department recommendation/source and `officiallyAssigned: false`, confidence, review flag, uncertainties, and analysis outcome. Corrected categories and blank final descriptions force human review as applicable.
- `frontend/css/styles.css` — Added responsive review, department recommendation, analysis detail, warning, and live-status styling.

### Decisions and limitations

- No Django app, Gemini client, API configuration, or credentials exist in this repository. The endpoint is an integration seam only; with the current static preview it will fail and the manual fallback remains usable. Nothing is delivered to a government department.
- The fallback department is a category-based suggestion only. A valid backend result may return one of the four known department labels; the browser cannot verify jurisdiction. If a citizen changes the AI-suggested category, the AI department recommendation remains visible and the report is flagged for human review.
- Blank descriptions are not fabricated. If Gemini returns no generated description and the citizen leaves the final description blank, the entry remains pending and requires human review.
- Backend work still required: implement and authenticate the Django analysis endpoint; accept and validate image uploads; call Gemini with untrusted-content safeguards and a strict structured response; validate server-side output; handle timeouts/rate limits safely; protect the endpoint with Django CSRF/session policy; keep credentials in backend environment configuration; and persist AI suggestions separately from citizen-confirmed final fields. Do not claim official assignment or complaint registration until real routing exists.

### Verification performed

- `node --check frontend/js/main.js` — passed.
- Node function-level checks against the actual JS — passed: all four supported category/department pairs; low-confidence/uncertain review flag; rejection of unsupported category, department, severity, confidence, and malformed uncertainty fields; valid result acceptance; manual fallback rejection paths for invalid JSON/schema, HTTP failure, network failure, and an aborted timeout; blank AI-generated descriptions remaining pending and forcing human review; citizen category/description corrections persisting separately from AI suggestions and forcing human review.
- Python HTML audit — passed: unique IDs, labels for form controls, only the two intended category selectors, and no department form control.
- `git diff --check` — passed. Protected Markdown files were not edited in this update; `Phase.md` was left as found and no additional checklist item was checked.
- Browser rendering/console tests were unavailable. Attempting `python3 -m http.server 8000 --directory frontend` was blocked by the environment (`PermissionError: [Errno 1] Operation not permitted`), and no browser runtime is installed.

### Run and next steps

- Preview command when local socket permissions allow: `python3 -m http.server 8000 --directory frontend`, then open `http://localhost:8000`.
- Implement the Django endpoint and server-side Gemini validation before treating AI sorting as active; add backend tests for department recommendations, ambiguous inputs, blank descriptions, invalid model output, API failure, and uploaded-image handling.


## Phase 3 — Government Interface

### Implementation and decisions

- `frontend/index.html` — Routed the existing official role choice to an official demonstration sign-in screen, then added an operational dashboard, complaint detail view, filters, performance summary, and repair-evidence form. The screen prominently says it is a demonstration, does not authenticate accounts, accepts any non-empty input only to open fictional records, and instructs users not to enter real passwords. No registration link is provided.
- `frontend/js/main.js` — Preserved the welcome and citizen navigation; directs the official role to `official-login`, adds screen titles for the official flow, and exposes the existing screen switcher to the official module.
- `frontend/js/official.js` — Isolated fictional official fixtures from citizen localStorage. Implements field validation for demo sign-in without checking or retaining credentials; status/category/locality/severity filters; reference/locality search; newest, oldest, severity, and days-unresolved sorting; priority/recent queues; complaint detail fields; sample calculations; and after-repair photo validation, preview/removal, and submission. Submitted evidence changes the sample case to `awaiting_confirmation` and never to `confirmed`.
- `frontend/css/styles.css` — Added responsive official login, dashboard, case cards, status panels, details, evidence UI, focus, and reduced-motion styles consistent with the forest-green and warm-white design.
- `Phase.md` — Checked only the three completed Phase 3 interface checklist items.

Demonstration assignments, dates, severities, statuses, locality labels, and resolution figures are fabricated fixtures and are clearly labelled. The current repository has no backend; this UI does not authenticate, read citizen-local prototype submissions, validate real assignments, persist repair evidence, or send anything to an authority. Complaint AI fields display as unavailable when no result exists. Sample assignments are not official assignments. Category/routing edits are disabled because no permission model or audit persistence exists. Evidence remains pending citizen confirmation; this prototype offers no way for an official or AI to confirm it. Demo changes reset on reload.

Future Django/PostgreSQL work: implement session authentication and approved official accounts; enforce role and per-complaint assignment checks on every endpoint; provide an assignment-filtered complaint API; persist original/AI/final classification and audit corrections; store complaint and repair photos securely; record evidence submissions with actor/time/history; add a citizen-only confirmation endpoint; and return real authorized performance aggregates. The frontend's demo fixtures must be replaced only when these backend contracts and permissions exist.

### Verification

- `node --check frontend/js/main.js` and `node --check frontend/js/official.js` — passed.
- Mock-DOM interaction checks against `official.js` — passed: empty-field login validation, demo dashboard entry, status filtering, reference search, severity sorting, no-match empty state, complaint details for unavailable AI and a temporary valid analysis result with uncertainty/confidence, human-review flag, JPG/PNG/WebP and 5 MB image checks, valid photo preview, and evidence submission remaining `awaiting_confirmation`.
- Function-level checks against the actual queue filter — passed: status, category, locality, severity, reference/locality search, newest, oldest, severity, and days-unresolved sorting; empty results.
- Role-routing check — passed: official selection opens sign-in; civilian selection still opens the existing civilian report view. HTML audit passed for unique IDs and labels. CSS contains responsive breakpoints and reduced-motion support.
- `git diff --check` — passed. No backend test suite exists. Browser rendering/console and real keyboard/responsive inspection remain unavailable in this environment; local HTTP server startup was previously blocked by socket permission (`PermissionError`).

### Run and next steps

From the repository root, run `python3 -m http.server 8000 --directory frontend` and open `http://localhost:8000` where local socket permissions allow. Next implement Django authentication, assignment-scoped APIs, secure file storage, audit history, citizen confirmation, and backend authorization tests before using this interface for real official work.


## Phase 3 refinement — Personal official dashboard

### Implementation

- `frontend/index.html` — Replaced the demo sign-in's username-only input with the requested official email, password, department, and assigned-locality fields. Replaced the large operations dashboard with **My Complaints & Performance**, exactly four metric cards, and All / Unresolved / Awaiting citizen confirmation / Resolved filters. Existing complaint-detail and repair-evidence views remain.
- `frontend/js/official.js` — Sign-in checks that all four demo fields are present/valid, then keeps only department/locality in in-memory demo scope; credentials are immediately reset and never stored. Every list, filter, and metric uses only sample complaints whose assigned department and locality match that scope. My Complaints counts scoped rows; Resolved by Me requires a citizen-confirmed complaint plus demo-official work, evidence submitted before the citizen confirmation, and an explicit citizen-confirmed evidence status; Unresolved includes every non-confirmed complaint; Overdue requires an open complaint with an explicit past `deadlineAt`. Missing deadlines are never inferred. Evidence submission stores an in-memory work note/photo reference and changes status to `awaiting_confirmation`; it cannot increase Resolved by Me.
- `frontend/css/styles.css` — Added the four-field select styling and simplified four-card/filter/list layout while retaining responsive and reduced-motion rules.
- `memory.md` — Recorded this refinement, test results, and remaining backend work.

### Decisions and limitations

- Department and locality choices only select fictional browser fixtures. The login is still a demonstration, not authentication, and selection is not authorization. Demo inputs are not persisted. There is no Django API or official identity/assignment model in the repository.
- All localities, assignments, deadlines, work notes, evidence, and completion history are explicitly fictional. Some demo records have no deadline and do not count overdue. A confirmed sample without recorded official work/evidence is not counted as Resolved by Me.
- Work notes and evidence previews exist only in page memory and reset on reload. No official can citizen-confirm a repair; there is no confirmation action in this interface.
- Production next steps: authenticate officials with Django; store authorised department/locality server-side; ignore client scope as proof and scope all list/detail/metric/evidence endpoints to the authenticated assignment; persist optional deadlines, work notes, evidence, and audit actors; count resolution only after a citizen confirmation event; securely store images; and test denied cross-scope requests as well as permitted ones.

### Verification

- `node --check frontend/js/main.js` and `node --check frontend/js/official.js` — passed.
- Mock-DOM workflow checks — passed: email validation, demo entry, department/locality filtering across all four departments, all four calculated metrics, all four status filters, empty scope, invalid/oversized/valid repair photo handling, evidence submission to awaiting citizen confirmation, and no increase to Resolved by Me before citizen confirmation.
- Metric checks cover scoped totals, official-work-and-citizen-confirmed resolution, open unresolved records, recorded past deadlines, and records with no deadline.
- The existing welcome and civilian route code was left unchanged. Static HTML audit passed: unique IDs, labelled controls, preserved screens, four requested metrics/filters, and required sign-in fields. CSS breakpoints and reduced-motion rules are present. Credential/secret scan and `git diff --check` passed; protected Markdown files other than the permitted memory file were unchanged, and `Phase.md` was left untouched.
- Browser rendering, console, and real device accessibility tests are unavailable in this environment. There is no backend test suite.

### Run and next steps

From the project root: `python3 -m http.server 8000 --directory frontend`, then open `http://localhost:8000` where local socket permissions allow. Implement server-verified official identity and scope before replacing these demo fixtures with real assigned complaints.

## Phase 4 — UI Polish, Responsive Design & Consistency

### Changes

- frontend/index.html — Added a shared keyboard-accessible light/dark theme switch in the masthead so it remains available throughout welcome, civilian, and official screens.
- frontend/js/main.js — Added theme initialization from saved preference or operating-system preference, theme switching, accessible pressed/label state, browser color-scheme updates, and guarded local persistence.
- frontend/css/styles.css — Added shared theme tokens, dark palettes for all screens and form controls, contrast-aware full-card status tints for unresolved, awaiting, uncertain, and citizen-confirmed cases, and small-screen layout refinements for header, forms, report summaries, and official dashboard sections. Existing focus and reduced-motion rules remain active.
- frontend/js/official.js — Prevented a second repair-evidence submission for a complaint that already has evidence.
- Phase.md — Marked the three completed Phase 4 checklist items only.

### Decisions and limitations

- Theme preference is stored as fixmate.theme.v1; if storage is unavailable, the selected theme still works until reload. The operating-system preference is used only when no saved setting exists.
- The four status colors retain written labels and full-card/status-panel backgrounds in both themes. Official demo records and their scope remain separate from citizen localStorage records. Evidence remains awaiting citizen confirmation and cannot be submitted twice from the same demo complaint.
- No backend, account authentication, live government connectivity, or real complaint records were introduced.

### Verification

- node --check frontend/js/main.js and node --check frontend/js/official.js — passed.
- Theme behavior harness — passed for system preference, both toggle directions, saved preference taking precedence, accessible state/label updates, and blocked-storage fallback.
- HTML audit — passed for unique IDs, form control labels, screen structure, and retained welcome, role, civilian, and government navigation hooks.
- CSS/status/responsive audit — passed for all four light/dark status treatments, full-card selectors, listed responsive breakpoints, and reduced-motion support. All four status types are present in the official demo fixtures.
- Official workflow audit — passed for the duplicate evidence-submission guard and retained awaiting-confirmation/citizen-confirmed distinction.
- git diff --check — passed. Secret scan found only the expected official password field and local variable references; no credential values or keys were added.
- Browser rendering, console inspection, real keyboard use, and device-width overflow checks were unavailable: no browser, Playwright, or jsdom runtime is installed. The checks above are source and mock-runtime checks, not visual browser tests.

### Run and next steps

Run python3 -m http.server 8000 --directory frontend from the repository root and open http://localhost:8000 where local socket permissions allow. Perform visual checks on a real browser at mobile, tablet, and desktop widths. Keep the demonstration authentication and fixtures until a future Django phase provides server-authorized identities, assignments, and data.

## Phase 5 — Django Backend (in progress; suite not green)

Resumed from the interrupted run of `backend/.venv/bin/python backend/manage.py test complaints`, which reported 14 tests with 4 failures (one truncated as `FAIL: test_category_...`). The failures were reproduced first and captured in full, then the application defects were fixed. No test was deleted, edited, or weakened; CSRF enforcement, permission classes, and scope filters were left intact.

### Root causes found and fixed (application code)

- `backend/complaints/views.py` — `ComplaintDetailView` is a DRF `RetrieveAPIView` whose lookup defaulted to `pk`, but every route in `backend/complaints/urls.py` passes `<int:complaint_id>`, so every complaint detail request raised `AssertionError: Expected view ComplaintDetailView to be called with a URL keyword argument named "pk"` (surfacing as a 500). Fixed by setting `lookup_url_kwarg = "complaint_id"` on the view so it matches the rest of the nested routes.
- `backend/complaints/views.py` — `transition_status()` held the official review policy table, and `ComplaintEvidenceView` reused it to move a complaint to `awaiting_confirmation`. The table correctly forbids officials jumping straight to `awaiting_confirmation`, so evidence submission failed with `400 — "This status transition is not allowed for an official."`. The helper was split: `record_transition()` performs the storage and append-only audit write, while `transition_status()` keeps the review policy (officials still cannot reach `awaiting_confirmation` or `completed` through `/status/`). The evidence view calls `record_transition()` behind its own status guard, and `ConfirmCompletionView` uses it for the citizen-only completion write.

After these two fixes: 12 of 14 tests pass, covering CSRF-required login, public registration being unable to create an official or set scope, server-side category routing, protected-field rejection, official scope exclusions, citizen-only history privacy, upload validation, evidence-then-citizen-confirmation ordering, and area-report aggregation.

### The 2 remaining failures are test fixtures that contradict the security model

- `test_official_scope_requires_both_department_and_locality` (tests.py line 191, `2 != 1`) — the fourth complaint, `self.create_complaint(citizen=self.other_citizen)`, uses the helper defaults (`locality="Aundh"`, `category=Roads & Footpaths`), which matches the official's authorized department **and** locality, so `/api/complaints/assigned/` correctly returns 2 rows (reproduced in isolation: the matching rows are the first and fourth complaints). The only rule that would return 1 is hiding complaints based on their reporter, which no defensible design has — an assigned official must see every in-scope complaint regardless of who filed it. Left failing rather than adding reporter-based scoping to the app or editing the test.
- `test_photo_downloads_are_private_and_do_not_expose_media_urls` (tests.py line 337, `403 != 200`) — the test never authenticates `self.client`: `create_complaint()` posts through a separate `APIClient`, so the photo GET is anonymous and correctly returns 403, while the same test also asserts that a *different* citizen gets 404. No coherent policy serves anonymous 200 and other-citizen 404; the only consistent reading is that the fixture forgot to log the owner in. Making the endpoint `AllowAny` would expose every citizen's photo to anyone who guesses a sequential complaint ID, so the secure implementation was kept and the test left failing.

Both need a decision from the project owner: correct the two test fixtures (authenticate the owner before the photo GETs; create the fourth complaint out of scope, e.g. `locality="Baner"`), or accept the two red tests. Until the suite is green, Phase 5 checklist items stay unchecked.

### Verification performed (this session)

- `backend/.venv/bin/python manage.py test complaints` — **12 passed, 2 failed** (the two fixture conflicts above). Not green; Phase 5 is not claimed complete.
- `backend/.venv/bin/python manage.py check` — passed, no issues.
- `backend/.venv/bin/python manage.py makemigrations --check --dry-run` — passed, no changes detected.
- `backend/.venv/bin/python -m compileall -q complaints config manage.py` — passed.
- `backend/.venv/bin/python manage.py migrate` — all migrations, including `complaints.0001_initial`, apply cleanly (the tracked `db.sqlite3` was an empty file).
- A temporary debug scaffold used to reproduce scope behavior was deleted and is not part of the suite.

### Security inspection

- Environment variables: `config/settings.py` reads `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DB_ENGINE` and friends from `backend/.env` via `python-dotenv`, and refuses to start with the default or `replace-` secret when `DEBUG=false`. No `.env` exists in the tree; only `backend/.env.example` with placeholders is tracked.
- Secret exclusions: `.gitignore` covers `.env`/`.env.*` (keeping `.env.example`), `.venv/`, and `__pycache__`. Recommended but **not applied**, because this session's documentation rule limits edits to `memory.md` and `Phase.md`: also ignore `backend/db.sqlite3` and `backend/media/` so a migrated database and uploaded citizen photos cannot be committed by accident.
- Authentication: session login with CSRF required on `login`, `register`, and `logout` (verified by the passing CSRF test); anonymous requests are rejected by the default `IsAuthenticated` permission.
- Authorization: `IsCitizen`/`IsOfficial` role checks plus `complaints_visible_to()` scoping — citizens see only their own complaints (others return 404), officials see only complaints matching both authorized department and locality, and `/mine/` returns 403 to officials.
- Status transitions: the official review table excludes `completed` entirely; repair evidence moves a case only to `awaiting_confirmation`; only `/confirm/` (citizen-only, reporter-scoped) reaches `completed`, and every change writes an audit row with its actor.
- Files: uploads are Pillow-verified (JPEG/PNG/WebP, ≤5 MB, ≤25 MP), renamed to opaque UUID names, and served only through scoped, `never_cache`, `nosniff` endpoints; no `photo_url` media URL appears in API responses.
- Diff review: `git diff` contains no credential values or keys; the only password-like strings are the local test constant and variable names. Nothing was committed, pushed, reset, cleaned, or discarded.

### Demo data and frontend

Official screens still use clearly labelled fictional fixtures (`source: "demo"`, `FM-DEMO-...` references, "DEMO DATA" labels); `official.js` never touches `localStorage`, and `main.js` only writes citizen complaints on submission, so no page load overwrites user-created data.

### What remains unfinished

- The two test fixture conflicts above must be resolved before the suite can be green.
- All four Phase 5 checkboxes in `Phase.md` remain unchecked while tests are failing.
- PostgreSQL is selectable via `DB_ENGINE=postgresql` but was only exercised on SQLite; a real PostgreSQL run is still untested.
- `Readme.md`, `Architecture.md`, `Design.md`, and `License.md` were not edited.

## Phase 5 — Both failing tests resolved; suite green (this session)

### Root causes and fixes

- **Issue B — `test_official_scope_requires_both_department_and_locality` (`2 != 1`)**: the application logic was correct; the fourth fixture complaint, `create_complaint(citizen=self.other_citizen)`, used the helper defaults (locality Aundh, Roads & Footpaths), which match the official's authorized department *and* locality, so `/api/complaints/assigned/` correctly returned 2 rows. The test's own expectation (only the fully in-scope complaint visible, `results[0] == permitted.pk` under newest-first ordering) proves the fourth complaint was meant to be out of scope — the fixture was wrong, not the expectation or the queryset. Fixed the fixture: the fourth complaint is now created with `locality="Baner"` (outside the official's authorized locality), captured as `out_of_scope`, and the test additionally asserts the official gets 404 on that complaint's detail endpoint. No scope rule changed; reporter identity was never used for filtering, and the official's access was not broadened.
- **Issue A — `test_photo_downloads_are_private_and_do_not_expose_media_urls` (`403 != 200`)**: the test never authenticated the reporting citizen — `create_complaint()` posts through a separate `APIClient`, so the owner's photo GET was anonymous and was correctly rejected (403) by the default `IsAuthenticated` permission, while the same test expected a *different* citizen to get 404. Fixed the fixture: the test now first asserts anonymous → 403 (new regression assertion), then signs the owner in with the real session-login helper for the 200/`nosniff` assertions, and keeps the other-citizen → 404 assertion. `ComplaintPhotoView` was not changed and no permission was weakened.
- **Hardening found while verifying the test's "do not expose media urls" clause**: `ComplaintSerializer.photo` and `RepairEvidenceSerializer.image` were serializing as absolute media URLs (e.g. `http://testserver/complaints/<uuid>.jpg`, built from `MEDIA_URL='/'`) because DRF's `UPLOADED_FILES_USE_URL` defaults to True. Set `"UPLOADED_FILES_USE_URL": False` in the `REST_FRAMEWORK` config so file fields serialize to their storage name only; private files remain reachable solely through the scoped, `never_cache` photo endpoints. Added a regression assertion that the complaint-detail payload contains no `http(s)://` or root-relative URL for the photo.

### Verification performed (this session)

- `backend/.venv/bin/python backend/manage.py test complaints` — **14 passed, 0 failed** (baseline this session: 12 passed, 2 failed; the two focused tests were also run individually and passed).
- `backend/.venv/bin/python backend/manage.py check` — passed, no issues. Re-run with `DB_ENGINE=postgresql` — also passed.
- `backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run` — passed, no changes detected.
- `backend/.venv/bin/python backend/manage.py migrate --check` — all migrations applied on the dev SQLite database.
- PostgreSQL backend probe: with `DB_ENGINE=postgresql`, `connection.vendor` reports `postgresql` and the connection attempt reaches `127.0.0.1:5432`, which refuses — **this environment has no PostgreSQL server, no client binaries, no Docker, and no local PostgreSQL installation**, so a live PostgreSQL migrate/test run remains unverified. This is an environment limitation, not a code defect; psycopg[binary] 3.3.6 is installed and loads correctly.
- `git diff --check` — passed. A temporary scratch test used to observe photo serialization was created, run, and deleted; it is not part of the suite.

### Decisions

- `Phase.md`: checked "Create database models", "Implement authentication and permissions", and "Connect complaint submission and tracking" — each implemented and verified by the green suite. **"Set up Django and PostgreSQL" was deliberately left unchecked**: the Django half is fully verified, and the PostgreSQL configuration loads and reaches the connection step, but the database has never been served in this environment, so the requirement is not fully verified. To finish it: run `DB_ENGINE=postgresql backend/.venv/bin/python backend/manage.py migrate` and then `... manage.py test complaints` against a real PostgreSQL server, and tick the box if both pass.
- No test was deleted, skipped, or weakened; assertions were only added. Permission classes, CSRF enforcement, scope filters, the official status-transition table, and citizen-confirmation rules are unchanged. Phase 6 was not started.
- Pre-existing uncommitted work (frontend changes, earlier `Phase.md`/`memory.md` edits, untracked `backend/` and the presentation files) was preserved; nothing was committed, pushed, reset, cleaned, or discarded. `Readme.md`, `Architecture.md`, `Design.md`, and `License.md` remain unedited.
