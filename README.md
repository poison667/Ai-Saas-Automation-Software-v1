# Lumina — AI Social Media Suite

A complete, self-contained **desktop software product** for running a social media presence
with AI: content generation, cross-platform scheduling, approvals, unified inbox, social
listening, competitor tracking, audience analytics, weekly reports and team management.

Everything runs locally — no cloud account, no external services. Your data lives in a
single SQLite file (`data/app.db`) and can be exported or backed up at any time.

---

## Run it as an app

### 📦 Windows — download `Lumina.exe` (no Python, no scripts)
Every push to `main` builds standalone executables automatically via GitHub Actions:
1. Open the repo → **Actions** tab → click the latest **Build Lumina.exe** run.
2. Scroll to **Artifacts** and download:
   - **Lumina-x64** — for normal 64-bit Windows, or
   - **Lumina-x86** — for 32-bit Windows.
3. Unzip and **double-click `Lumina.exe`**. It opens your browser at
   `http://localhost:8000` automatically. Close the black window to quit.
   Your data is stored in `data/app.db` next to the exe.

*(If the exe shows "This app can't run on your PC", you picked the wrong
architecture — use the other one. Check yours: Settings → System → About →
"System type".)*

### 🖥️ Desktop application (Electron)
```bash
# one-time: python deps
python3 -m pip install fastapi "uvicorn[standard]"

cd lumina/desktop
npm install
npm start          # native window — backend starts/stops automatically
```
Build installers (`.dmg` / `.exe` / `.AppImage`) with `npm run dist:mac|win|linux`.
See `desktop/README.md`.

### 📲 Installable web app (PWA)
Serve it (`bash run.sh` → http://localhost:8000) and install from the browser:
Chrome/Edge → *Install Lumina* in the address bar. Works offline once installed.

### 🌐 Local server
```bash
bash run.sh        # installs python deps automatically, serves on :8000
```

### 🪟 Windows 10/11 (no terminal needed)
1. Install **Python 3.10+** from <https://www.python.org/downloads/> — tick
   **"Add python.exe to PATH"** in the installer.
2. Get the code: on the GitHub repo page click the green **Code** button →
   **Download ZIP**, then extract the ZIP anywhere (e.g. `C:\Lumina`).
3. **Double-click `run.bat`** inside the extracted folder. It installs the two
   dependencies on first run, starts the server, and opens
   `http://localhost:8000` in your browser automatically.
4. Log in with the demo account below. Close the black window to stop the server.

(`run.sh` is for Linux/macOS only — on Windows always use `run.bat`.)

## Demo login
| email | password |
|---|---|
| `demo@lumina.social` | `demo1234` |

The demo workspace is fully seeded on first boot: 6 accounts, 17 posts (incl. 3 awaiting
approval from teammates), 4 campaigns, 9 inbox messages, 4 teammates, 6 media assets,
5 invoices, 3 competitors, 3 tracked keywords, 3 weekly reports and 180 days of analytics.
New registrations start empty to demonstrate every empty state.

---

## The product — 20 screens

| Area | Screens |
|---|---|
| **Overview** | Dashboard (KPIs, charts, activity) · Analytics (7/30/90d, deltas) · Audience (demographics, heatmap, best-times) · Inbox (comments/mentions/DMs + AI replies) · Notifications · Reports (weekly auto-summaries, Markdown export) |
| **Create** | AI Generator (tone×platform×length, credits) · Content Ideas (niche-tuned) · Posts (CRUD, statuses incl. approvals) · Approvals (approve/reject with feedback) · Calendar · Media Library (uploads + generated assets) |
| **Manage** | Accounts (simulated OAuth, pause/resume) · Campaigns (budgets, goals) · Competitors (growth charts, share of audience) · Social Listening (keyword volume, sentiment, mentions) · AI Templates |
| **Workspace** | Team (roles, invites) · Billing (plans, invoices) · Settings (profile, prefs, usage, **export & backup**, reset) |

**App behaviors:** Ctrl/⌘+K command palette · keyboard shortcuts (`?` for help) ·
optimistic updates with Undo everywhere · loading skeletons · empty states ·
toasts · responsive down to phones · offline shell via service worker.

## Stack
- **Backend:** Python + FastAPI, SQLite (persistent), PBKDF2 password hashing,
  httpOnly session cookies
- **Frontend:** dependency-free SPA (vanilla JS, hand-rolled SVG charts) — zero CDNs
- **Desktop:** Electron wrapper that manages the backend lifecycle
- **PWA:** manifest + service worker (offline app shell, network-first API)

## Project layout
```
lumina/
├── run.sh               # self-healing launcher (installs deps, serves :8000)
├── server.py            # FastAPI app: auth, 40+ endpoints, AI engine, seeding
├── data/app.db          # SQLite database (auto-created & seeded)
├── desktop/             # Electron desktop app
│   ├── main.js          # starts backend, opens native window, app menu
│   ├── package.json     # electron + electron-builder config
│   └── icon.png
└── static/              # the app itself
    ├── index.html · styles.css
    ├── core.js          # shell, router, api, modals, palette, shortcuts, previews
    ├── pages1.js        # dashboard, generator, posts, calendar + charts
    ├── pages2.js        # accounts, campaigns, analytics, templates, settings
    ├── pages3.js        # inbox, team, media, billing, competitors
    ├── pages4.js        # approvals, audience, reports
    ├── pages5.js        # notifications, listening, ideas
    ├── sw.js · manifest.webmanifest · icon-512.png
```
