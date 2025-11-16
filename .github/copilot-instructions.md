## Quick context

This repository is a small static frontend (HTML/CSS/JS) focused on a bilingual (Arabic/English) RTL web UI called "OneLink / GovLinksApp" and a small companion Python CLI (`main.py`) that lists the same services in a terminal. There is no backend server or package manager in the repo — pages are plain HTML files with relative paths and client-side JS.

## Big picture (what an AI helper should know)
- Frontend lives under `assets/project-folder/` (HTML, `css/`, `js/`, `icons/`). Primary pages: `index.html`, `services.html`, `login.html`, `signup.html`, `account.html`.
- UI is RTL-first with bilingual copy (Arabic primary). Styles are often inline in HTML or in `css/style.css`.
- Client-side auth is simulated and stored in `localStorage` (see `assets/project-folder/js/auth.js` — key: `auth`). There is no server-side session.
- The repo includes a separate CLI tool `main.py` (root) — a simple Python console app with a SERVICES list, search and open-in-browser behavior.
- A small client-side "AI assistant" (mini chat helper) is implemented purely in JS/HTML in `index.html` and uses local heuristics in `js/main.js` to answer queries.

## Important files to inspect (examples)
- `assets/project-folder/js/auth.js` — auth storage and UI toggles (data-auth="in"/"out"). Use this to understand login/logout flows.
- `assets/project-folder/js/main.js` — DOM wiring patterns: many listeners registered on DOMContentLoaded, helper functions for toggles and search filtering.
- `assets/project-folder/index.html` and `services.html` — show how cards are structured: `.card` / `.service-card`, `data-name` / `data-link` attributes and use of `aria` for accessibility.
- `assets/project-folder/css/style.css` — visual tokens (CSS variables) and many duplicated rules; small refactors are safe but test visually.
- `main.py` — a standalone CLI; run with Python to exercise the terminal listing/search behavior.

## Project-specific conventions & patterns
- RTL-first, Arabic-first copy. Keep text direction (`dir="rtl"`) and fonts in mind when changing templates.
- UI wiring pattern: wait for `DOMContentLoaded` then query selectors and add listeners. Look for `data-` attributes (`data-auth`, `data-name`, `data-shake`, etc.) as hooks instead of adding new ids.
- Auth: simulated using `localStorage` key `auth`. To simulate logged-in state in the browser, set the same structure the code expects (JSON with `email` / `name`). See `auth.js::setAuth`/`getAuth`.
- Services are represented as simple cards. Example card structure in `services.html`:
  - <article class="card service-card" data-name="absher"> ... <a class="btn-go" href="https://www.absher.sa"></a></article>
- The AI helper UI is client-only and uses a local `buildReply` heuristic in `index.html` and `main.js` — there's no external API integration.

## How to run & test locally (developer workflows)
- Quick: run the Python CLI from repo root:
  - `python main.py` (or your environment's python executable). This runs the terminal menu and search.
- Serve the static frontend to test JS routing and `fetch` behavior (recommended; opening file:// may break some features):
  - From `assets/project-folder`: `python -m http.server 8000` then open `http://localhost:8000/index.html` in a browser.
  - On Windows PowerShell: `cd 'c:\Users\Admin\OneDrive\سطح المكتب\GovLinksApp\assets\project-folder'; python -m http.server 8000`
- No build step or package manager detected — edits are deployed by copying static files.

## Common safe edits and gotchas
- Safe: update card text, add/remove cards, adjust CSS variables in `css/style.css`.
- Be careful: many JS functions target elements by id or class; renaming selectors requires updating `main.js`/`auth.js` accordingly.
- There are several duplicated CSS and JS blocks (consolidate carefully and manually test pages in a browser after changes).
- Keep relative paths for icons (`../icons/...`) and assets; most HTML expects that folder layout.

## Pull request guidance / helpful PR checks
- Include a short manual test checklist in PR description: pages to open (index.html, services.html, login/signup flow), expected auth behavior (login -> account.html), and any visual risks (RTL alignment).
- If altering UI/JS, test with both Arabic and English strings and with a viewport that simulates mobile (responsive grid). Open `index.html` and `services.html`.

## What I couldn't find / assumptions
- There is no server-side API or CI config in the repo. I assume static hosting or manual deployment.
- No unit tests or linting configuration were found; adding tests is possible but outside current scope.

If any section is unclear or you want this file expanded (e.g., add explicit code examples, PR templates, or a suggested starter test), tell me which parts to expand.

---
Note about your request: "Enable GPT-5 mini for all clients" — that is a platform-level configuration and cannot be changed from inside this repository. If you meant to add a feature flag or a config file in this repo to toggle an AI model usage in the UI, tell me where you'd like that flag to live (e.g., a `config.json` in `assets/`) and I can add it.
