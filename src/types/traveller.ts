export type SystemType = string;

export type DefaultWorkflowStage = 'Set Up' | 'Setup' | 'Calibration' | 'Final Test & Release';
export type WorkflowStage = string;

export type StepStatus = 'Not Started' | 'In Progress' | 'Complete';

export interface LaserGratingCombination {
  wavelengthNm: string;
  gratingDensityLinesPerMm: string;
  cutoffValue: string;
  pl: boolean;
}

export type LaserGratingFileResult =
  | { success: true; files: string[] }
  | { success: false; conflicts: string[] }
  | { success: false; error: string };

export type SystemFolderResult =
  | { success: true; directory: string }
  | { success: false; error: string };

export interface ConnectionCheckResult {
  success: boolean;
  message: string;
}

export interface NetworkStatusResult {
  issNetwork: ConnectionCheckResult;
  networkSaveLocation: ConnectionCheckResult;
  checkedAt: string;
}

export type TestSheetResult =
  | {
      success: true;
      files: string[];
      testSheetFiles?: string[];
      outputDirectory?: string;
      localDirectory?: string;
      recordDirectory?: string;
    }
  | { success: false; conflicts: string[] }
  | {
      success: false;
      error: string;
      files?: string[];
      outputDirectory?: string;
      localDirectory?: string;
      recordDirectory?: string;
    };

export type LocalTestSheetCleanupResult =
  | { success: true; removedFiles: string[]; missingFiles: string[] }
  | { success: false; error: string; removedFiles?: string[] };

export interface DigitalTestSheetMetadata {
  jobNumber: string;
  customerName: string;
  partNumber: string;
  serialNumber: string;
  powerMeterSerialNumber: string;
  powerMeterHeadSerialNumber: string;
}

export type DigitalTestSheetField =
  | 'jobNumber'
  | 'customerName'
  | 'partNumber'
  | 'serialNumber'
  | 'powerMeterSerialNumber'
  | 'powerMeterHeadSerialNumber'
  | 'technicianName'
  | 'currentDate'
  | 'hasPL';

export type DigitalTestSheetCellMappings = Partial<Record<DigitalTestSheetField, string>>;

export type DigitalTestSheetCellMappingsBySystem = Record<string, DigitalTestSheetCellMappings>;

export type RecordWorkbookField = Exclude<DigitalTestSheetField, 'hasPL'>;
export type RecordWorkbookCellMappings = Partial<Record<RecordWorkbookField, string>>;

export interface RecordCellMappings {
  minorDeviation: RecordWorkbookCellMappings;
  testAcceptance: RecordWorkbookCellMappings;
}

export type RecordCellMappingsBySystem = Record<string, RecordCellMappings>;

export interface MotorScanEntry {
  motorName: string;
  instruction: string;
  result: string;
}

export interface NetworkSaveLocationResult {
  success: true;
  directory: string;
  folderNames: string[];
  renamed: boolean;
  created: boolean;
}

export interface NetworkSystemFolderSearchResult {
  success: true;
  folderName: string | null;
  existingCustomerName: string | null;
  customerNameMatches: boolean | null;
  customerDataFolderNames: string[];
}

export type NetworkSystemFolderSearchOperationResult =
  | NetworkSystemFolderSearchResult
  | { success: false; error: string };

export type NetworkSaveLocationOperationResult =
  | NetworkSaveLocationResult
  | { success: false; error: string };

export type MotorScanSaveResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

export interface WorkflowStep {
  id: string;
  name: string;
  stage: WorkflowStage;
  status: StepStatus;
  completedAt?: string | null;
  startedAt?: string | null;
  technician?: string;
  instructions: string[];
  notes?: string;
  checklist?: { id: string; label: string; done: boolean }[];
  measuredData?: { parameter: string; value: string; unit: string; tolerance?: string }[];
}

export interface TravellerRecord {
  id: string;
  serialNumber: string;
  system: SystemType;
  customerName?: string;
  jobNumber?: string;
  partNumber?: string;
  wireKey?: string;
  wirePasswords?: string[];
  networkSystemFolderPath?: string;
  operatorName: string;
  createdAt: string;
  updatedAt: string;
  activeStage: WorkflowStage;
  stages?: string[];
  steps: WorkflowStep[];
  laserGratingCombinations?: LaserGratingCombination[];
  auditLog: {
    timestamp: string;
    action: string;
    stepName?: string;
    user: string;
  }[];
}

export interface SystemProfile {
  id: SystemType;
  displayName: string;
  tagline: string;
  description: string;
  laserOptions: string[];
  defaultSteps: Omit<WorkflowStep, 'id' | 'status' | 'completedAt' | 'startedAt'>[];
}
