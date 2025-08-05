const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const usb = require("usb");
const util = require("util");
const { spawn } = require("child_process");
const kill = require("tree-kill");
const AutoLaunch = require("auto-launch");

let mainWindow;
let serverProcess = null;

const appLauncher = new AutoLaunch({
    name: "Odoo-Printer-Agent",
    path: process.execPath,
});

appLauncher
    .isEnabled()
    .then((isEnabled) => {
        if (!isEnabled) {
            return appLauncher.enable();
        }
    })
    .catch((err) => {
        console.error("AutoLaunch setup error:", err);
    });

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 700,
        height: 500,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });
    mainWindow.loadFile(path.join(__dirname, "view", "index.html"));
}

function startPythonServer() {
    if (serverProcess) {
        console.info("Server already running.");
        return;
    }

    const isPackaged = app.isPackaged;
    // const scriptPath = isPackaged
    //     ? path.join(process.resourcesPath, "server", "main.py")
    //     : path.join(__dirname, "server", "main.py");

    // const pythonExec = process.platform === "win32" ? "python" : "python3";

    // console.info("Starting Python server...");

    // serverProcess = spawn(pythonExec, [scriptPath], {
    //     cwd: path.dirname(scriptPath),
    //     detached: true,
    // });

    const serverBinaryPath = isPackaged
        ? path.join(process.resourcesPath, "main")
        : path.join(__dirname, "server", "dist", "main");

    console.info("Starting FastAPI server binary...");

    serverProcess = spawn(serverBinaryPath, [], {
        cwd: path.dirname(serverBinaryPath),
        detached: true,
    });

    serverProcess.unref();

    serverProcess.stdout.on("data", (data) => {
        console.log("[PYTHON STDOUT]", data.toString());
    });

    serverProcess.stderr.on("data", (data) => {
        console.log("[PYTHON STDERR]", data.toString());
    });

    serverProcess.on("error", (err) => {
        console.error("[PYTHON ERROR]", err);
    });

    serverProcess.on("exit", (code, signal) => {
        console.log(`[PYTHON EXIT] Code: ${code}, Signal: ${signal}`);
        serverProcess = null;
    });
}

app.whenReady().then(() => {
    createMainWindow();
    startPythonServer();

    ipcMain.handle("get-ip-address", () => getLocalIPAddress());

    ipcMain.handle("get-usb-printers", async () => {
        const devices = usb.getDeviceList();
        const result = [];

        for (const device of devices) {
            try {
                device.open();
                const desc = device.deviceDescriptor;

                const getStringDescriptor = util.promisify(device.getStringDescriptor).bind(device);
                const manufacturer = await getStringDescriptor(desc.iManufacturer).catch(() => "Unknown");
                const product = await getStringDescriptor(desc.iProduct).catch(() => "Unknown");

                result.push({
                    vendorId: desc.idVendor.toString(16).padStart(4, "0"),
                    productId: desc.idProduct.toString(16).padStart(4, "0"),
                    manufacturer,
                    product,
                });

                device.close();
            } catch (error) {
                continue;
            }
        }

        return result;
    });

    ipcMain.handle("is-server-running", () => {
        return !!serverProcess;
    });

    ipcMain.handle("start-server", async () => {
        startPythonServer();
        return "started";
    });

    ipcMain.handle("stop-server", () => {
        return new Promise((resolve) => {
            if (serverProcess && serverProcess.pid) {
                console.info("Stopping Python server...");
                kill(serverProcess.pid, "SIGTERM", () => {
                    console.log("Python server stopped.");
                    serverProcess = null;
                    resolve("stopped");
                });
            } else {
                console.info("Server is not running.");
                resolve("not_running");
            }
        });
    });

});

function stopServerAndQuit() {
    if (serverProcess && serverProcess.pid) {
        console.log("Cleaning up Python server...");
        kill(serverProcess.pid, "SIGTERM", () => {
            console.log("Python server terminated.");
            app.quit();
        });
    } else {
        app.quit();
    }
}

app.on("window-all-closed", () => {
    stopServerAndQuit();
});

app.on('before-quit', () => {
    stopServerAndQuit();
});

process.on("SIGINT", () => {
    stopServerAndQuit();
});

process.on("SIGTERM", () => {
    stopServerAndQuit();
});