const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, isolated desktop APIs to the React renderer
contextBridge.exposeInMainWorld('desktopAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  minimizeToTray: () => ipcRenderer.send('window-minimize-to-tray'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),
  readNetworkFile: (filePath) => ipcRenderer.invoke('read-network-file', filePath),
  writeNetworkFile: (filePath, data) => ipcRenderer.invoke('write-network-file', { filePath, data }),
  selectNetworkDirectory: () => ipcRenderer.invoke('select-network-directory'),
  selectNetworkFile: () => ipcRenderer.invoke('select-network-file'),
  createSystemFolders: (
    serialNumber,
    partNumber,
    customerName,
    saveLocation,
    systemFolderPath,
    customerDataFolderNames
  ) =>
    ipcRenderer.invoke('create-system-folders', {
      serialNumber,
      partNumber,
      customerName,
      saveLocation,
      systemFolderPath,
      customerDataFolderNames
    }),
  createTestSheets: (
    operation,
    system,
    serialNumber,
    partNumber,
    customerName,
    localSaveLocation,
    masterTemplatePath,
    testAcceptanceRecordPath,
    minorDeviationLogPath,
    networkSaveLocation,
    combinations,
    overwrite,
    testSheetMetadata,
    cellMappings
  ) => ipcRenderer.invoke('create-test-sheets', {
    operation,
    system,
    serialNumber,
    partNumber,
    customerName,
    localSaveLocation,
    masterTemplatePath,
    testAcceptanceRecordPath,
    minorDeviationLogPath,
    networkSaveLocation,
    combinations,
    overwrite,
    testSheetMetadata,
    cellMappings
  }),
  findNetworkSystemFolder: (partNumber, customerName, configuredLocation) =>
    ipcRenderer.invoke('find-network-system-folder', {
      partNumber,
      customerName,
      configuredLocation
    }),
  updateNetworkSaveLocation: (
    serialNumber,
    partNumber,
    customerName,
    configuredLocation,
    existingFolderName
  ) =>
    ipcRenderer.invoke('update-network-save-location', {
      serialNumber,
      partNumber,
      customerName,
      configuredLocation,
      existingFolderName
    }),
  saveMotorScanResults: (systemFolderPath, serialNumber, partNumber, customerName, entries) =>
    ipcRenderer.invoke('save-motor-scan-results', {
      systemFolderPath,
      serialNumber,
      partNumber,
      customerName,
      entries
    }),
  loadSettingsConfig: () => ipcRenderer.sendSync('load-settings-config'),
  saveSettingsConfig: (settings) => ipcRenderer.sendSync('save-settings-config', settings),
  createLaserGratingFiles: (
    serialNumber,
    partNumber,
    customerName,
    saveLocation,
    combinations,
    overwrite,
    systemFolderPath
  ) => ipcRenderer.invoke('create-laser-grating-files', {
    serialNumber,
    partNumber,
    customerName,
    saveLocation,
    combinations,
    overwrite,
    systemFolderPath
  }),
  searchCleanupFolders: () => ipcRenderer.invoke('search-cleanup-folders'),
  searchArchiveSystemResults: () => ipcRenderer.invoke('search-archive-system-results'),
  archiveSystemResults: (paths) => ipcRenderer.invoke('archive-system-results', paths),
  deleteCleanupFolders: (paths) => ipcRenderer.invoke('delete-cleanup-folders', paths),
  searchCleanupRegistry: () => ipcRenderer.invoke('search-cleanup-registry'),
  deleteCleanupRegistry: (paths) => ipcRenderer.invoke('delete-cleanup-registry', paths),
  restoreCleanupToolbar: (registryPath, installDirectory, targetIndex, overwrite) =>
    ipcRenderer.invoke('restore-cleanup-toolbar', {
      registryPath,
      installDirectory,
      targetIndex,
      overwrite
    }),
  searchWireUninstallEntries: () => ipcRenderer.invoke('search-wire-uninstall-entries'),
    killWireProcesses: () => ipcRenderer.invoke('kill-wire-processes'),
    launchWireUninstall: (registryPath) =>
    ipcRenderer.invoke('launch-wire-uninstall', registryPath),
  fetchWireKey: (serialNumber) => ipcRenderer.invoke('fetch-wire-key', serialNumber),
  checkNetworkStatus: (networkSaveLocation) =>
    ipcRenderer.invoke('check-network-status', networkSaveLocation)
});
