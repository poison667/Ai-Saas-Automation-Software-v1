# Lumina — Desktop App

Lumina runs as a native desktop application via Electron. The app window is backed by
the same local Lumina server — your data stays on your machine in `lumina/data/app.db`.

## Prerequisites
- **Python 3.10+** with: `python3 -m pip install fastapi "uvicorn[standard]"`
- **Node.js 18+**

## Run the app (development mode)
```bash
cd lumina/desktop
npm install
npm start
```
The launcher automatically starts the Lumina backend, waits for it to be healthy,
then opens the native window. Closing the window shuts the backend down.

## Build installers
```bash
npm run dist:mac     # .dmg / .zip
npm run dist:win     # .exe installer
npm run dist:linux   # .AppImage / .deb
```
Installers are written to `desktop/release/`.

## Notes
- The desktop build talks to `http://127.0.0.1:8000`. If something else uses that port,
  set `LUMINA_PORT=8123` (or any free port) before launching.
- Everything works offline once dependencies are installed — no cloud account required.
