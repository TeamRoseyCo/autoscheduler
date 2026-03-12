const { app, BrowserWindow, shell, session } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

let mainWindow;
let nextProcess;
const PORT = 3000;
const isDev = !app.isPackaged;

function getNextPath() {
  if (isDev) {
    return path.join(__dirname, "..");
  }
  return path.join(process.resourcesPath, "app");
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function waitForServer(port, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok || response.status === 200 || response.status === 304) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function startNextServer() {
  const cwd = getNextPath();

  try {
    if (isDev) {
      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
      nextProcess = spawn(npmCmd, ["run", "dev"], {
        cwd,
        stdio: "pipe",
        shell: process.platform === "win32" ? "powershell.exe" : true,
        windowsHide: true,
      });
    } else {
      const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
      nextProcess = spawn(process.execPath, [nextBin, "start"], {
        cwd,
        stdio: "pipe",
        shell: process.platform === "win32" ? "powershell.exe" : true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        windowsHide: true,
      });
    }

    nextProcess.stdout.on("data", (data) => {
      console.log(`[Next.js] ${data}`);
    });

    nextProcess.stderr.on("data", (data) => {
      console.error(`[Next.js] ${data}`);
    });

    nextProcess.on("close", (code) => {
      console.log(`[Next.js] Process exited with code ${code}`);
    });

    nextProcess.on("error", (err) => {
      console.error(`[Next.js] Failed to start: ${err.message}`);
    });
  } catch (err) {
    console.error("[Next.js] Spawn error:", err);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: isDev
      ? path.join(__dirname, "..", "public", "icon.ico")
      : path.join(process.resourcesPath, "app", "public", "icon.ico"),
    title: "AutoScheduler",
    backgroundColor: "#12121c",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: "default",
    autoHideMenuBar: true,
  });

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links AND Google OAuth in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Intercept navigations to Google OAuth — open in system browser instead
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.includes("accounts.google.com")) {
      event.preventDefault();
      shell.openExternal(url);
      // Re-focus webContents after preventDefault to avoid losing keyboard input
      setTimeout(() => mainWindow?.webContents.focus(), 100);
    }
  });

  // Fix: re-focus webContents whenever the window regains focus
  // Prevents the known Electron bug where keyboard input silently stops
  mainWindow.on("focus", () => {
    mainWindow.webContents.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", async () => {
  // ── Autostart on Windows login (only when packaged) ──
  if (!isDev) {
    try {
      app.setLoginItemSettings({ openAtLogin: true });
    } catch (err) {
      console.error("Failed to set login item:", err);
    }
  }

  // Check if Next.js is already running
  const portFree = await checkPort(PORT);

  if (portFree) {
    startNextServer();
  }

  await createWindow();

  // Show a loading state
  mainWindow.loadURL(`data:text/html,
    <html>
      <head>
        <style>
          body {
            margin: 0;
            background: #12121c;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            flex-direction: column;
            gap: 20px;
          }
          .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(108, 92, 231, 0.3);
            border-top-color: #6C5CE7;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          h2 { font-weight: 400; opacity: 0.8; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <h2>AutoScheduler is starting...</h2>
      </body>
    </html>
  `);

  // Wait for the Next.js server to be ready
  const ready = await waitForServer(PORT);

  if (ready) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } else {
    mainWindow.loadURL(`data:text/html,
      <html>
        <head>
          <style>
            body {
              margin: 0;
              background: #12121c;
              color: #ff6b9d;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              flex-direction: column;
              gap: 12px;
            }
          </style>
        </head>
        <body>
          <h2>Failed to start server</h2>
          <p style="color:#aaa">Could not connect to Next.js on port ${PORT}</p>
        </body>
      </html>
    `);
  }
});

app.on("before-quit", () => {
  // Flush cookies to disk so the session persists across restarts
  try {
    session.defaultSession.cookies.flushStore();
  } catch {
    // ignore
  }
});

app.on("window-all-closed", () => {
  // Kill the Next.js process
  if (nextProcess) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", nextProcess.pid, "/f", "/t"], { shell: true });
    } else {
      nextProcess.kill("SIGTERM");
    }
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
