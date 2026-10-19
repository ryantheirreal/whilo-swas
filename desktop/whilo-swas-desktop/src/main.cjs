const { app, BrowserWindow, Menu, shell } = require("electron");

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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
