import React, { useState, useEffect } from 'react';
import {
  LaserGratingCombination,
  LaserGratingFileResult,
  SystemFolderResult,
  TestSheetResult,
  DigitalTestSheetMetadata,
  MotorScanEntry,
  MotorScanSaveResult,
  NetworkSystemFolderSearchOperationResult,
  NetworkSystemFolderSearchResult,
  NetworkSaveLocationOperationResult,
  WorkflowStep,
  StepStatus
} from '../types/traveller';
import { StorageService } from '../services/storageService';
import {
  LASER_GRATING_FILES_STEP_NAME,
  LASER_GRATING_SELECTION_STEP_NAME,
  PRE_SYSTEM_TEST_STEP_NAME,
  UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
  RECORD_SYSTEM_DETAILS_STEP_NAME,
  SAVE_WIRE_PASSWORDS_STEP_NAME,
  SYSTEM_FOLDERS_STEP_NAME,
  CREATE_TEST_SHEETS_STEP_NAME,
  parseLaserGratingCombinationFolder,
  validateLaserGratingCombinations
} from '../services/laserGratingWorkflow';
import { LaserGratingStepPanel } from './LaserGratingStepPanel';
import { DigitalTestSheetSettings } from '../services/digitalTestSheetSettingsService';
import { 
  X, CheckCircle, Clock, RotateCcw, AlertTriangle, FileText,
  CheckSquare, Square, Check, UserCheck, User, KeyRound, Briefcase, Tag, Hash,
  Plus, Trash2, Save, ScanLine, FolderOpen, Copy
} from 'lucide-react';

function normalizeTestSheetMetadata(
  metadata: DigitalTestSheetMetadata
): DigitalTestSheetMetadata {
  return {
    jobNumber: metadata.jobNumber.trim(),
    customerName: metadata.customerName.trim(),
    partNumber: metadata.partNumber.trim(),
    serialNumber: metadata.serialNumber.trim(),
    powerMeterSerialNumber: metadata.powerMeterSerialNumber.trim(),
    powerMeterHeadSerialNumber: metadata.powerMeterHeadSerialNumber.trim()
  };
}

const INLUX_TEST_SHEET_FIELDS: Array<[keyof DigitalTestSheetMetadata, string]> = [
  ['customerName', 'Customer Name'],
  ['jobNumber', 'Job Number'],
  ['serialNumber', 'Serial Number'],
  ['powerMeterSerialNumber', 'Power Meter S/N'],
  ['powerMeterHeadSerialNumber', 'Power Meter Head S/N']
];

const VIRSA_TEST_SHEET_FIELDS: Array<[keyof DigitalTestSheetMetadata, string]> = [
  ['jobNumber', 'Job Number'],
  ['customerName', 'Customer Name'],
  ['partNumber', 'Part Number'],
  ['serialNumber', 'Serial Number'],
  ['powerMeterSerialNumber', 'Power Meter S/N'],
  ['powerMeterHeadSerialNumber', 'Power Meter Head S/N']
];

const INLUX_REQUIRED_TEST_SHEET_FIELDS: Array<keyof DigitalTestSheetMetadata> = [
  'customerName',
  'jobNumber',
  'serialNumber',
  'powerMeterSerialNumber',
  'powerMeterHeadSerialNumber'
];

const VIRSA_REQUIRED_TEST_SHEET_FIELDS: Array<keyof DigitalTestSheetMetadata> = [
  'jobNumber',
  'customerName',
  'partNumber',
  'serialNumber',
  'powerMeterSerialNumber',
  'powerMeterHeadSerialNumber'
];

interface StepDialogProps {
  step: WorkflowStep | null;
  operatorName: string;
  theme: 'dark' | 'light';
  isOpen: boolean;
  onClose: () => void;
  onOpenWireKey?: () => void;
  onUpdateStatus: (stepId: string, status: StepStatus, notes?: string, technician?: string) => void;
  onToggleChecklist: (stepId: string, checklistId: string) => void;
  onUpdateMeasurement: (stepId: string, paramIndex: number, value: string) => void;
  onUpdateDetails?: (details: {
    serialNumber: string;
    customerName: string;
    jobNumber: string;
    partNumber: string;
    wirePasswords?: string[];
  }) => void;
  serialNumber: string;
  jobNumber: string;
  partNumber: string;
  customerName: string;
  saveLocation: string;
  laserGratingCombinations: LaserGratingCombination[];
  onUpdateLaserGratingCombinations: (combinations: LaserGratingCombination[]) => void;
  onCreateLaserGratingFiles: (overwrite: boolean) => Promise<LaserGratingFileResult>;
  onCreateSystemFolders: () => Promise<SystemFolderResult>;
  onFindNetworkSystemFolder: () => Promise<NetworkSystemFolderSearchOperationResult>;
  onUpdateNetworkSaveLocation: (
    existingFolderName?: string
  ) => Promise<NetworkSaveLocationOperationResult>;
  onNetworkSystemFolderUpdated: (directory: string) => void;
  onSaveMotorScanResults: (entries: MotorScanEntry[]) => Promise<MotorScanSaveResult>;
  system: string;
  onCreateTestSheets: (
    operation: 'prepare' | 'populate' | 'publish',
    overwrite: boolean,
    testSheetMetadata?: DigitalTestSheetMetadata,
    technicianName?: string
  ) => Promise<TestSheetResult>;
  digitalTestSheetSettings: DigitalTestSheetSettings;
  onSaveDigitalTestSheetSettings: (
    settings: Pick<DigitalTestSheetSettings, 'powerMeterSerialNumber' | 'powerMeterHeadSerialNumber'>
  ) => void;
}

export const StepDialog: React.FC<StepDialogProps> = (props) => {
  if (!props.isOpen || !props.step) return null;
  return <StepDialogContent {...props} step={props.step} />;
};

const StepDialogContent: React.FC<StepDialogProps & { step: WorkflowStep }> = ({
  step,
  operatorName,
  theme,
  isOpen,
  onClose,
  onOpenWireKey,
  onUpdateStatus,
  onToggleChecklist,
  onUpdateMeasurement,
  onUpdateDetails,
  serialNumber,
  jobNumber,
  partNumber,
  customerName,
  saveLocation,
  laserGratingCombinations,
  onUpdateLaserGratingCombinations,
  onCreateLaserGratingFiles,
  onCreateSystemFolders,
  onFindNetworkSystemFolder,
  onUpdateNetworkSaveLocation,
  onNetworkSystemFolderUpdated,
  onSaveMotorScanResults,
  system,
  onCreateTestSheets,
  digitalTestSheetSettings,
  onSaveDigitalTestSheetSettings
}) => {
  const [notes, setNotes] = useState(step.notes || '');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [isCreatingSystemFolders, setIsCreatingSystemFolders] = useState(false);
  const [isCreatingTestSheets, setIsCreatingTestSheets] = useState(false);
  const [isUpdatingNetworkLocation, setIsUpdatingNetworkLocation] = useState(false);
  const [isSavingMotorScan, setIsSavingMotorScan] = useState(false);
  const [hasStartedMotorScan, setHasStartedMotorScan] = useState(false);
  const [motorScanEntries, setMotorScanEntries] = useState<MotorScanEntry[]>([]);
  const [networkFolderNames, setNetworkFolderNames] = useState<string[]>([]);
  const [networkSystemFolder, setNetworkSystemFolder] = useState('');
  const [networkFolderSearch, setNetworkFolderSearch] =
    useState<NetworkSystemFolderSearchResult | null>(null);
  const [isTestSheetDataPromptOpen, setIsTestSheetDataPromptOpen] = useState(false);
  const [testSheetMetadata, setTestSheetMetadata] = useState<DigitalTestSheetMetadata>({
    jobNumber,
    customerName,
    partNumber,
    serialNumber,
    powerMeterSerialNumber: digitalTestSheetSettings.powerMeterSerialNumber,
    powerMeterHeadSerialNumber: digitalTestSheetSettings.powerMeterHeadSerialNumber
  });
  const [signoffTechnician, setSignoffTechnician] = useState(
    step.technician || operatorName || 'M. Brown'
  );
  const isLaserSelectionStep = step.name === LASER_GRATING_SELECTION_STEP_NAME;
  const isLaserFilesStep = step.name === LASER_GRATING_FILES_STEP_NAME;
  const isRecordSystemDetailsStep = step.name === RECORD_SYSTEM_DETAILS_STEP_NAME;
  const isSaveWirePasswordsStep = step.name === SAVE_WIRE_PASSWORDS_STEP_NAME;
  const isSystemFoldersStep = step.name === SYSTEM_FOLDERS_STEP_NAME;
  const isCreateTestSheetsStep = step.name === CREATE_TEST_SHEETS_STEP_NAME;
  const hasPreparedTestSheets = notes.includes('Blank test sheets copied:');
  const hasPopulatedTestSheets = notes.includes('Test workbooks populated locally:');
  const isPreSystemTestStep = step.name === PRE_SYSTEM_TEST_STEP_NAME;
  const isUpdateNetworkSaveLocationStep =
    step.name === UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME;

  const handleCopyError = async () => {
    if (!completionError) return;
    try {
      const writeClipboard = window.desktopAPI?.writeClipboard;
      if (writeClipboard) {
        await writeClipboard(completionError);
      } else {
        await navigator.clipboard.writeText(completionError);
      }
      setCopiedError(true);
      window.setTimeout(() => setCopiedError(false), 2000);
    } catch (error) {
      setCompletionError(
        `${completionError}\n\nCould not copy the error: ${
          error instanceof Error ? error.message : 'Clipboard access was denied.'
        }`
      );
    }
  };

  // Local state for inline system details inputs on the Setup procedure page
  const [localSerial, setLocalSerial] = useState(serialNumber || '');
  const [localCustomer, setLocalCustomer] = useState(customerName || '');
  const [localJob, setLocalJob] = useState(jobNumber || '');
  const [localPart, setLocalPart] = useState(partNumber || '');

  // Keep notes, technician and details synchronized when step or props change
  useEffect(() => {
    setNotes(step.notes || '');
    setSignoffTechnician(step.technician || operatorName || 'M. Brown');
    setCompletionError(null);
    setNetworkFolderNames([]);
    setNetworkSystemFolder('');
    setNetworkFolderSearch(null);
    setHasStartedMotorScan(false);
    setMotorScanEntries([]);
  }, [step.id, operatorName]);

  useEffect(() => {
    setLocalSerial(serialNumber || '');
    setLocalCustomer(customerName || '');
    setLocalJob(jobNumber || '');
    setLocalPart(partNumber || '');
    setNetworkFolderSearch(null);
    setNetworkFolderNames([]);
    setNetworkSystemFolder('');
  }, [serialNumber, customerName, jobNumber, partNumber, isOpen]);

  useEffect(() => {
    setTestSheetMetadata({
      jobNumber: jobNumber || '',
      customerName: customerName || '',
      partNumber: partNumber || '',
      serialNumber: serialNumber || '',
      powerMeterSerialNumber: digitalTestSheetSettings.powerMeterSerialNumber || '',
      powerMeterHeadSerialNumber: digitalTestSheetSettings.powerMeterHeadSerialNumber || ''
    });
  }, [
    jobNumber,
    customerName,
    partNumber,
    serialNumber,
    digitalTestSheetSettings.powerMeterSerialNumber,
    digitalTestSheetSettings.powerMeterHeadSerialNumber,
    isOpen
  ]);

  const syncDetailsIfChanged = () => {
    if (!isRecordSystemDetailsStep) return;
    const s = localSerial.trim();
    const c = localCustomer.trim();
    const j = localJob.trim();
    const p = localPart.trim();

    const prevS = (serialNumber || '').trim();
    const prevC = (customerName || '').trim();
    const prevJ = (jobNumber || '').trim();
    const prevP = (partNumber || '').trim();

    if (s !== prevS || c !== prevC || j !== prevJ || p !== prevP) {
      onUpdateDetails?.({
        serialNumber: s,
        customerName: c,
        jobNumber: j,
        partNumber: p
      });
    }
  };

  const handleSystemDetailsEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    syncDetailsIfChanged();
    const container = event.currentTarget.closest('[data-enter-navigation]');
    const inputs = Array.from(
      container?.querySelectorAll<HTMLInputElement>('input[data-enter-next]') || []
    );
    inputs[inputs.indexOf(event.currentTarget) + 1]?.focus();
  };

  const handleDetailChange = (field: 'serial' | 'customer' | 'job' | 'part', value: string) => {
    if (field === 'serial') setLocalSerial(value);
    if (field === 'customer') setLocalCustomer(value);
    if (field === 'job') setLocalJob(value);
    if (field === 'part') setLocalPart(value);
  };

  const handleStartMotorScan = () => {
    setHasStartedMotorScan(true);
    setMotorScanEntries((current) => current.length > 0
      ? current
      : [{ motorName: '', instruction: '', result: '' }]);
    setCompletionError(null);
  };

  const updateMotorScanEntry = (
    index: number,
    field: keyof MotorScanEntry,
    value: string
  ) => {
    setMotorScanEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleSaveMotorScanResults = async () => {
    setIsSavingMotorScan(true);
    setCompletionError(null);
    try {
      const result = await onSaveMotorScanResults(motorScanEntries);
      if (!result.success) {
        setCompletionError(result.error);
        return;
      }

      const report = [
        `Motor scan results saved to: ${result.filePath}`,
        ...motorScanEntries.map(
          (entry, index) =>
            `${index + 1}. ${entry.motorName.trim()} — ${entry.result.trim()}`
        )
      ].join('\n');
      setNotes(report);
      onUpdateStatus(step.id, 'Complete', report, signoffTechnician);
      onClose();
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not save motor scan results.'
      );
    } finally {
      setIsSavingMotorScan(false);
    }
  };

  const handleFindNetworkSystemFolder = async () => {
    setIsUpdatingNetworkLocation(true);
    setCompletionError(null);
    setNetworkFolderSearch(null);
    try {
      const result = await onFindNetworkSystemFolder();
      if (!result.success) {
        setCompletionError(result.error);
        return;
      }
      setNetworkFolderSearch(result);
      const searchReport = [
        `Part Number search: ${result.folderName || 'No existing folder found'}`,
        `Customer Name check: ${
          result.customerNameMatches === null
            ? 'No existing folder to check'
            : result.customerNameMatches
              ? `matched "${result.existingCustomerName}"`
              : `mismatch: folder has "${result.existingCustomerName}", System Details has "${customerName}"`
        }`,
        'Customer data folders found:',
        ...(result.customerDataFolderNames.length > 0
          ? result.customerDataFolderNames.map((name) => `- ${name}`)
          : ['- (none)'])
      ].join('\n');
      setNotes(searchReport);
      onUpdateStatus(
        step.id,
        step.status === 'Complete' ? 'In Progress' : step.status,
        searchReport,
        signoffTechnician
      );
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not find a network system folder.'
      );
    } finally {
      setIsUpdatingNetworkLocation(false);
    }
  };

  const handleUpdateNetworkSaveLocation = async () => {
    if (!networkFolderSearch) {
      setCompletionError('Complete Part 1 and find the existing folder before continuing.');
      return;
    }
    setIsUpdatingNetworkLocation(true);
    setCompletionError(null);
    try {
      const result = await onUpdateNetworkSaveLocation(
        networkFolderSearch.folderName || undefined
      );
      if (!result.success) {
        setCompletionError(result.error);
        return;
      }

      onNetworkSystemFolderUpdated(result.directory);
      setNetworkSystemFolder(result.directory);
      setNetworkFolderNames(result.folderNames);
      const importedCombinations = networkFolderSearch.customerDataFolderNames
        .map(parseLaserGratingCombinationFolder)
        .filter((combination): combination is LaserGratingCombination => combination !== null);
      if (importedCombinations.length > 0) {
        onUpdateLaserGratingCombinations(importedCombinations);
      }
      const report = [
        `Network system folder: ${result.directory}`,
        `Part Number search: ${networkFolderSearch.folderName || 'No existing folder found'}`,
        `Customer Name check: ${
          networkFolderSearch.customerNameMatches === null
            ? 'No existing folder to check'
            : networkFolderSearch.customerNameMatches
              ? `matched "${networkFolderSearch.existingCustomerName}"`
              : `mismatch: folder has "${networkFolderSearch.existingCustomerName}", System Details has "${customerName}"`
        }`,
        result.renamed
          ? 'Existing folder renamed to include the system serial number.'
          : result.created
          ? 'Created a new network system folder.'
          : 'Existing network system folder already has the correct name.',
        'Customer data folders found:',
        ...(networkFolderSearch.customerDataFolderNames.length > 0
          ? networkFolderSearch.customerDataFolderNames.map((name) => `- ${name}`)
          : ['- (none)'])
      ].join('\n');
      setNotes(report);
      onUpdateStatus(step.id, 'Complete', report, signoffTechnician);
      onClose();
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not update the network save location.'
      );
    } finally {
      setIsUpdatingNetworkLocation(false);
    }
  };

  // Press Escape on keyboard to close without completing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isTestSheetDataPromptOpen) {
          setIsTestSheetDataPromptOpen(false);
          return;
        }
        handleCloseWithoutCompleting();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    notes,
    step,
    signoffTechnician,
    localSerial,
    localCustomer,
    localJob,
    localPart,
    isTestSheetDataPromptOpen
  ]);

  const prepareTestSheets = async (): Promise<void> => {
    setIsCreatingTestSheets(true);
    setCompletionError(null);
    try {
      let result = await onCreateTestSheets('prepare', false);
      if (!result.success && 'conflicts' in result) {
        const conflicts = result.conflicts.map((file) => `• ${file}`).join('\n');
        const shouldOverwrite = window.confirm(
          `These files already exist:\n\n${conflicts}\n\nReplace them with blank copies of the master workbooks?`
        );
        if (!shouldOverwrite) {
          setCompletionError('Test sheet copying cancelled. Existing files were not changed.');
          return;
        }
        result = await onCreateTestSheets('prepare', true);
      }
      if (!result.success) {
        const partialCopies = 'files' in result && result.files?.length
          ? ` Some files were copied to ${result.files[0].replace(/[\\/][^\\/]*$/, '')}.`
          : '';
        setCompletionError(
          'error' in result
            ? `${result.error}${partialCopies}`
            : `These files still exist and were not replaced:\n${result.conflicts.join('\n')}`
        );
        return;
      }

      const sheetFiles = result.testSheetFiles || result.files;
      const report = [
        'Blank test sheets copied:',
        ...sheetFiles.map((file) => `- ${file.split(/[\\/]/).pop()}`),
        `Local staging folder: ${result.localDirectory || result.outputDirectory || 'See the configured Local Save Location.'}`,
        `Local record templates: ${result.recordDirectory || 'the local Internal data folder'}`,
        '',
        'Blank copies are editable. Run Part 2 to populate their cells, then Part 3 to publish them to the network.'
      ].join('\n');
      setNotes(report);
      onUpdateStatus(step.id, 'In Progress', report, signoffTechnician);
      setCompletionError(null);
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not copy the master test sheets.'
      );
    } finally {
      setIsCreatingTestSheets(false);
    }
  };

  const populateTestSheetsLocally = async (
    metadata?: DigitalTestSheetMetadata
  ): Promise<boolean> => {
    setIsCreatingTestSheets(true);
    try {
      const sheetMetadata = normalizeTestSheetMetadata(metadata || testSheetMetadata);
      let result = await onCreateTestSheets(
        'populate',
        false,
        sheetMetadata,
        signoffTechnician
      );
      if (!result.success) {
        const remainingFiles = 'files' in result && result.files?.length
          ? `\n\n${result.files.length} workbook(s) remain available for editing locally in:\n${result.localDirectory || result.outputDirectory || result.files[0].replace(/[\\/][^\\/]*$/, '')}`
          : '';
        setCompletionError(
          'error' in result
            ? `${result.error}${remainingFiles}`
            : `These files still exist and were not replaced:\n${result.conflicts.join('\n')}`
        );
        return false;
      }
      setCompletionError(null);
      setIsTestSheetDataPromptOpen(false);
      const report = [
        'Blank test sheets copied:',
        'Test workbooks populated locally:',
        ...result.files.map((file) => `- ${file.split(/[\\/]/).pop()}`),
        `Local staging folder: ${result.localDirectory || result.outputDirectory || 'See the configured Local Save Location.'}`,
        `Local record folder: ${result.recordDirectory || 'the local Internal data folder'}`,
        '',
        'Review the workbooks, then run Part 3 to copy them to the network.'
      ].join('\n');
      setNotes(report);
      onUpdateStatus(step.id, 'In Progress', report, signoffTechnician);
      return true;
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not create test sheets.'
      );
      return false;
    } finally {
      setIsCreatingTestSheets(false);
    }
  };

  const publishTestSheets = async (): Promise<void> => {
    if (!hasPopulatedTestSheets) {
      setCompletionError('Complete Part 2 and populate the local test sheets before publishing them.');
      return;
    }

    setIsCreatingTestSheets(true);
    setCompletionError(null);
    try {
      let result = await onCreateTestSheets('publish', false);
      if (!result.success && 'conflicts' in result) {
        const conflicts = result.conflicts.map((file) => `• ${file}`).join('\n');
        const shouldOverwrite = window.confirm(
          `These files already exist on the network:\n\n${conflicts}\n\nReplace them with the locally staged files?`
        );
        if (!shouldOverwrite) {
          setCompletionError('Publishing cancelled. Existing network files were not changed.');
          return;
        }
        result = await onCreateTestSheets('publish', true);
      }
      if (!result.success) {
        setCompletionError(
          'error' in result
            ? `${result.error}${result.localDirectory ? `\n\nThe local staged files are retained in:\n${result.localDirectory}` : ''}`
            : `These files still exist and were not replaced:\n${result.conflicts.join('\n')}`
        );
        return;
      }

      const report = [
        'Test sheets published to network:',
        ...result.files.map((file) => `- ${file.split(/[\\/]/).pop()}`),
        `Network folder: ${result.outputDirectory || 'See the configured Network Save Location.'}`,
        `Network record folder: ${result.recordDirectory || 'the system Internal data folder'}`,
        `Local copies retained in: ${result.localDirectory || 'the local staging folder'}`
      ].join('\n');
      setNotes(report);
      onUpdateStatus(step.id, 'Complete', report, signoffTechnician);
      setCompletionError(null);
      onClose();
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not publish the test sheets to the network.'
      );
    } finally {
      setIsCreatingTestSheets(false);
    }
  };

  const handleStartTestSheetPopulation = async () => {
    if (!hasPreparedTestSheets) {
      setCompletionError('Complete Part 1 and copy the blank test sheets before populating them.');
      return;
    }
    if (!serialNumber.trim()) {
      setCompletionError('Enter the traveller serial number before populating test sheets.');
      return;
    }
    const validationError = validateLaserGratingCombinations(laserGratingCombinations);
    if (validationError) {
      setCompletionError(validationError);
      return;
    }
    if (system === 'Virsa' || system === 'inLux') {
      const metadata = normalizeTestSheetMetadata(testSheetMetadata);
      const requiredFields = system === 'inLux'
        ? INLUX_REQUIRED_TEST_SHEET_FIELDS
        : VIRSA_REQUIRED_TEST_SHEET_FIELDS;
      if (requiredFields.some((field) => !metadata[field])) {
        setCompletionError(null);
        setIsTestSheetDataPromptOpen(true);
        return;
      }
      await populateTestSheetsLocally(metadata);
      return;
    }
    await populateTestSheetsLocally();
  };

  const handleSubmitTestSheetMetadata = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const metadata = normalizeTestSheetMetadata(testSheetMetadata);
    const requiredFields = system === 'inLux'
      ? INLUX_REQUIRED_TEST_SHEET_FIELDS
      : VIRSA_REQUIRED_TEST_SHEET_FIELDS;
    const missingField = requiredFields
      .map((field) => [field, metadata[field]] as const)
      .find(([, value]) => !value);
    if (missingField) {
      setCompletionError(`Enter the ${missingField[0].replace(/([A-Z])/g, ' $1').toLowerCase()}.`);
      return;
    }

    try {
      onSaveDigitalTestSheetSettings({
        powerMeterSerialNumber: metadata.powerMeterSerialNumber,
        powerMeterHeadSerialNumber: metadata.powerMeterHeadSerialNumber
      });
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not save power meter serial numbers.'
      );
      return;
    }

    setTestSheetMetadata(metadata);
    await populateTestSheetsLocally(metadata);
  };

  const handleTestSheetMetadataChange = (
    field: keyof DigitalTestSheetMetadata,
    value: string
  ) => {
    setTestSheetMetadata((current) => ({ ...current, [field]: value }));
    setCompletionError(null);
  };

  const handleMarkComplete = async () => {
    if (isCreateTestSheetsStep) {
      setCompletionError('Complete Parts 1–3 and publish the test sheets to the network before completing this step.');
      return;
    }
    if (isUpdateNetworkSaveLocationStep) {
      await handleUpdateNetworkSaveLocation();
      return;
    }
    if (isPreSystemTestStep) {
      if (!hasStartedMotorScan) {
        setCompletionError('Select Scan motors and record each motor before saving the test results.');
        return;
      }
      await handleSaveMotorScanResults();
      return;
    }
    if (isRecordSystemDetailsStep) {
      if ([localSerial, localCustomer, localJob, localPart].some((value) => !value.trim())) {
        setCompletionError(
          'Enter the serial number, customer name, job number, and part number before completing this step.'
        );
        return;
      }
      syncDetailsIfChanged();
    }
    if (isLaserSelectionStep) {
      const validationError = validateLaserGratingCombinations(laserGratingCombinations);
      if (validationError) {
        setCompletionError(validationError);
        return;
      }
    }
    if (isSystemFoldersStep) {
      setIsCreatingSystemFolders(true);
      try {
        const result = await onCreateSystemFolders();
        if (!result.success) {
          setCompletionError(result.error);
          return;
        }
      } catch (error) {
        setCompletionError(
          error instanceof Error ? error.message : 'Could not create system folders.'
        );
        return;
      } finally {
        setIsCreatingSystemFolders(false);
      }
    }
    setCompletionError(null);
    onUpdateStatus(step.id, 'Complete', notes, signoffTechnician);
    onClose();
  };

  const handleLaserFilesCreated = (files: string[]) => {
    const report = `Created files:\n${files.map((file) => file.split(/[\\/]/).pop()).join('\n')}`;
    setNotes(report);
    onUpdateStatus(step.id, 'Complete', report, signoffTechnician);
    onClose();
  };

  const handleMarkInProgress = () => {
    syncDetailsIfChanged();
    onUpdateStatus(step.id, 'In Progress', notes, signoffTechnician);
    onClose();
  };

  const handleReset = () => {
    onUpdateStatus(step.id, 'Not Started', notes, signoffTechnician);
    onClose();
  };

  const handleCloseWithoutCompleting = () => {
    syncDetailsIfChanged();
    // Preserve any notes changes without forcing completion
    if (notes !== step.notes) {
      onUpdateStatus(step.id, step.status, notes);
    }
    onClose();
  };

  const testSheetFields = system === 'inLux'
    ? INLUX_TEST_SHEET_FIELDS
    : VIRSA_TEST_SHEET_FIELDS;
  const testSheetFieldsWithCells = testSheetFields.map(([field, label]) => {
    const cell = digitalTestSheetSettings.cellMappings[system]?.[field];
    return [field, cell ? `${label} (${cell})` : label] as const;
  });

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 ${theme === 'light' ? 'step-dialog-light' : ''}`}>
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Windows Fluent Style Modal Header */}
        <div className="bg-slate-950/80 px-5 py-3 border-b border-slate-800 flex items-center justify-between select-none">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-400">
                Procedure Instructions — {step.stage}
              </span>
              <h2 className="text-sm font-semibold text-slate-100">{step.name}</h2>
            </div>
          </div>

          <button
            onClick={handleCloseWithoutCompleting}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
            title="Close Without Completing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300">
          {/* Current Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Current Status:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  step.status === 'Complete'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : step.status === 'In Progress'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {step.status}
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              {step.completedAt ? (
                <span className="text-emerald-400">Done: {new Date(step.completedAt).toLocaleString()}</span>
              ) : step.startedAt ? (
                <span className="text-amber-400">Started: {new Date(step.startedAt).toLocaleString()}</span>
              ) : (
                <span className="text-slate-500">Not started yet</span>
              )}
            </div>
          </div>

          {/* Standard Operating Instructions */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Standard Operating Instructions</span>
            </div>
            <div className="bg-slate-950/50 rounded-lg p-3.5 border border-slate-800/80 space-y-2 leading-relaxed">
              {step.instructions && step.instructions.length > 0 ? (
                step.instructions.map((inst, i) => (
                  <div key={i} className="flex items-start space-x-2.5">
                    <span className="font-mono text-blue-400 font-bold text-[11px] mt-0.5">{i + 1}.</span>
                    <span className="text-slate-300">{inst}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">No instructions specified for this workflow step.</p>
              )}
            </div>
          </div>

          {(isLaserSelectionStep || isLaserFilesStep) && (
            <LaserGratingStepPanel
              mode={isLaserSelectionStep ? 'selection' : 'files'}
              serialNumber={serialNumber}
              partNumber={partNumber}
              customerName={customerName}
              saveLocation={saveLocation}
              combinations={laserGratingCombinations}
              laserTypes={digitalTestSheetSettings.laserTypes[system] || []}
              gratingTypes={digitalTestSheetSettings.gratingTypes[system] || []}
              onChange={onUpdateLaserGratingCombinations}
              onCreateFiles={onCreateLaserGratingFiles}
              onComplete={handleLaserFilesCreated}
            />
          )}

          {isSystemFoldersStep && (
            <div className="rounded-lg border border-blue-800/70 bg-blue-950/30 p-3 text-xs text-slate-300">
              Completing this step creates the system folder and its standard Customer data and
              Internal data subfolders in the configured Save location, including the discovered
              laser/grating folders under Customer data. Probe 1 is not created at this stage.
            </div>
          )}

          {isUpdateNetworkSaveLocationStep && (
            <section className="space-y-3 rounded-lg border border-blue-800/70 bg-blue-950/30 p-4">
              <p className="text-xs text-slate-300">
                <strong>Part 1 — Find:</strong> Search by Part Number, check whether the folder&apos;s
                Customer Name matches System Details, and list laser/grating folders in Customer data.
              </p>
              <button
                type="button"
                onClick={handleFindNetworkSystemFolder}
                disabled={isUpdatingNetworkLocation}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <FolderOpen className="h-4 w-4" />
                {isUpdatingNetworkLocation ? 'Searching network folders…' : 'Find Existing Folder'}
              </button>
              {networkFolderSearch && (
                <div className="space-y-3 rounded border border-slate-700 bg-slate-950/60 p-3">
                  {networkFolderSearch.folderName ? (
                    <>
                      <p className="break-all font-mono text-[11px] text-slate-200">
                        Found: {networkFolderSearch.folderName}
                      </p>
                      <p className={`text-[11px] ${
                        networkFolderSearch.customerNameMatches
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}>
                        {networkFolderSearch.customerNameMatches
                          ? `Customer Name matches System Details (${networkFolderSearch.existingCustomerName}).`
                          : `Customer Name mismatch: folder has "${networkFolderSearch.existingCustomerName}", but System Details has "${customerName}". Part 2 will preserve the folder Customer Name and update only its Serial Number.`}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-300">
                      No existing folder matches Part Number <strong>{partNumber}</strong>.
                    </p>
                  )}
                  {networkFolderSearch.folderName && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-300">
                        Customer data folders
                      </p>
                      {networkFolderSearch.customerDataFolderNames.length > 0 ? (
                        <ul className="mt-1 list-inside list-disc space-y-1 break-all text-[11px] text-slate-400">
                          {networkFolderSearch.customerDataFolderNames.map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-500">(none)</p>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="mb-2 text-xs text-slate-300">
                      <strong>Part 2 — Rename or create:</strong>{' '}
                      {networkFolderSearch.folderName
                        ? 'Add the Serial Number to the matching folder name and import any recognized laser/grating combinations.'
                        : 'Create a new system folder.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleUpdateNetworkSaveLocation}
                      disabled={isUpdatingNetworkLocation}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <FolderOpen className="h-4 w-4" />
                      {isUpdatingNetworkLocation
                        ? 'Updating network folder…'
                        : networkFolderSearch.folderName
                          ? 'Update Serial Number'
                          : 'Create New Folder'}
                    </button>
                  </div>
                </div>
              )}
              {networkSystemFolder && (
                <div className="rounded border border-slate-700 bg-slate-950/60 p-3">
                  <p className="break-all font-mono text-[11px] text-emerald-300">{networkSystemFolder}</p>
                  <p className="mt-2 text-[11px] font-semibold text-slate-300">Folders in system folder</p>
                  {networkFolderNames.length > 0 ? (
                    <ul className="mt-1 list-inside list-disc space-y-1 text-[11px] text-slate-400">
                      {networkFolderNames.map((name) => <li key={name}>{name}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">(none)</p>
                  )}
                </div>
              )}
            </section>
          )}

          {isPreSystemTestStep && (
            <section className="space-y-3 rounded-lg border border-blue-800/70 bg-blue-950/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-100">Motor scan</h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Scan the instrument motors, then record the detected motor name, its test
                    instruction, and the result. The application does not currently have a direct
                    motor-controller discovery interface.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartMotorScan}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  <ScanLine className="h-4 w-4" />
                  Scan motors
                </button>
              </div>
              {hasStartedMotorScan && (
                <div className="space-y-3">
                  {motorScanEntries.map((entry, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 rounded border border-slate-700 bg-slate-950/60 p-3 sm:grid-cols-3">
                      <label className="space-y-1 text-[11px] text-slate-400">
                        <span>Motor name / ID</span>
                        <input
                          value={entry.motorName}
                          onChange={(event) => updateMotorScanEntry(index, 'motorName', event.target.value)}
                          placeholder="Detected motor"
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] text-slate-400">
                        <span>Test instruction</span>
                        <textarea
                          value={entry.instruction}
                          onChange={(event) => updateMotorScanEntry(index, 'instruction', event.target.value)}
                          placeholder="Instruction for this motor"
                          rows={2}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                        />
                      </label>
                      <div className="flex gap-2">
                        <label className="flex-1 space-y-1 text-[11px] text-slate-400">
                          <span>Test result</span>
                          <textarea
                            value={entry.result}
                            onChange={(event) => updateMotorScanEntry(index, 'result', event.target.value)}
                            placeholder="Pass, fail, observation…"
                            rows={2}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setMotorScanEntries((current) =>
                            current.filter((_, entryIndex) => entryIndex !== index)
                          )}
                          aria-label={`Remove motor ${index + 1}`}
                          className="self-end rounded p-2 text-slate-400 hover:bg-rose-950 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMotorScanEntries((current) => [
                      ...current,
                      { motorName: '', instruction: '', result: '' }
                    ])}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add motor
                  </button>
                </div>
              )}
            </section>
          )}

          {isCreateTestSheetsStep && (
            <section className="space-y-3 rounded-lg border border-blue-800/70 bg-blue-950/30 p-4">
              <p className="text-xs text-slate-300">
                Work locally first: Part 1 copies the record templates and one editable digital
                test workbook per laser/grating combination. Part 2 fills in all three workbook
                types; Part 3 publishes the two records to <span className="font-mono">Internal data</span>
                and digital test sheets to <span className="font-mono">Internal data\Digital Test Sheets</span>.
                Digital test sheet filenames use the format <span className="font-mono">532nm_1200</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={prepareTestSheets}
                  disabled={isCreatingTestSheets}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {isCreatingTestSheets ? 'Copying blank sheets…' : 'Part 1: Copy Blank Test Sheets'}
                </button>
                <button
                  type="button"
                  onClick={handleStartTestSheetPopulation}
                  disabled={isCreatingTestSheets || !hasPreparedTestSheets}
                  className="rounded-lg border border-emerald-500/60 bg-emerald-700/70 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingTestSheets ? 'Populating workbooks…' : 'Part 2: Populate Workbooks'}
                </button>
                <button
                  type="button"
                  onClick={publishTestSheets}
                  disabled={isCreatingTestSheets || !hasPopulatedTestSheets}
                  className="rounded-lg border border-blue-400/60 bg-blue-700/70 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingTestSheets ? 'Publishing test sheets…' : 'Part 3: Publish to Network'}
                </button>
              </div>
              {hasPreparedTestSheets && (
                <p className="text-[11px] text-emerald-300">
                  Local copies are kept even if population or network publishing fails.
                </p>
              )}
            </section>
          )}

          {isRecordSystemDetailsStep && (
            <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Record System Numbers &amp; Details
                </span>
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
                data-enter-navigation
              >
                {/* Serial Number */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-400" />
                    <span>Serial Number (S/N)</span>
                  </label>
                  <input
                    data-enter-next
                    type="text"
                    value={localSerial}
                    onChange={(e) => handleDetailChange('serial', e.target.value)}
                    onKeyDown={handleSystemDetailsEnter}
                    placeholder="e.g. 12341234"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs font-semibold text-blue-400 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Job Number */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    <span>Job Number</span>
                  </label>
                  <input
                    data-enter-next
                    type="text"
                    value={localJob}
                    onChange={(e) => handleDetailChange('job', e.target.value)}
                    onKeyDown={handleSystemDetailsEnter}
                    placeholder="e.g. 123951829431"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Part Number */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    <span>Part Number</span>
                  </label>
                  <input
                    data-enter-next
                    type="text"
                    value={localPart}
                    onChange={(e) => handleDetailChange('part', e.target.value)}
                    onKeyDown={handleSystemDetailsEnter}
                    placeholder="e.g. INVIA LONG NUMBER"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Customer Name */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>Customer Name</span>
                  </label>
                  <input
                    data-enter-next
                    type="text"
                    value={localCustomer}
                    onChange={(e) => handleDetailChange('customer', e.target.value)}
                    onKeyDown={handleSystemDetailsEnter}
                    placeholder="e.g. Spunkt Team"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </section>
          )}

          {isSaveWirePasswordsStep && (
            <section className="flex flex-col gap-3 rounded-lg border border-indigo-800/70 bg-indigo-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-100">WiRE key and passwords</h3>
                <p className="mt-1 text-[11px] text-slate-400">
                  Get and save the WiRE key here. Enter or update WiRE Passwords 1–4 in System Details.
                </p>
              </div>
              {onOpenWireKey && (
                <button
                  type="button"
                  onClick={onOpenWireKey}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-indigo-500/40 bg-indigo-600/30 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-600/50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Get WiRE Key
                </button>
              )}
            </section>
          )}

          {completionError && (
            <div
              role="alert"
              className="max-h-40 overflow-auto rounded-lg border border-rose-700/80 bg-rose-950/80 p-3 text-xs text-rose-100"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-rose-200">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Could not complete this action
                </span>
                <button
                  type="button"
                  onClick={handleCopyError}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded border border-rose-500/60 px-2 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-900"
                >
                  {copiedError ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedError ? 'Copied' : 'Copy error'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">
                {completionError}
              </pre>
            </div>
          )}

          {/* Verification Checklist */}
          {step.checklist && step.checklist.length > 0 && (
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verification Checklist</span>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800/80 divide-y divide-slate-800/60">
                {step.checklist.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onToggleChecklist(step.id, item.id)}
                    className="w-full text-left py-2 px-2.5 flex items-center space-x-3 hover:bg-slate-800/40 rounded transition-colors group"
                  >
                    {item.done ? (
                      <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-300 flex-shrink-0" />
                    )}
                    <span className={`text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Measurements / Parameter Tolerances (if applicable) */}
          {step.measuredData && step.measuredData.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">
                Metrology & Parameter Verification
              </div>
              <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/80 space-y-2">
                <div className="grid grid-cols-12 text-[10px] uppercase font-mono text-slate-500 font-semibold px-2">
                  <div className="col-span-5">Parameter</div>
                  <div className="col-span-4">Tolerance / Target</div>
                  <div className="col-span-3">Recorded Value</div>
                </div>
                {step.measuredData.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2 p-1.5 rounded bg-slate-900/60 border border-slate-800">
                    <div className="col-span-5 font-medium text-slate-200">{item.parameter}</div>
                    <div className="col-span-4 font-mono text-slate-400 text-[11px]">{item.tolerance || 'N/A'}</div>
                    <div className="col-span-3 flex items-center space-x-1">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => onUpdateMeasurement(step.id, idx, e.target.value)}
                        placeholder="Value"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-slate-500 font-mono">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Technician Sign-off Selector */}
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                Sign-off Test Technician
              </label>
              <p className="text-[11px] text-slate-400">
                Official technician identity stamped on procedure sign-off &amp; test sheet
              </p>
            </div>
            <select
              value={signoffTechnician}
              onChange={(e) => setSignoffTechnician(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-blue-300 font-semibold focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              {StorageService.getTechnicians().map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Technician Notes & Observations */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-200 uppercase tracking-wide">
              Technician Notes / Non-Conformance Details
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter calibration observations, serial components, or remarks..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-sans"
            />
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="bg-slate-950/90 px-5 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          {/* Left Actions: Reset / Status transition */}
          <div className="flex items-center space-x-2">
            {step.status !== 'Not Started' && (
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center space-x-1 transition-colors"
                title="Reset step to Not Started"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {step.status !== 'In Progress' && (
              <button
                type="button"
                onClick={handleMarkInProgress}
                className="px-3 py-1.5 rounded text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60 flex items-center space-x-1.5 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mark In Progress</span>
              </button>
            )}
          </div>

          {/* Right Actions: Close Without Completing & Mark Complete */}
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleCloseWithoutCompleting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 transition-colors"
            >
              Close Without Completing
            </button>

            {!isLaserFilesStep && !isUpdateNetworkSaveLocationStep && !isCreateTestSheetsStep && (
              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={
                  isCreatingSystemFolders ||
                  isCreatingTestSheets ||
                  isUpdatingNetworkLocation ||
                  isSavingMotorScan
                }
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center space-x-1.5 transition-all"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    {isCreatingTestSheets
                      ? 'Creating test sheets…'
                      : isUpdatingNetworkLocation
                      ? 'Updating network location…'
                      : isSavingMotorScan
                      ? 'Saving motor results…'
                      : isCreatingSystemFolders
                      ? 'Creating folders…'
                      : isSystemFoldersStep
                      ? 'Create Folders & Mark Complete'
                      : isUpdateNetworkSaveLocationStep
                      ? 'Update Network Save Location'
                      : isPreSystemTestStep
                      ? 'Save Motor Results to Network'
                      : 'Mark Complete'}
                  </span>
              </button>
            )}
          </div>
        </div>
      </div>
      {isTestSheetDataPromptOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleSubmitTestSheetMetadata}
            className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-sheet-data-title"
          >
            <h3
              id="test-sheet-data-title"
              className="text-sm font-semibold text-slate-100"
            >
              {system} Test Sheet Information
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Enter the missing details. Power meter serial numbers will be saved in Settings for future sheets.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {testSheetFieldsWithCells.map(([field, label]) => (
                <label key={field} className="space-y-1 text-[11px] text-slate-300">
                  <span>{label}</span>
                  <input
                    autoComplete="off"
                    autoFocus={
                      (field === 'partNumber' || field === 'customerName') &&
                      !testSheetMetadata[field]
                    }
                    type="text"
                    required
                    value={testSheetMetadata[field]}
                    onChange={(event) => handleTestSheetMetadataChange(field, event.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
            {completionError && (
              <div
                role="alert"
                className="mt-3 max-h-40 overflow-auto rounded-lg border border-rose-700/80 bg-rose-950/80 p-3 text-xs text-rose-100"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold text-rose-200">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    Could not complete this action
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyError}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded border border-rose-500/60 px-2 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-900"
                  >
                    {copiedError ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedError ? 'Copied' : 'Copy error'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {completionError}
                </pre>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsTestSheetDataPromptOpen(false);
                  setCompletionError(null);
                }}
                disabled={isCreatingTestSheets}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingTestSheets}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isCreatingTestSheets ? 'Creating test sheets…' : 'Save and Create Sheets'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
