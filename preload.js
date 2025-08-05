const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getIPAddress: () => ipcRenderer.invoke("get-ip-address"),
  getUSBPrinters: () => ipcRenderer.invoke("get-usb-printers"),
  startServer: () => ipcRenderer.invoke("start-server"),
  stopServer: () => ipcRenderer.invoke("stop-server"),
  isServerRunning: () => ipcRenderer.invoke("is-server-running")
});
