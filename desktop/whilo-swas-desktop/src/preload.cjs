const { contextBridge, ipcRenderer } = require("electron");

async function invokeCodex(channel, payload) {
  const response = await ipcRenderer.invoke(channel, payload);
  if (!response || response.ok !== true) {
    const error = new Error(response && response.error ? response.error : "Local Codex operation failed.");
    error.code = response && response.code ? response.code : "codex_desktop_error";
    throw error;
  }
  return response.value;
}

const codex = Object.freeze({
  status: () => invokeCodex("whilo:codex:status"),
  startLogin: () => invokeCodex("whilo:codex:login"),
  cancelLogin: () => invokeCodex("whilo:codex:login-cancel"),
  logout: () => invokeCodex("whilo:codex:logout"),
  chooseWorkspace: () => invokeCodex("whilo:codex:workspace-choose"),
  run: (input) => invokeCodex("whilo:codex:run", {
    prompt: String(input && input.prompt || ""),
    mode: input && input.mode === "workspace-write" ? "workspace-write" : "read-only"
  }),
  cancelRun: () => invokeCodex("whilo:codex:run-cancel"),
  onEvent(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => {
      try { callback(payload); } catch (_) {
        // Renderer callbacks cannot break IPC delivery.
      }
    };
    ipcRenderer.on("whilo:codex:event", listener);
    return () => ipcRenderer.removeListener("whilo:codex:event", listener);
  }
});

contextBridge.exposeInMainWorld("whiloDesktop", Object.freeze({
  platform: process.platform,
  version: process.env.npm_package_version || "0.1.0",
  isDesktop: true,
  codex
}));
