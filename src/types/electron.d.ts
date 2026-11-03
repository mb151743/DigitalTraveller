import {
  LaserGratingCombination,
  LaserGratingFileResult,
  SystemFolderResult,
  TestSheetResult,
  DigitalTestSheetMetadata,
  DigitalTestSheetCellMappings,
  NetworkSystemFolderSearchOperationResult,
  NetworkSaveLocationOperationResult,
  MotorScanEntry,
  MotorScanSaveResult,
  NetworkStatusResult,
  RecordCellMappings
} from './traveller';

export interface CleanupFolder {
  path: string;
  category: string;
}

export interface CleanupRegistryKey {
  path: string;
  category: string;
}

export interface WireUninstallEntry {
  registryPath: string;
  displayName: string;
  displayVersion: string;
  publisher: string;
  uninstallString: string;
  productCode: string | null;
  windowsInstaller: boolean;
}

export type CleanupResult<T = undefined> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

export type CleanupToolbarResult =
  | { success: true; data: undefined; message?: string }
  | { success: false; error: string; conflict?: false }
  | { success: false; conflict: true; message: string };

declare global {
  interface Window {
    desktopAPI?: {
      writeClipboard: (text: string) => Promise<boolean>;
      createLaserGratingFiles: (
        serialNumber: string,
        partNumber: string,
        customerName: string,
        saveLocation: string,
        combinations: LaserGratingCombination[],
        overwrite: boolean,
        systemFolderPath?: string
      ) => Promise<LaserGratingFileResult>;
      createSystemFolders: (
        serialNumber: string,
        partNumber: string,
        customerName: string,
        saveLocation: string,
        systemFolderPath?: string,
        customerDataFolderNames?: string[]
      ) => Promise<SystemFolderResult>;
      createTestSheets: (
        operation: 'prepare' | 'populate' | 'publish',
        system: string,
        serialNumber: string,
        partNumber: string,
        customerName: string,
        localSaveLocation: string,
        masterTemplatePath: string,
        testAcceptanceRecordPath: string,
        minorDeviationLogPath: string,
        networkSaveLocation: string,
        combinations: LaserGratingCombination[],
        overwrite: boolean,
        testSheetMetadata?: DigitalTestSheetMetadata,
        cellMappings?: DigitalTestSheetCellMappings,
        technicianName?: string,
        recordCellMappings?: RecordCellMappings
      ) => Promise<TestSheetResult>;
      updateNetworkSaveLocation: (
        serialNumber: string,
        partNumber: string,
        customerName: string,
        configuredLocation: string,
        existingFolderName?: string
      ) => Promise<NetworkSaveLocationOperationResult>;
      findNetworkSystemFolder: (
        partNumber: string,
        customerName: string,
        configuredLocation: string
      ) => Promise<NetworkSystemFolderSearchOperationResult>;
      saveMotorScanResults: (
        systemFolderPath: string,
        serialNumber: string,
        partNumber: string,
        customerName: string,
        entries: MotorScanEntry[]
      ) => Promise<MotorScanSaveResult>;
      checkNetworkStatus: (networkSaveLocation: string) => Promise<NetworkStatusResult>;
      loadSettingsConfig: () =>
        | { success: true; settings: Record<string, string> }
        | { success: false; error: string };
      saveSettingsConfig: (settings: Record<string, string>) =>
        | { success: true }
        | { success: false; error: string };
      selectNetworkDirectory: () => Promise<string | null>;
      selectNetworkFile: () => Promise<string | null>;
      searchCleanupFolders: () => Promise<CleanupResult<CleanupFolder[]>>;
      searchArchiveSystemResults: () => Promise<CleanupResult<CleanupFolder[]>>;
      archiveSystemResults: (paths: string[]) => Promise<CleanupResult<string[]>>;
      deleteCleanupFolders: (paths: string[]) => Promise<CleanupResult<string[]>>;
      searchCleanupRegistry: () => Promise<CleanupResult<CleanupRegistryKey[]>>;
      deleteCleanupRegistry: (paths: string[]) => Promise<CleanupResult<string[]>>;
      restoreCleanupToolbar: (
        registryPath: string,
        installDirectory: string,
        targetIndex: 0 | 1,
        overwrite: boolean
      ) => Promise<CleanupToolbarResult>;
      searchWireUninstallEntries: () => Promise<CleanupResult<WireUninstallEntry[]>>;
      killWireProcesses: () => Promise<CleanupResult<string[]>>;
      launchWireUninstall: (registryPath: string) => Promise<CleanupResult>;
    };
  }
}

export {};
