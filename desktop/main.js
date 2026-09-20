/**
 * Lumina desktop app (Electron)
 * Starts the local Lumina backend, waits for it to be healthy, then opens a native window.
 */
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = process.env.LUMINA_PORT || 8000;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, "..");

let server = null;
let win = null;
let serverWasStartedByUs = false;

function healthCheck() {
  return new Promise(resolve => {
    const req = http.get(`${BASE}/api/health`, { timeout: 1200 }, res => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await healthCheck()) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

function startBackend() {
  const isWin = process.platform === "win32";
  server = spawn(isWin ? "python" : "python3", ["server.py"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, LUMINA_PORT: String(PORT) },
  });
  serverWasStartedByUs = true;
  server.stdout.on("data", d => process.stdout.write(`[lumina-server] ${d}`));
  server.stderr.on("data", d => process.stderr.write(`[lumina-server] ${d}`));
  server.on("exit", code => {
    if (win && !win.isDestroyed() && code !== 0) {
      dialog.showErrorBox("Lumina backend stopped", `The local server exited unexpectedly (code ${code}). Is Python 3 installed?`);
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: "#0a0c12",
    title: "Lumina — AI Social Media Suite",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(BASE);

  // open external links in the system browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BASE)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "About Lumina",
          click: () => dialog.showMessageBox({
            title: "Lumina",
            message: "Lumina — AI Social Media Suite",
            detail: "Generate, schedule and analyze social content with AI.\nLocal build · data lives in lumina/data/app.db",
          }),
        },
        { type: "separator" },
        { label: "Learn more", click: () => shell.openExternal("https://example.com/lumina") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  buildMenu();
  ipcMain.on("open-external", (_e, url) => shell.openExternal(url));

  if (!(await healthCheck())) {
    startBackend();
    const up = await waitForServer();
    if (!up) {
      dialog.showErrorBox(
        "Lumina couldn't start",
        "The local backend didn't come up within 30 seconds.\n\nCheck that Python 3 is installed and that fastapi/uvicorn are available:\n  python3 -m pip install fastapi \"uvicorn[standard]\"\n\nThen launch again."
      );
      app.quit();
      return;
    }
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (serverWasStartedByUs && server) {
    try { server.kill("SIGTERM"); } catch (e) {}
  }
  if (process.platform !== "darwin") app.quit();
});
