const { app, BrowserWindow, shell } = require("electron");
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
  // In production, resources are in the app.asar or unpacked
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
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  const args = isDev ? ["run", "dev"] : ["run", "start"];
  nextProcess = spawn(npmCmd, args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env },
    windowsHide: true,
  });

  nextProcess.stdout.on("data", (data) => {
    console.log(`[Next.js] ${data}`);
  });

  nextProcess.stderr.on("data", (data) => {
    console.error(`[Next.js] ${data}`);
  });

  nextProcess.on("close", (code) => {
    console.log(`[Next.js] Process exited with code ${code}`);
  });
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
    // Frameless with custom title bar feel
    titleBarStyle: "default",
    autoHideMenuBar: true,
  });

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", async () => {
  // Check if Next.js is already running
  const portFree = await checkPort(PORT);

  if (portFree) {
    // Port is free, we need to start Next.js
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

app.on("window-all-closed", () => {
  // Kill the Next.js process
  if (nextProcess) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", nextProcess.pid, "/f", "/t"]);
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
