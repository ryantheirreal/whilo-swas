const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require("electron");
const { createCodexBridge, sanitizeOutput } = require("./codex-bridge.cjs");

const DEFAULT_WEB_URL = "https://whilo-swas.vercel.app/";
function resolveWebUrl() {
  const raw = process.env.WHILO_WEB_URL || DEFAULT_WEB_URL;
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("WHILO_WEB_URL must be an HTTPS URL without embedded credentials.");
  }
  return url;
}

const appUrl = resolveWebUrl();

let mainWindow;
let codexBridge;

function assertTrustedIpcSender(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw Object.assign(new Error("This Whilo window is not authorized to control local Codex."), { code: "codex_ipc_sender_denied" });
  }
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) {
    throw Object.assign(new Error("Local Codex is available only to Whilo's top-level window."), { code: "codex_ipc_frame_denied" });
  }
  try {
    const frameUrl = new URL(frame.url);
    if (frameUrl.origin !== appUrl.origin) throw new Error("origin mismatch");
  } catch (_) {
    throw Object.assign(new Error("Local Codex is available only to the configured Whilo origin."), { code: "codex_ipc_origin_denied" });
  }
}

function registerCodexIpc() {
  if (codexBridge) return;
  codexBridge = createCodexBridge({
    app,
    dialog,
    getWindow: () => mainWindow,
    emit: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
      mainWindow.webContents.send("whilo:codex:event", payload);
    }
  });

  const handlers = {
    "whilo:codex:status": () => codexBridge.status(),
    "whilo:codex:login": () => codexBridge.startLogin(),
    "whilo:codex:login-cancel": () => codexBridge.cancelLogin(),
    "whilo:codex:logout": () => codexBridge.logout(),
    "whilo:codex:workspace-choose": () => codexBridge.chooseWorkspace(),
    "whilo:codex:run": (_event, input) => codexBridge.runTask(input && typeof input === "object" ? input : {}),
    "whilo:codex:run-cancel": () => codexBridge.cancelTask()
  };

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        assertTrustedIpcSender(event);
        return { ok: true, value: await handler(event, ...args) };
      } catch (error) {
        return {
          ok: false,
          code: String(error && error.code || "codex_desktop_error").slice(0, 80),
          error: sanitizeOutput(error && error.message ? error.message : "Local Codex operation failed.", 500)
        };
      }
    });
  }
}

function openExternalHttp(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return;
    if (url.username || url.password) return;
    void shell.openExternal(url.toString());
  } catch {
    // Reject malformed destinations without opening another application.
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 650,
    show: false,
    title: "Whilo",
    backgroundColor: "#0d111a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: require("node:path").join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttp(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, destination) => {
    try {
      const url = new URL(destination);
      if (url.origin === appUrl.origin) return;
      event.preventDefault();
      openExternalHttp(destination);
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow && mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  void mainWindow.loadURL(appUrl.toString());
}

app.whenReady().then(() => {
  app.setName("Whilo");
  registerCodexIpc();
  if (process.platform === "darwin") {
    const menu = Menu.buildFromTemplate([
      { label: "Whilo", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] },
      { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
      { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }] }
    ]);
    Menu.setApplicationMenu(menu);
  }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch((error) => {
  console.error("Whilo desktop startup failed:", error);
  app.quit();
});

app.on("will-quit", () => {
  if (codexBridge) {
    codexBridge.dispose();
    codexBridge = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
