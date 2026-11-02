const { app, BrowserWindow, ipcMain, dialog, net, Tray, Menu, nativeImage, powerSaveBlocker } = require('electron');
const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const pcCleanup = require('./pcCleanup.cjs');
const execFileAsync = promisify(execFile);

// Send the signed-in Windows user's credentials (NTLM/Kerberos) to spd-apps automatically.
// Both spellings are set because Chromium renamed this switch across versions.
app.commandLine.appendSwitch('auth-server-allowlist', 'spd-apps');
app.commandLine.appendSwitch('auth-server-whitelist', 'spd-apps');

// Explicit Windows Application User Model ID:
// Required for Windows to correctly display the app in the Taskbar and in
// Windows "Taskbar Settings > Other system tray icons"
if (process.platform === 'win32') {
  app.setAppUserModelId('com.digitaltraveller.app');
}

let mainWindow = null;
let tray = null;
let keepAwakeEnabled = false;
let keepAwakeInterval = null;
let powerSaveBlockerId = null;

function getSettingsConfigPath() {
  return path.join(app.getPath('appData'), 'DigitalTraveller', 'config.json');
}

function readSettingsConfig() {
  const configPath = getSettingsConfigPath();
  if (!fs.existsSync(configPath)) return {};

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The config.json root must be an object.');
  }
  if (parsed.settings === undefined) return {};
  if (!parsed.settings || typeof parsed.settings !== 'object' || Array.isArray(parsed.settings)) {
    throw new Error('The config.json settings value must be an object.');
  }

  return Object.fromEntries(
    Object.entries(parsed.settings).filter(([, value]) => typeof value === 'string')
  );
}

ipcMain.on('load-settings-config', (event) => {
  try {
    event.returnValue = { success: true, settings: readSettingsConfig() };
  } catch (error) {
    console.error('Failed to read config.json:', error);
    event.returnValue = {
      success: false,
      error: `Could not read config.json: ${error.message}`
    };
  }
});

ipcMain.on('save-settings-config', (event, settings) => {
  let temporaryPath = '';
  try {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new Error('Settings must be an object.');
    }
    const entries = Object.entries(settings);
    if (entries.length > 200 || entries.some(([key, value]) =>
      typeof key !== 'string' || typeof value !== 'string'
    )) {
      throw new Error('Settings must contain no more than 200 string key/value pairs.');
    }

    const configPath = getSettingsConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    temporaryPath = `${configPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify({ version: 1, settings: Object.fromEntries(entries) }, null, 2)}\n`,
      'utf8'
    );
    fs.renameSync(temporaryPath, configPath);
    event.returnValue = { success: true };
  } catch (error) {
    if (temporaryPath) {
      try {
        fs.rmSync(temporaryPath, { force: true });
      } catch (cleanupError) {
        console.error('Failed to remove temporary config file:', cleanupError);
      }
    }
    console.error('Failed to write config.json:', error);
    event.returnValue = {
      success: false,
      error: `Could not save config.json: ${error.message}`
    };
  }
});

// Helper to reliably load the application icon with embedded fallback
function getAppIcon() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  }
  // High-contrast SVG Renishaw probe icon fallback if file is ever missing
  return nativeImage.createFromDataURL(
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%232563eb"/><circle cx="32" cy="18" r="8" fill="%23f43f5e"/><rect x="29" y="18" width="6" height="30" rx="3" fill="white"/><rect x="18" y="44" width="28" height="6" rx="2" fill="white"/></svg>'
  );
}

// Silently nudges the mouse cursor 1 pixel and returns to reset Windows screensaver/lock timer
function nudgeMouse() {
  if (process.platform === 'win32') {
    const psCmd = 'Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.Cursor]::Position; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(($p.X + 1), $p.Y); Start-Sleep -Milliseconds 40; [System.Windows.Forms.Cursor]::Position = $p';
    exec(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "${psCmd}"`, { windowsHide: true }, (err) => {
      if (err) {
        console.warn('Mouse nudge notice:', err.message);
      }
    });
  }
}

function setKeepAwake(enabled) {
  keepAwakeEnabled = enabled;

  if (keepAwakeInterval) {
    clearInterval(keepAwakeInterval);
    keepAwakeInterval = null;
  }

  if (powerSaveBlockerId !== null) {
    if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
    }
    powerSaveBlockerId = null;
  }

  if (keepAwakeEnabled) {
    // Prevent display and system sleep
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');

    // Nudge mouse immediately once, then every 5 minutes (300,000 ms)
    nudgeMouse();
    keepAwakeInterval = setInterval(() => {
      nudgeMouse();
    }, 5 * 60 * 1000);
  }

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Digital Traveller',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Keep PC awake',
      type: 'checkbox',
      checked: keepAwakeEnabled,
      click: (menuItem) => {
        setKeepAwake(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Digital Traveller',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(keepAwakeEnabled ? 'Digital Traveller (Keep PC Awake: ON)' : 'Digital Traveller');
}

function createTray() {
  if (tray) return;

  const appIcon = getAppIcon();
  const trayIcon = appIcon.resize({ width: 32, height: 32 });

  tray = new Tray(trayIcon);
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.focus();
        }
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const appIcon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Frameless window to match our custom Windows 11 title bar
    titleBarStyle: 'hidden',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    }
  });

  if (process.platform === 'win32') {
    mainWindow.setIcon(appIcon);
  }

  createTray();

  // Closing the window hides it to the persistent tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // In production load web-build/index.html, in dev load local dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const indexPath = path.join(__dirname, '../web-build/index.html');
    console.log('Loading:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url);
  });
}

// Window control IPC handlers
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});

ipcMain.on('window-minimize-to-tray', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (!tray) {
      createTray();
    }
    win.hide();
  }
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  // Hide to persistent system tray instead of closing app
  win?.hide();
});

// Direct Network Share File System handlers (Direct UNC / Mapped drive access)
ipcMain.handle('read-network-file', async (event, filePath) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return { success: true, data: buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-network-file', async (event, { filePath, data }) => {
  try {
    const buffer = Buffer.from(data);
    await fs.promises.writeFile(filePath, buffer);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Native folder picker
ipcMain.handle('select-network-directory', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('select-network-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Excel workbooks', extensions: ['xlsm', 'xlsx', 'xls'] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

function getSystemDirectory(request) {
  const validateSegment = (value, label) => {
    const segment = typeof value === 'string' ? value.trim() : '';
    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      /[<>:"/\\|?*\u0000-\u001f]/.test(segment) ||
      /[. ]$/.test(segment)
    ) {
      throw new Error(`Enter a valid ${label} before creating system folders.`);
    }
    return segment;
  };

  const serialNumber = validateSegment(request?.serialNumber, 'serial number');
  const partNumber = validateSegment(request?.partNumber, 'part number');
  const customerName = validateSegment(request?.customerName, 'customer name');
  const expectedFolderName = `${serialNumber}_${partNumber}_${customerName}`;
  if (typeof request?.systemFolderPath === 'string' && request.systemFolderPath.trim()) {
    const systemFolderPath = path.resolve(request.systemFolderPath.trim());
    if (
      !path.isAbsolute(request.systemFolderPath.trim()) ||
      path.basename(systemFolderPath).toLowerCase() !== expectedFolderName.toLowerCase()
    ) {
      throw new Error('The configured network system folder does not match the traveller details.');
    }
    return systemFolderPath;
  }

  const configuredLocation = typeof request?.saveLocation === 'string'
    ? request.saveLocation.trim()
    : '';
  const saveLocation = configuredLocation || app.getPath('documents');
  if (!path.isAbsolute(saveLocation)) {
    throw new Error('The Save location must be an absolute local or network directory path.');
  }

  return path.join(saveLocation, expectedFolderName);
}

function validatePathSegment(value, label) {
  const segment = typeof value === 'string' ? value.trim() : '';
  if (
    !segment ||
    segment === '.' ||
    segment === '..' ||
    /[<>:"/\\|?*\u0000-\u001f]/.test(segment) ||
    /[. ]$/.test(segment)
  ) {
    throw new Error(`Enter a valid ${label} before updating the network save location.`);
  }
  return segment;
}

function getConfiguredNetworkSystemRoot(configuredLocation) {
  if (typeof configuredLocation !== 'string' || !configuredLocation.trim() ||
      !path.isAbsolute(configuredLocation.trim())) {
    throw new Error('Configure an absolute Network Save Location in Settings.');
  }

  let root = path.resolve(configuredLocation.trim());
  if (
    path.basename(root).toLowerCase() === 'digital test sheets' &&
    path.basename(path.dirname(root)).toLowerCase() === 'internal data'
  ) {
    root = path.resolve(root, '..', '..', '..');
  }
  return root;
}

function getPartNumberMatches(entries, partNumber) {
  const marker = `_${partNumber}_`.toLowerCase();
  return entries.filter((entry) =>
    entry.isDirectory() && entry.name.toLowerCase().includes(marker)
  );
}

function getFolderCustomerName(folderName, partNumber) {
  const marker = `_${partNumber}_`.toLowerCase();
  const markerIndex = folderName.toLowerCase().indexOf(marker);
  return markerIndex < 0 ? null : folderName.slice(markerIndex + marker.length);
}

async function getCustomerDataFolderNames(systemDirectory) {
  const customerDataDirectory = path.join(systemDirectory, 'Customer data');
  let entries;
  try {
    entries = await fs.promises.readdir(customerDataDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) =>
      entry.isDirectory() &&
      !['reg backup', 'system pictures'].includes(entry.name.toLowerCase())
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

ipcMain.handle('find-network-system-folder', async (event, request) => {
  try {
    const partNumber = validatePathSegment(request?.partNumber, 'part number');
    const customerName = validatePathSegment(request?.customerName, 'customer name');
    const configuredRoot = getConfiguredNetworkSystemRoot(request?.configuredLocation);
    const rootStats = await fs.promises.stat(configuredRoot);
    if (!rootStats.isDirectory()) {
      throw new Error('The configured Network Save Location is not a folder.');
    }

    const entries = await fs.promises.readdir(configuredRoot, { withFileTypes: true });
    const matches = getPartNumberMatches(entries, partNumber);
    if (matches.length > 1) {
      throw new Error(
        `More than one network folder matches Part Number "${partNumber}". Resolve the duplicates manually.`
      );
    }
    if (matches.length === 0) {
      return {
        success: true,
        folderName: null,
        existingCustomerName: null,
        customerNameMatches: null,
        customerDataFolderNames: []
      };
    }

    const existingCustomerName = getFolderCustomerName(matches[0].name, partNumber);
    const systemDirectory = path.join(configuredRoot, matches[0].name);
    const customerDataFolderNames = await getCustomerDataFolderNames(systemDirectory);
    return {
      success: true,
      folderName: matches[0].name,
      existingCustomerName,
      customerNameMatches:
        existingCustomerName?.toLowerCase() === customerName.toLowerCase(),
      customerDataFolderNames
    };
  } catch (error) {
    console.error('Failed to find network system folder:', error);
    return { success: false, error: `Could not find network system folder: ${error.message}` };
  }
});

ipcMain.handle('update-network-save-location', async (event, request) => {
  try {
    const serialNumber = validatePathSegment(request?.serialNumber, 'serial number');
    const partNumber = validatePathSegment(request?.partNumber, 'part number');
    const customerName = validatePathSegment(request?.customerName, 'customer name');
    const configuredRoot = getConfiguredNetworkSystemRoot(request?.configuredLocation);
    const rootStats = await fs.promises.stat(configuredRoot);
    if (!rootStats.isDirectory()) {
      throw new Error('The configured Network Save Location is not a folder.');
    }

    const expectedName = `${serialNumber}_${partNumber}_${customerName}`;
    const entries = await fs.promises.readdir(configuredRoot, { withFileTypes: true });
    const matches = getPartNumberMatches(entries, partNumber);
    if (matches.length > 1) {
      throw new Error(
        `More than one network folder matches Part Number "${partNumber}". Resolve the duplicates manually.`
      );
    }

    let systemDirectory = path.join(configuredRoot, expectedName);
    let renamed = false;
    let created = false;
    const existingFolderName = request?.existingFolderName
      ? validatePathSegment(request.existingFolderName, 'existing folder name')
      : null;
    if (existingFolderName) {
      if (matches.length !== 1 || matches[0].name.toLowerCase() !== existingFolderName.toLowerCase()) {
        throw new Error('The Part Number folder search is out of date. Search again before continuing.');
      }
      const existingCustomerName = getFolderCustomerName(existingFolderName, partNumber);
      if (!existingCustomerName) {
        throw new Error('The matching network folder does not contain a Customer Name.');
      }
      const currentDirectory = path.join(configuredRoot, existingFolderName);
      const targetDirectory = path.join(
        configuredRoot,
        `${serialNumber}_${partNumber}_${existingCustomerName}`
      );
      if (path.resolve(currentDirectory).toLowerCase() !== path.resolve(targetDirectory).toLowerCase()) {
        try {
          await fs.promises.access(targetDirectory);
          throw new Error(`The destination network folder already exists: ${targetDirectory}`);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        await fs.promises.rename(currentDirectory, targetDirectory);
        renamed = true;
      } else {
        systemDirectory = targetDirectory;
      }
      systemDirectory = targetDirectory;
    } else {
      if (matches.length > 0) {
        throw new Error('A folder matching this Part Number was found. Search again before continuing.');
      }
      await fs.promises.mkdir(systemDirectory);
      created = true;
    }

    const children = await fs.promises.readdir(systemDirectory, { withFileTypes: true });
    return {
      success: true,
      directory: systemDirectory,
      folderNames: children.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
      renamed,
      created
    };
  } catch (error) {
    console.error('Failed to update network save location:', error);
    return { success: false, error: `Could not update network save location: ${error.message}` };
  }
});

ipcMain.handle('save-motor-scan-results', async (event, request) => {
  try {
    const serialNumber = validatePathSegment(request?.serialNumber, 'serial number');
    const systemDirectory = getSystemDirectory({
      serialNumber,
      partNumber: request?.partNumber,
      customerName: request?.customerName,
      systemFolderPath: request?.systemFolderPath
    });
    const stats = await fs.promises.stat(systemDirectory);
    if (!stats.isDirectory()) throw new Error('The network system folder does not exist.');
    if (!Array.isArray(request?.entries) || request.entries.length === 0) {
      throw new Error('Scan and record at least one motor before saving results.');
    }

    const lines = [
      'Pre System Test - Motor Scan',
      `Serial Number: ${serialNumber}`,
      `Saved: ${new Date().toISOString()}`,
      ''
    ];
    request.entries.forEach((entry, index) => {
      if (
        typeof entry?.motorName !== 'string' || !entry.motorName.trim() ||
        typeof entry?.instruction !== 'string' || !entry.instruction.trim() ||
        typeof entry?.result !== 'string' || !entry.result.trim()
      ) {
        throw new Error(`Enter the motor name, instruction, and result for motor ${index + 1}.`);
      }
      lines.push(
        `${index + 1}. ${entry.motorName.trim()}`,
        `Instruction: ${entry.instruction.trim()}`,
        `Result: ${entry.result.trim()}`,
        ''
      );
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(systemDirectory, `Pre System Test Motor Scan ${timestamp}.txt`);
    await fs.promises.writeFile(filePath, `${lines.join('\r\n')}\r\n`, { flag: 'wx' });
    return { success: true, filePath };
  } catch (error) {
    console.error('Failed to save motor scan results:', error);
    return { success: false, error: `Could not save motor scan results: ${error.message}` };
  }
});

ipcMain.handle('create-system-folders', async (event, request) => {
  try {
    const systemDirectory = getSystemDirectory(request);
    const folders = [
      path.join(systemDirectory, 'Customer data', 'Reg Backup'),
      path.join(systemDirectory, 'Customer data', 'System Pictures'),
      path.join(systemDirectory, 'Internal data', 'Digital Test Sheets'),
      path.join(systemDirectory, 'Internal data', 'Extra Data')
    ];
    await Promise.all(folders.map((folder) => fs.promises.mkdir(folder, { recursive: true })));
    return { success: true, directory: systemDirectory };
  } catch (err) {
    console.error('Failed to create system folders:', err);
    return { success: false, error: `Could not create system folders: ${err.message}` };
  }
});

ipcMain.handle('create-test-sheets', async (event, request) => {
  try {
    const systemDirectory = getSystemDirectory(request);
    const system = typeof request?.system === 'string'
      ? request.system.trim().toLowerCase()
      : '';
    const supportedSystems = new Set(['invia', 'virsa', 'inlux']);
    if (!supportedSystems.has(system)) {
      return { success: false, error: 'Test sheet copying is only configured for inVia, Virsa, and inLux.' };
    }

    const masterTemplatePath = typeof request?.masterTemplatePath === 'string'
      ? request.masterTemplatePath.trim()
      : '';
    if (!masterTemplatePath || !path.isAbsolute(masterTemplatePath)) {
      return { success: false, error: 'Configure an absolute master test sheet path in Settings.' };
    }
    const sourceStats = await fs.promises.stat(masterTemplatePath);
    if (!sourceStats.isFile()) {
      return { success: false, error: 'The configured master test sheet is not a file.' };
    }

    const testAcceptanceRecordPath = typeof request?.testAcceptanceRecordPath === 'string'
      ? request.testAcceptanceRecordPath.trim()
      : '';
    const minorDeviationLogPath = typeof request?.minorDeviationLogPath === 'string'
      ? request.minorDeviationLogPath.trim()
      : '';
    if (
      !testAcceptanceRecordPath ||
      !path.isAbsolute(testAcceptanceRecordPath) ||
      !minorDeviationLogPath ||
      !path.isAbsolute(minorDeviationLogPath)
    ) {
      return {
        success: false,
        error: 'Configure absolute paths for the Test Acceptance Record and Minor Deviation Log files in Settings.'
      };
    }

    const systemRecordPrefix = system === 'inlux' ? 'inLux' : system === 'invia' ? 'InVia' : 'VIRSA';
    const configuredRecordPaths = [
      {
        path: testAcceptanceRecordPath,
        fallbackNames: [`${systemRecordPrefix} Test Acceptance Record.xlsm`]
      },
      {
        path: minorDeviationLogPath,
        fallbackNames: [
          'Minor Deviation Record.xlsm',
          `${systemRecordPrefix} Minor Deviation Record.xlsm`,
          `${systemRecordPrefix} Minor Deviation Log.xlsm`
        ]
      }
    ];
    const masterRecordPaths = [];
    for (const record of configuredRecordPaths) {
      const candidates = [
        record.path,
        ...record.fallbackNames.map((name) => path.join(path.dirname(record.path), name))
      ];
      let masterRecordPath = '';
      for (const candidatePath of candidates) {
        try {
          const recordStats = await fs.promises.stat(candidatePath);
          if (recordStats.isFile()) {
            masterRecordPath = candidatePath;
            break;
          }
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      if (!masterRecordPath) {
        return {
          success: false,
          error: `The configured master record file was not found: ${record.path}`
        };
      }
      masterRecordPaths.push(masterRecordPath);
    }

    const targetDirectory = path.join(systemDirectory, 'Internal data', 'Digital Test Sheets');
    let targetStats;
    try {
      targetStats = await fs.promises.stat(targetDirectory);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return {
          success: false,
          error: 'The Digital Test Sheets folder does not exist. Complete Create System Folders first.'
        };
      }
      throw err;
    }
    if (!targetStats.isDirectory()) {
      return { success: false, error: 'The Digital Test Sheets destination is not a folder.' };
    }

    const serialNumber = request.serialNumber.trim();
    const testSheetMetadata = request.testSheetMetadata || {};
    const requiredTestSheetValues = system === 'inlux'
      ? [
          ['customer name', testSheetMetadata.customerName],
          ['job number', testSheetMetadata.jobNumber],
          ['serial number', testSheetMetadata.serialNumber],
          ['power meter serial number', testSheetMetadata.powerMeterSerialNumber],
          ['power meter head serial number', testSheetMetadata.powerMeterHeadSerialNumber]
        ]
      : system === 'virsa'
      ? [
          ['job number', testSheetMetadata.jobNumber],
          ['customer name', testSheetMetadata.customerName],
          ['part number', testSheetMetadata.partNumber],
          ['serial number', testSheetMetadata.serialNumber],
          ['power meter serial number', testSheetMetadata.powerMeterSerialNumber],
          ['power meter head serial number', testSheetMetadata.powerMeterHeadSerialNumber]
        ]
      : [];
    if (requiredTestSheetValues.length > 0) {
      const missingValue = requiredTestSheetValues.find(
        ([, value]) => typeof value !== 'string' || !value.trim()
      );
      if (missingValue) {
        return {
          success: false,
          error: `Enter the ${system === 'inlux' ? 'inLux' : 'Virsa'} ${missingValue[0]} before creating test sheets.`
        };
      }
    }

    const targetNames = [];
    if (system === 'inlux') {
      targetNames.push(`${serialNumber}_${path.basename(masterTemplatePath)}`);
    } else {
      if (!Array.isArray(request?.combinations) || request.combinations.length === 0) {
        return { success: false, error: 'Add at least one laser and grating combination first.' };
      }
      const masterFileName = path.basename(masterTemplatePath);
      for (const combination of request.combinations) {
        const wavelength = Number(combination?.wavelengthNm);
        const gratingDensity = Number(combination?.gratingDensityLinesPerMm);
        if (
          !Number.isFinite(wavelength) ||
          wavelength <= 0 ||
          !Number.isInteger(gratingDensity) ||
          gratingDensity <= 0
        ) {
          return {
            success: false,
            error: 'Each row must have a positive wavelength and a positive whole-number grating density.'
          };
        }
        targetNames.push(
          `${serialNumber}_${wavelength}nm_${gratingDensity}_${masterFileName}`
        );
      }
    }

    const testSheetTargetPaths = [...new Set(targetNames)].map(
      (name) => path.join(targetDirectory, name)
    );
    const recordTargetPaths = [
      path.join(systemDirectory, path.basename(masterRecordPaths[0])),
      path.join(systemDirectory, path.basename(masterRecordPaths[1]))
    ];
    const targetPaths = [...testSheetTargetPaths, ...recordTargetPaths];
    const masterPaths = [masterTemplatePath, ...masterRecordPaths]
      .map((masterPath) => path.resolve(masterPath).toLowerCase());
    if (targetPaths.some((targetPath) =>
      masterPaths.includes(path.resolve(targetPath).toLowerCase())
    )) {
      return {
        success: false,
        error: 'A configured master test workbook cannot also be used as a destination file.'
      };
    }

    const cellMappings = request?.cellMappings;
    const allowedFields = [
      'jobNumber',
      'customerName',
      'partNumber',
      'serialNumber',
      'powerMeterSerialNumber',
      'powerMeterHeadSerialNumber'
    ];
    if (
      !cellMappings ||
      typeof cellMappings !== 'object' ||
      Array.isArray(cellMappings) ||
      Object.entries(cellMappings).some(([field, cell]) =>
        !allowedFields.includes(field) ||
        typeof cell !== 'string' ||
        (cell !== '' && !/^[A-Z]{1,3}[1-9]\d*$/i.test(cell))
      )
    ) {
      return {
        success: false,
        error: 'Test sheet cell mappings in Settings must use valid Excel cell references.'
      };
    }

    const conflicts = [];
    for (const targetPath of targetPaths) {
      try {
        await fs.promises.access(targetPath, fs.constants.F_OK);
        conflicts.push(targetPath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    if (conflicts.length > 0 && request.overwrite !== true) {
      return { success: false, conflicts };
    }

    for (const targetPath of conflicts) {
      await fs.promises.chmod(targetPath, 0o666);
    }

    const files = [];
    for (const targetPath of targetPaths) {
      const sheetIndex = testSheetTargetPaths.indexOf(targetPath);
      const recordIndex = recordTargetPaths.indexOf(targetPath);
      const sourcePath = sheetIndex >= 0
        ? masterTemplatePath
        : masterRecordPaths[recordIndex];
      await fs.promises.copyFile(
        sourcePath,
        targetPath,
        request.overwrite === true ? 0 : fs.constants.COPYFILE_EXCL
      );
      await fs.promises.chmod(targetPath, 0o666);
      if (sheetIndex >= 0 && (system === 'invia' || system === 'virsa' || system === 'inlux')) {
        await execFileAsync('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          path.join(__dirname, 'populateDigitalTestSheet.ps1'),
          system === 'inlux' ? 'inLux' : system === 'invia' ? 'InVia' : 'Virsa',
          targetPath,
          (testSheetMetadata.jobNumber || request.jobNumber || '').trim(),
          (testSheetMetadata.customerName || request.customerName || '').trim(),
          (testSheetMetadata.partNumber || '').trim(),
          (testSheetMetadata.serialNumber || request.serialNumber || '').trim(),
          (testSheetMetadata.powerMeterSerialNumber || '').trim(),
          (testSheetMetadata.powerMeterHeadSerialNumber || '').trim(),
          JSON.stringify(cellMappings)
        ]);
      }
      files.push(targetPath);
    }
    return { success: true, files };
  } catch (err) {
    console.error('Failed to create test sheets:', err);
    return { success: false, error: `Could not create test sheets: ${err.message}` };
  }
});

ipcMain.handle('create-laser-grating-files', async (event, request) => {
  try {
    const systemDirectory = getSystemDirectory(request);

    if (!Array.isArray(request?.combinations) || request.combinations.length === 0) {
      return { success: false, error: 'Add at least one laser and grating combination first.' };
    }

    const fileNames = new Set();
    for (const combination of request.combinations) {
      const wavelength = Number(combination?.wavelengthNm);
      const gratingDensity = Number(combination?.gratingDensityLinesPerMm);
      if (
        !Number.isFinite(wavelength) ||
        wavelength <= 0 ||
        !Number.isInteger(gratingDensity) ||
        gratingDensity <= 0
      ) {
        return {
          success: false,
          error: 'Each row must have a positive wavelength and a positive whole-number grating density.'
        };
      }
      fileNames.add(`${wavelength}nm_${gratingDensity}.txt`);
    }

    const extraDataDirectory = path.join(systemDirectory, 'Internal data', 'Extra Data');
    const targetPaths = [...fileNames].map((fileName) => path.join(extraDataDirectory, fileName));
    const conflicts = [];

    for (const targetPath of targetPaths) {
      try {
        await fs.promises.access(targetPath, fs.constants.F_OK);
        conflicts.push(targetPath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }

    if (conflicts.length > 0 && request.overwrite !== true) {
      return { success: false, conflicts };
    }

    await fs.promises.mkdir(extraDataDirectory, { recursive: true });
    for (const targetPath of targetPaths) {
      await fs.promises.writeFile(targetPath, '', {
        flag: request.overwrite === true ? 'w' : 'wx'
      });
    }

    return { success: true, files: targetPaths };
  } catch (err) {
    console.error('Failed to create laser/grating files:', err);
    return { success: false, error: `Could not create the files: ${err.message}` };
  }
});

async function handleCleanupIpc(operation, successMessage) {
  try {
    const data = await operation();
    return {
      success: true,
      data,
      message: typeof successMessage === 'function' ? successMessage(data) : successMessage
    };
  } catch (err) {
    console.error('PC cleanup action failed:', err);
    return { success: false, error: err.message || 'The PC cleanup action failed.' };
  }
}

ipcMain.handle('search-cleanup-folders', () =>
  handleCleanupIpc(() => pcCleanup.searchCleanupFolders(), 'Folder search completed.')
);

ipcMain.handle('search-archive-system-results', () =>
  handleCleanupIpc(
    () => pcCleanup.searchArchiveSystemResults(app.getPath('documents')),
    'System results search completed.'
  )
);

ipcMain.handle('archive-system-results', (event, paths) =>
  handleCleanupIpc(
    () => pcCleanup.archiveSystemResults(paths, app.getPath('documents')),
    'Selected system results moved to Documents\\Archive.'
  )
);

ipcMain.handle('delete-cleanup-folders', (event, paths) =>
  handleCleanupIpc(() => pcCleanup.deleteCleanupFolders(paths), 'Selected folders deleted.')
);

ipcMain.handle('search-cleanup-registry', () =>
  handleCleanupIpc(() => pcCleanup.searchCleanupRegistry(), 'Registry search completed.')
);

ipcMain.handle('delete-cleanup-registry', (event, paths) =>
  handleCleanupIpc(() => pcCleanup.deleteCleanupRegistry(paths), 'Selected registry keys deleted.')
);

ipcMain.handle('restore-cleanup-toolbar', async (event, request) => {
  try {
    const result = await pcCleanup.restoreCleanupToolbar(request);
    if (!result.success) return result;
    return {
      success: true,
      data: undefined,
      message: 'WiRE toolbar setting restored.'
    };
  } catch (err) {
    console.error('PC cleanup toolbar restore failed:', err);
    return { success: false, error: err.message || 'The toolbar setting could not be restored.' };
  }
});

ipcMain.handle('search-wire-uninstall-entries', () =>
  handleCleanupIpc(() => pcCleanup.searchWireUninstallEntries(), 'WiRE uninstall search completed.')
);

ipcMain.handle('kill-wire-processes', () =>
  handleCleanupIpc(
    () => pcCleanup.killWireProcesses(),
    (processNames) => processNames.length > 0
      ? `Killed: ${[...new Set(processNames)].join(', ')}`
      : 'Nothing to kill.'
  )
);

ipcMain.handle('launch-wire-uninstall', (event, registryPath) =>
  handleCleanupIpc(() => pcCleanup.launchWireUninstall(registryPath), 'Windows uninstaller started.')
);

// Automatic WiRE Key fetch.
// POSTs sn=<serial> to spd-apps using the signed-in Windows user's credentials and reads
// <p id="phrase">KEY</p> from the HTML response. Runs in the main process, so browser
// cross-origin (CORS) rules do not apply.
const WIRE_KEY_URL = 'https://spd-apps/FeaturePermissions/generate';

ipcMain.handle('fetch-wire-key', async (event, serialNumber) => {
  const cleanSn = (serialNumber || '').trim();
  if (!cleanSn) {
    return { success: false, error: 'Empty serial number provided.' };
  }

  const querySpdApps = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await net.fetch(WIRE_KEY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `sn=${encodeURIComponent(cleanSn)}`,
        credentials: 'include',
        signal: controller.signal
      });

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          authError: true,
          error: `Authentication failure (HTTP ${res.status}). Make sure you are signed in to Windows with your Renishaw account.`
        };
      }
      if (!res.ok) {
        return { success: false, error: `HTTP error ${res.status}: ${res.statusText}` };
      }

      const html = await res.text();
      const match = html.match(/<p[^>]*\bid=["']phrase["'][^>]*>([\s\S]*?)<\/p>/i);
      const key = match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
      if (!key) {
        return { success: false, missingPhrase: true, error: 'Key phrase not found in the response from spd-apps.' };
      }
      return { success: true, key, source: 'spd-apps' };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    // Attempt 1: First request establishes/negotiates NTLM/Kerberos session credentials
    let result = await querySpdApps();
    if (result.success) {
      return result;
    }

    // If <p id="phrase"> was missing/empty on initial handshake, automatically retry second request
    if (result.missingPhrase) {
      await new Promise((r) => setTimeout(r, 400));
      result = await querySpdApps();
      if (result.success) {
        return result;
      }
    }

    return result;
  } catch (err) {
    console.warn('fetch-wire-key failed:', err);
    return {
      success: false,
      error: `Network timeout: could not reach spd-apps (${err.message || 'no response'}). Check you are on the company network or VPN.`
    };
  }
});

app.whenReady().then(() => {
  setKeepAwake(true);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (app.isQuitting) {
    app.quit();
  }
});
