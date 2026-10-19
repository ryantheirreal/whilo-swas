const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("whiloDesktop", Object.freeze({
  platform: process.platform,
  version: process.env.npm_package_version || "0.1.0",
  isDesktop: true
}));
