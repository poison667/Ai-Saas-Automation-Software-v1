/**
 * Lumina desktop app (Electron)
 * Starts the bundled Lumina backend (no Python needed), waits for it to be
 * healthy, then opens a native app window — no browser involved.
 */
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require("electron");
const { spawn, exec } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

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

async function waitForServer(timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await healthCheck()) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

function backendSpec() {
  if (app.isPackaged) {
    // Bundled single-file backend exe (built with PyInstaller in CI).
    const exe = path.join(process.resourcesPath, "backend", "Lumina-backend.exe");
    return { cmd: exe, args: [], cwd: path.dirname(exe) };
  }
  // Developer mode: run from source.
  const isWin = process.platform === "win32";
  return { cmd: isWin ? "python" : "python3", args: ["server.py"], cwd: ROOT };
}

function startBackend() {
  const spec = backendSpec();
  if (app.isPackaged && !fs.existsSync(spec.cmd)) {
    dialog.showErrorBox("Lumina is missing its engine", `Backend not found at:\n${spec.cmd}\n\nRe-download the app from the releases page.`);
    app.quit();
    return false;
  }
  server = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      LUMINA_PORT: String(PORT),
      LUMINA_NO_BROWSER: "1",                        // Electron is the window — no browser tab
      LUMINA_DATA_DIR: app.getPath("userData"),      // data persists across launches/updates
    },
  });
  serverWasStartedByUs = true;
  server.stdout.on("data", d => process.stdout.write(`[lumina-server] ${d}`));
  server.stderr.on("data", d => process.stderr.write(`[lumina-server] ${d}`));
  server.on("exit", code => {
    if (win && !win.isDestroyed() && code !== 0 && code !== null) {
      dialog.showErrorBox("Lumina engine stopped", `The backend exited unexpectedly (code ${code}).`);
    }
  });
  return true;
}

function stopBackend() {
  if (!server || !serverWasStartedByUs) return;
  try {
    if (process.platform === "win32") {
      // kill the whole process tree (frozen PyInstaller exe)
      exec(`taskkill /pid ${server.pid} /T /F`, () => {});
    } else {
      server.kill("SIGTERM");
    }
  } catch (e) { /* already gone */ }
  server = null;
}

const SPLASH = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html>
<html><head><style>
  html,body{margin:0;height:100%;background:#0a0c12;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,Segoe UI,sans-serif;color:#e6e8f2;flex-direction:column;gap:16px}
  .logo{width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#8b5cf6,#d946ef);
    display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 10px 40px rgba(139,92,246,.45)}
  .bar{width:210px;height:5px;border-radius:99px;background:#1c2130;overflow:hidden}
  .bar i{display:block;height:100%;width:40%;border-radius:99px;background:linear-gradient(90deg,#8b5cf6,#22d3ee);
    animation:slide 1.1s ease-in-out infinite alternate}
  @keyframes slide{from{margin-left:-40%}to{margin-left:100%}}
  p{color:#8b93a7;font-size:13px;margin:0}
</style></head><body>
  <div class="logo">&#10024;</div>
  <div class="bar"><i></i></div>
  <p>Starting Lumina&hellip;</p>
</body></html>`);

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: "#0a0c12",
    title: "Lumina — AI Social Media Suite",
    icon: path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(SPLASH);
  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BASE) || url.startsWith("data:")) return { action: "allow" };
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
            detail: "Generate, schedule and analyze social content with AI.\nFully local — your data stays on this computer.",
          }),
        },
        {
          label: "Open data folder",
          click: () => shell.openPath(app.getPath("userData")),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  buildMenu();
  ipcMain.on("open-external", (_e, url) => shell.openExternal(url));
  app.setAppUserModelId("social.lumina.app");

  createWindow(); // splash appears immediately

  if (!(await healthCheck())) {
    if (!startBackend()) return;
    const up = await waitForServer();
    if (!up) {
      dialog.showErrorBox(
        "Lumina couldn't start",
        "The bundled engine didn't come up within 45 seconds.\nTry running the app again, or re-download it from the releases page."
      );
      stopBackend();
      app.quit();
      return;
    }
  }
  if (win && !win.isDestroyed()) win.loadURL(BASE);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopBackend());
