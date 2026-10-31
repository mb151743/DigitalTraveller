import React, { useState, useEffect, useRef } from 'react';
import {
  LaserGratingCombination,
  LaserGratingFileResult,
  TravellerRecord,
  WorkflowStep,
  SystemType,
  WorkflowStage,
  StepStatus,
  SystemFolderResult,
  TestSheetResult,
  DigitalTestSheetMetadata,
  MotorScanEntry,
  MotorScanSaveResult,
  NetworkSaveLocationOperationResult
} from './types/traveller';
import { StorageService } from './services/storageService';
import { WorkflowService } from './services/workflowService';
import { WindowFrame } from './components/WindowFrame';
import { WorkflowTabs } from './components/WorkflowTabs';
import { StepList } from './components/StepList';
import { StepDialog } from './components/StepDialog';
import { TravellerSummary } from './components/TravellerSummary';
import { SystemDetailsModal } from './components/SystemDetailsModal';
import { WorkflowConfigModal } from './components/WorkflowConfigModal';
import { ConfirmModal } from './components/ConfirmModal';
import { NewTravellerModal } from './components/NewTravellerModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { WorkflowTemplateService } from './services/workflowTemplateService';
import { NetworkShareConfigService } from './services/networkShareConfigService';
import { DigitalTestSheetSettingsService } from './services/digitalTestSheetSettingsService';
import { getConfigJsonInitializationError } from './services/configJsonStorage';
import { WireKeyModal } from './components/WireKeyModal';
import { PcCleanupPanel } from './components/PcCleanupPanel';
import {
  RECORD_SYSTEM_DETAILS_STEP_INSTRUCTIONS,
  RECORD_SYSTEM_DETAILS_STEP_NAME,
  SAVE_WIRE_PASSWORDS_STEP_NAME,
  SAVE_WIRE_PASSWORDS_STEP_INSTRUCTIONS,
  UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
  UPDATE_NETWORK_SAVE_LOCATION_STEP_INSTRUCTIONS,
  SYSTEM_UNBOXING_STEP_INSTRUCTIONS,
  SYSTEM_UNBOXING_STEP_NAME,
  SYSTEM_FOLDERS_STEP_NAME,
  SYSTEM_FOLDERS_STEP_INSTRUCTIONS,
  CREATE_TEST_SHEETS_STEP_NAME,
  CREATE_TEST_SHEETS_STEP_INSTRUCTIONS,
  LASER_GRATING_SELECTION_STEP_NAME,
  PRE_SYSTEM_TEST_STEP_NAME,
  PRE_SYSTEM_TEST_STEP_INSTRUCTIONS
} from './services/laserGratingWorkflow';

export const App: React.FC = () => {
  // Theme state: 'dark' | 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('digital_traveller_theme') as 'dark' | 'light') || 'dark';
  });

  // Admin state (unlocked by selecting 'Admin' with password '520Shift')
  const [isAdmin, setIsAdmin] = useState(false);

  // Load initial traveller from localStorage or initialize defaults
  const [traveller, setTraveller] = useState<TravellerRecord>(() => {
    return StorageService.loadCurrentTraveller();
  });

  const [activeStage, setActiveStage] = useState<WorkflowStage>(() => {
    return traveller.activeStage || 'Set Up';
  });

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [isSystemDetailsModalOpen, setIsSystemDetailsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isWireKeyModalOpen, setIsWireKeyModalOpen] = useState(false);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [wireKeySerial, setWireKeySerial] = useState('');
  const [notification, setNotification] = useState<string | null>(() => {
    const configError = getConfigJsonInitializationError();
    return configError ? `Settings configuration error: ${configError}` : null;
  });

  // Left pane resizeable width state (opens at 320px by default)
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('digital_traveller_left_pane_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (Number.isFinite(val) && val >= 220 && val <= 750) {
          return val;
        }
      }
    } catch {
      // ignore
    }
    return 320;
  });
  const [isResizingLeftPane, setIsResizingLeftPane] = useState(false);

  // Resize drag event listeners
  useEffect(() => {
    if (!isResizingLeftPane) return;

    const handleMouseMove = (e: MouseEvent) => {
      const minWidth = 220;
      const maxWidth = Math.max(minWidth, Math.min(750, window.innerWidth - 300));
      const clamped = Math.max(minWidth, Math.min(maxWidth, e.clientX));
      setLeftPaneWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizingLeftPane(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeftPane]);

  // New Traveller modal state
  const [isNewTravellerConfirmOpen, setIsNewTravellerConfirmOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleConfigError = (event: Event) => {
      const { message } = (event as CustomEvent<{ message: string }>).detail;
      setNotification(`Settings could not be saved to config.json: ${message}`);
    };
    window.addEventListener('digital-traveller-config-error', handleConfigError);
    return () => window.removeEventListener('digital-traveller-config-error', handleConfigError);
  }, []);

  // Persist left pane width
  useEffect(() => {
    try {
      localStorage.setItem('digital_traveller_left_pane_width', leftPaneWidth.toString());
    } catch {
      // ignore
    }
  }, [leftPaneWidth]);

  // Sync state changes to storage
  useEffect(() => {
    StorageService.saveTraveller(traveller);
  }, [traveller]);

  // Persist theme
  useEffect(() => {
    localStorage.setItem('digital_traveller_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Auto clear notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Find currently active step
  const selectedStep = traveller.steps.find((s) => s.id === selectedStepId) || null;

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Handle stage selection
  const handleSelectStage = (stage: WorkflowStage) => {
    setIsCleanupOpen(false);
    setActiveStage(stage);
    setTraveller((prev) => ({
      ...prev,
      activeStage: stage,
      updatedAt: new Date().toISOString()
    }));
  };

  // Admin feature: Add a new blank tab
  const handleAddTab = (tabName: string) => {
    // Persist to template file store
    WorkflowTemplateService.addTabToTemplate(traveller.system, tabName);

    const existingStages = traveller.stages || ['Set Up', 'Calibration', 'Final Test & Release'];
    if (!existingStages.includes(tabName)) {
      setTraveller((prev) => ({
        ...prev,
        stages: [...(prev.stages || ['Set Up', 'Calibration', 'Final Test & Release']), tabName],
        activeStage: tabName,
        updatedAt: new Date().toISOString(),
        auditLog: [
          {
            timestamp: new Date().toISOString(),
            action: `Admin created new tab "${tabName}" (Saved to template)`,
            user: prev.operatorName
          },
          ...prev.auditLog
        ]
      }));
      setActiveStage(tabName);
      setSelectedStepId(null);
      setNotification(`Created tab "${tabName}" (Persisted)`);
    } else {
      setActiveStage(tabName);
    }
  };

  // Handle step selection from list: ONLY select the step, DO NOT open dialog
  const handleSelectStep = (step: WorkflowStep) => {
    setSelectedStepId(step.id);
  };

  // Handle step status update from dialog
  // When a task is marked complete, automatically select the next task on the list
  const handleUpdateStepStatus = (
    stepId: string,
    status: StepStatus,
    notes?: string,
    technician?: string
  ) => {
    const updated = WorkflowService.updateStepStatus(
      traveller,
      stepId,
      status,
      technician || traveller.operatorName,
      notes
    );
    setTraveller(updated);

    // Auto-select the next task in the active stage list when marked Complete
    if (status === 'Complete') {
      const stageSteps = updated.steps.filter((s) => s.stage === activeStage);
      const currentIndex = stageSteps.findIndex((s) => s.id === stepId);
      if (currentIndex !== -1 && currentIndex + 1 < stageSteps.length) {
        setSelectedStepId(stageSteps[currentIndex + 1].id);
      }
    }
  };

  // Handle checklist toggle
  const handleToggleChecklist = (stepId: string, checklistId: string) => {
    const updated = WorkflowService.toggleChecklistItem(traveller, stepId, checklistId);
    setTraveller(updated);
  };

  // Handle measurement update
  const handleUpdateMeasurement = (stepId: string, paramIndex: number, value: string) => {
    const updated = WorkflowService.updateMeasurement(traveller, stepId, paramIndex, value);
    setTraveller(updated);
  };

  // Handle new custom step addition (configurable workflows)
  const handleAddCustomStep = (stage: WorkflowStage, stepName: string, instructions: string) => {
    // Persist to template file store
    WorkflowTemplateService.addStepToTemplate(traveller.system, stage, stepName, [instructions]);
    const updated = WorkflowService.addStep(traveller, stage, stepName, instructions);
    setTraveller(updated);
    setNotification(`Step "${stepName}" added and persisted to template`);
  };

  // Handle operator change & Admin mode toggle
  const handleChangeOperator = (operatorName: string, isUserAdmin: boolean) => {
    setIsAdmin(isUserAdmin);
    StorageService.setLastActiveTechnician(operatorName);
    setTraveller((prev) => ({
      ...prev,
      operatorName,
      updatedAt: new Date().toISOString(),
      auditLog: [
        {
          timestamp: new Date().toISOString(),
          action: `Active technician set to ${operatorName}${isUserAdmin ? ' (Admin unlocked)' : ''}`,
          user: operatorName
        },
        ...prev.auditLog
      ]
    }));
    if (isUserAdmin) {
      setNotification('Admin mode active (+Add Tab & +Add Step unlocked)');
    }
  };

  // Handle reordering steps (Admin drag and drop)
  const handleReorderSteps = (reorderedSteps: WorkflowStep[]) => {
    // Persist new ordering to template file store
    WorkflowTemplateService.updateStepsOrderInTemplate(traveller.system, reorderedSteps);
    setTraveller((prev) => ({
      ...prev,
      steps: reorderedSteps,
      updatedAt: new Date().toISOString()
    }));
  };

  // Handle barcode & unit info update (Customer Name, Job Number, Part Number, Serial Number)
  const handleUpdateDetails = (details: {
    serialNumber: string;
    customerName: string;
    jobNumber: string;
    partNumber: string;
    wirePasswords?: string[];
  }) => {
    setTraveller((prev) => {
      const s = details.serialNumber.trim();
      const c = details.customerName.trim();
      const j = details.jobNumber.trim();
      const p = details.partNumber.trim();

      const prevS = (prev.serialNumber || '').trim();
      const prevC = (prev.customerName || '').trim();
      const prevJ = (prev.jobNumber || '').trim();
      const prevP = (prev.partNumber || '').trim();

      const passwords = Array.from({ length: 4 }, (_, index) =>
        (details.wirePasswords?.[index] ?? prev.wirePasswords?.[index] ?? '').trim()
      );
      if (
        s === prevS && c === prevC && j === prevJ && p === prevP &&
        JSON.stringify(passwords) === JSON.stringify(
          Array.from({ length: 4 }, (_, index) => prev.wirePasswords?.[index] || '')
        )
      ) {
        return prev;
      }

      return {
        ...prev,
        serialNumber: s,
        customerName: c,
        jobNumber: j,
        partNumber: p,
        wirePasswords: passwords,
        updatedAt: new Date().toISOString(),
        auditLog: [
          {
            timestamp: new Date().toISOString(),
            action: `Unit details updated: S/N ${s || 'Blank'}${
              c ? ` | Customer: ${c}` : ''
            }${j ? ` | Job: ${j}` : ''}${p ? ` | Part: ${p}` : ''}`,
            user: prev.operatorName
          },
          ...prev.auditLog
        ]
      };
    });
    setNotification('Hardware & unit details updated');
  };

  const handleSaveWireKey = (key: string) => {
    setTraveller((prev) => {
      const updated = { ...prev, wireKey: key, updatedAt: new Date().toISOString() };
      const saveKeyStep = prev.steps.find((step) => step.name === SAVE_WIRE_PASSWORDS_STEP_NAME);
      return saveKeyStep
        ? WorkflowService.updateStepStatus(
            updated,
            saveKeyStep.id,
            'Complete',
            prev.operatorName,
            'WiRE key saved to System Details.'
          )
        : updated;
    });
    setIsWireKeyModalOpen(false);
    setNotification('WiRE Key saved to System Details');
  };

  // Handle New Traveller click: opens confirmation modal with reset warning
  const handleNewTravellerClick = () => {
    setIsNewTravellerConfirmOpen(true);
  };

  // Confirm New Traveller creation with chosen system model
  const handleConfirmNewTraveller = (selectedSystem: SystemType) => {
    const newRec = StorageService.createNewTraveller(
      selectedSystem,
      '', // Blank S/N until entered
      '', // Blank Customer
      '', // Blank Job #
      '', // Blank Part #
      traveller.operatorName
    );
    StorageService.saveTraveller(newRec);
    setTraveller(newRec);
    // Select Tab 1 (first stage) and Step 1 (first step in that stage)
    const firstStage = (newRec.stages && newRec.stages[0]) || 'Set Up';
    setActiveStage(firstStage);
    const firstStep = newRec.steps.find((s) => s.stage === firstStage);
    setSelectedStepId(firstStep ? firstStep.id : null);
    setIsStepDialogOpen(false);
    setIsNewTravellerConfirmOpen(false);
    setNotification(`New Digital Traveller created for ${selectedSystem}.`);
  };

  // Handle Export to JSON
  const handleExportJson = () => {
    StorageService.exportToJson(traveller);
    setNotification('Saved traveller JSON file');
  };

  // Trigger file dialog for importing JSON
  const handleImportJsonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Read imported JSON file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedRecord = StorageService.importFromJsonText(content);
        setTraveller(importedRecord);
        setActiveStage(importedRecord.activeStage === 'Setup' ? 'Set Up' : (importedRecord.activeStage || 'Set Up'));
        setSelectedStepId(null);
        setNotification(`Opened traveller: ${importedRecord.system} (${importedRecord.serialNumber || 'Unassigned'})`);
      } catch (err: any) {
        setNotification(`Open failed: ${err.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
  };

  // Handle applied workflow template from Admin Settings (Load Workflows)
  const handleApplyWorkflows = (newStages: string[], newSteps: WorkflowStep[]) => {
    const isinVia = traveller.system === 'inVia';

    // Normalize incoming stages
    const normalizedStages = Array.from(new Set(
      newStages.map((st) => (st === 'Setup' ? 'Set Up' : st))
    ));
    if (!normalizedStages.includes('Set Up')) normalizedStages.unshift('Set Up');
    if (!normalizedStages.includes('Calibration')) normalizedStages.push('Calibration');
    if (!normalizedStages.includes('Final Test & Release')) normalizedStages.push('Final Test & Release');

    let normalizedSteps: WorkflowStep[] = [];

    if (isinVia) {
      const patStep = newSteps.find((s) => s.name === 'PAT Test') || {
        id: `step-${traveller.system}-pat-${Date.now().toString(36)}`,
        name: 'PAT Test',
        stage: 'Set Up',
        status: 'Not Started',
        completedAt: null,
        startedAt: null,
        technician: '',
        notes: '',
        instructions: [
          'Perform electrical safety inspection and Portable Appliance Testing (PAT).',
          'Verify earth continuity resistance (< 0.1 Ω).',
          'Measure insulation resistance (> 2 MΩ at 500V DC).',
          'Confirm touch leakage and substitute leakage current within safe limits (< 0.5 mA).',
          'Affix passed PAT test label with test date, retest period, and tester initials.'
        ],
        checklist: [
          { id: 'pat1', label: 'Visual inspection of mains lead and plug passed', done: false },
          { id: 'pat2', label: 'Earth continuity test passed (< 0.1 Ω)', done: false },
          { id: 'pat3', label: 'Insulation resistance test passed (> 2.0 MΩ at 500V DC)', done: false },
          { id: 'pat4', label: 'PAT safety pass label affixed to chassis and power supply', done: false }
        ],
        measuredData: [
          { parameter: 'Earth Continuity', value: '', unit: 'Ω', tolerance: '< 0.10 Ω' },
          { parameter: 'Insulation Resistance', value: '', unit: 'MΩ', tolerance: '> 2.0 MΩ' }
        ]
      };

      const preStep = newSteps.find((s) => s.name === PRE_SYSTEM_TEST_STEP_NAME) || {
        id: `step-${traveller.system}-pre-${Date.now().toString(36)}`,
        name: PRE_SYSTEM_TEST_STEP_NAME,
        stage: 'Set Up',
        status: 'Not Started',
        completedAt: null,
        startedAt: null,
        technician: '',
        notes: '',
        instructions: [...PRE_SYSTEM_TEST_STEP_INSTRUCTIONS],
        checklist: [],
        measuredData: []
      };
      const normalizedPreStep = {
        ...preStep,
        instructions: [...PRE_SYSTEM_TEST_STEP_INSTRUCTIONS],
        checklist: [],
        measuredData: []
      };

      const setupStep = newSteps.find(
        (s) => s.name === SYSTEM_UNBOXING_STEP_NAME || s.name === 'System & PC Unboxing & Set Up'
      ) || {
        id: `step-${traveller.system}-system-setup-${Date.now().toString(36)}`,
        name: SYSTEM_UNBOXING_STEP_NAME,
        stage: 'Set Up',
        status: 'Not Started',
        completedAt: null,
        startedAt: null,
        technician: '',
        notes: '',
        instructions: [...SYSTEM_UNBOXING_STEP_INSTRUCTIONS],
        checklist: [],
        measuredData: []
      };

      const detailsStep = newSteps.find((s) => s.name === RECORD_SYSTEM_DETAILS_STEP_NAME) || {
        id: `step-${traveller.system}-system-details-${Date.now().toString(36)}`,
        name: RECORD_SYSTEM_DETAILS_STEP_NAME,
        stage: 'Set Up',
        status: 'Not Started',
        completedAt: null,
        startedAt: null,
        technician: '',
        notes: '',
        instructions: [...RECORD_SYSTEM_DETAILS_STEP_INSTRUCTIONS],
        checklist: [],
        measuredData: []
      };
      const saveWirePasswordsStep = newSteps.find(
        (step) => step.name === SAVE_WIRE_PASSWORDS_STEP_NAME
      ) || {
        id: `step-${traveller.system}-save-wire-passwords-${Date.now().toString(36)}`,
        name: SAVE_WIRE_PASSWORDS_STEP_NAME,
        stage: 'Set Up',
        status: 'Not Started' as const,
        completedAt: null,
        startedAt: null,
        technician: '',
        notes: '',
        instructions: [...SAVE_WIRE_PASSWORDS_STEP_INSTRUCTIONS],
        checklist: [],
        measuredData: []
      };

      const folderStep = newSteps.find((s) => s.name === SYSTEM_FOLDERS_STEP_NAME) || {
        id: `step-${traveller.system}-system-folders-${Date.now().toString(36)}`,
        name: SYSTEM_FOLDERS_STEP_NAME,
        stage: 'Set Up',
        status: 'Not Started',
        completedAt: null,
        startedAt: null,
        technician: '',
        notes: '',
        instructions: [...SYSTEM_FOLDERS_STEP_INSTRUCTIONS],
        checklist: [],
        measuredData: []
      };
      const networkSaveLocationStep =
        newSteps.find((s) => s.name === UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME) || {
          id: `step-${traveller.system}-network-save-location-${Date.now().toString(36)}`,
          name: UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
          stage: 'Set Up',
          status: 'Not Started',
          completedAt: null,
          startedAt: null,
          technician: '',
          notes: '',
          instructions: [...UPDATE_NETWORK_SAVE_LOCATION_STEP_INSTRUCTIONS],
          checklist: [],
          measuredData: []
        };

      const otherSteps = newSteps.filter((s) =>
        s.name !== 'PAT Test' &&
        s.name !== PRE_SYSTEM_TEST_STEP_NAME &&
        s.name !== SYSTEM_UNBOXING_STEP_NAME &&
        s.name !== 'System & PC Unboxing & Set Up' &&
        s.name !== RECORD_SYSTEM_DETAILS_STEP_NAME &&
        s.name !== SAVE_WIRE_PASSWORDS_STEP_NAME &&
        s.name !== UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME &&
        s.name !== SYSTEM_FOLDERS_STEP_NAME
      ).map((s) => {
        let stage = s.stage === 'Setup' ? 'Set Up' : s.stage;
        if (s.name === 'Laser Beam Alignment & Safety Interlocks' || s.name === 'Grating Turret & Slit Alignment') {
          stage = 'Calibration';
        }
        if (s.name === 'Rayleigh Cut-off Filter Calibration' || s.name === 'CCD Detector Cooling & Dark Count Test') {
          stage = 'Calibration';
        }
        return { ...s, stage };
      });

      const setUpOthers = otherSteps.filter((s) => s.stage === 'Set Up');
      const calibOthers = otherSteps.filter((s) => s.stage === 'Calibration');
      const restOthers = otherSteps.filter((s) => s.stage !== 'Set Up' && s.stage !== 'Calibration');

      normalizedSteps = [
        { ...patStep, stage: 'Set Up' },
        { ...normalizedPreStep, stage: 'Set Up' },
        { ...setupStep, stage: 'Set Up', name: SYSTEM_UNBOXING_STEP_NAME },
        { ...detailsStep, stage: 'Set Up' },
        { ...saveWirePasswordsStep, stage: 'Set Up' },
        { ...networkSaveLocationStep, stage: 'Set Up' },
        { ...folderStep, stage: 'Set Up' },
        ...setUpOthers,
        ...calibOthers,
        ...restOthers
      ];
    } else {
      const setupStep = newSteps.find(
        (step) => step.name === SYSTEM_UNBOXING_STEP_NAME || step.name === 'System & PC Unboxing & Set Up'
      ) || newSteps.find((step) =>
        (step.stage === 'Set Up' || step.stage === 'Setup') &&
        step.name !== RECORD_SYSTEM_DETAILS_STEP_NAME &&
        step.name !== SYSTEM_FOLDERS_STEP_NAME
      );
      const unboxingStep: WorkflowStep = setupStep
        ? {
            ...setupStep,
            name: SYSTEM_UNBOXING_STEP_NAME,
            stage: 'Set Up',
            instructions: [
              ...setupStep.instructions,
              ...(!setupStep.instructions.some((instruction) =>
                SYSTEM_UNBOXING_STEP_INSTRUCTIONS.includes(instruction)
              ) ? SYSTEM_UNBOXING_STEP_INSTRUCTIONS : [])
            ]
          }
        : {
            id: `step-${traveller.system}-system-setup-${Date.now().toString(36)}`,
            name: SYSTEM_UNBOXING_STEP_NAME,
            stage: 'Set Up',
            status: 'Not Started',
            completedAt: null,
            startedAt: null,
            technician: '',
            notes: '',
            instructions: [...SYSTEM_UNBOXING_STEP_INSTRUCTIONS],
            checklist: [],
            measuredData: []
          };
      const existingDetailsStep = newSteps.find(
        (step) => step.name === RECORD_SYSTEM_DETAILS_STEP_NAME
      );
      const detailsStep = existingDetailsStep
        ? { ...existingDetailsStep, stage: 'Set Up' }
        : {
            id: `step-${traveller.system}-system-details-${Date.now().toString(36)}`,
            name: RECORD_SYSTEM_DETAILS_STEP_NAME,
            stage: 'Set Up',
            status: 'Not Started' as const,
            completedAt: null,
            startedAt: null,
            technician: '',
            notes: '',
            instructions: [...RECORD_SYSTEM_DETAILS_STEP_INSTRUCTIONS],
            checklist: [],
            measuredData: []
          };
      const existingSaveWirePasswordsStep = newSteps.find(
        (step) => step.name === SAVE_WIRE_PASSWORDS_STEP_NAME
      );
      const saveWirePasswordsStep = existingSaveWirePasswordsStep
        ? { ...existingSaveWirePasswordsStep, stage: 'Set Up' }
        : {
            id: `step-${traveller.system}-save-wire-passwords-${Date.now().toString(36)}`,
            name: SAVE_WIRE_PASSWORDS_STEP_NAME,
            stage: 'Set Up',
            status: 'Not Started' as const,
            completedAt: null,
            startedAt: null,
            technician: '',
            notes: '',
            instructions: [...SAVE_WIRE_PASSWORDS_STEP_INSTRUCTIONS],
            checklist: [],
            measuredData: []
          };
      const existingFolderStep = newSteps.find((step) => step.name === SYSTEM_FOLDERS_STEP_NAME);
      const existingNetworkSaveLocationStep = newSteps.find(
        (step) => step.name === UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME
      );
      const networkSaveLocationStep = existingNetworkSaveLocationStep
        ? { ...existingNetworkSaveLocationStep, stage: 'Set Up' }
        : {
            id: `step-${traveller.system}-network-save-location-${Date.now().toString(36)}`,
            name: UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
            stage: 'Set Up',
            status: 'Not Started' as const,
            completedAt: null,
            startedAt: null,
            technician: '',
            notes: '',
            instructions: [...UPDATE_NETWORK_SAVE_LOCATION_STEP_INSTRUCTIONS],
            checklist: [],
            measuredData: []
          };
      const folderStep = existingFolderStep
        ? { ...existingFolderStep, stage: 'Set Up' }
        : {
            id: `step-${traveller.system}-system-folders-${Date.now().toString(36)}`,
            name: SYSTEM_FOLDERS_STEP_NAME,
            stage: 'Set Up',
            status: 'Not Started' as const,
            completedAt: null,
            startedAt: null,
            technician: '',
            notes: '',
            instructions: [...SYSTEM_FOLDERS_STEP_INSTRUCTIONS],
            checklist: [],
            measuredData: []
          };
      normalizedSteps = [unboxingStep, detailsStep, saveWirePasswordsStep, networkSaveLocationStep, folderStep, ...newSteps.filter(
        (step) => ![
          SYSTEM_UNBOXING_STEP_NAME,
          'System & PC Unboxing & Set Up',
          RECORD_SYSTEM_DETAILS_STEP_NAME,
          SAVE_WIRE_PASSWORDS_STEP_NAME,
          UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
          SYSTEM_FOLDERS_STEP_NAME
        ].includes(step.name) && step !== setupStep
      ).map((s) => ({
        ...s,
        stage: s.stage === 'Setup' ? 'Set Up' : s.stage
      }))];
    }

    if (['inVia', 'Virsa', 'inLux'].includes(traveller.system)) {
      const selectionIndex = normalizedSteps.findIndex(
        (step) => step.name === LASER_GRATING_SELECTION_STEP_NAME
      );
      if (selectionIndex >= 0) {
        const existingIndex = normalizedSteps.findIndex(
          (step) => step.name === CREATE_TEST_SHEETS_STEP_NAME
        );
        const testSheetsStep: WorkflowStep = existingIndex >= 0
          ? {
              ...normalizedSteps.splice(existingIndex, 1)[0],
              stage: 'Calibration'
            }
          : {
              id: `step-${traveller.system}-create-test-sheets-${Date.now().toString(36)}`,
              name: CREATE_TEST_SHEETS_STEP_NAME,
              stage: 'Calibration',
              status: 'Not Started',
              completedAt: null,
              startedAt: null,
              technician: '',
              notes: '',
              instructions: [...CREATE_TEST_SHEETS_STEP_INSTRUCTIONS],
              checklist: [],
              measuredData: []
            };
        const updatedSelectionIndex = normalizedSteps.findIndex(
          (step) => step.name === LASER_GRATING_SELECTION_STEP_NAME
        );
        normalizedSteps.splice(updatedSelectionIndex + 1, 0, testSheetsStep);
      }
    }

    setTraveller((prev) => ({
      ...prev,
      stages: normalizedStages,
      steps: normalizedSteps,
      activeStage: 'Set Up',
      updatedAt: new Date().toISOString(),
      auditLog: [
        {
          timestamp: new Date().toISOString(),
          action: `Admin loaded workflow template (${normalizedSteps.length} steps across ${normalizedStages.length} tabs)`,
          user: prev.operatorName
        },
        ...prev.auditLog
      ]
    }));
    setActiveStage('Set Up');
    setSelectedStepId(null);
    setNotification(`Workflows loaded: ${normalizedSteps.length} steps across ${normalizedStages.length} tabs`);
  };

  const handleUpdateLaserGratingCombinations = (combinations: LaserGratingCombination[]) => {
    setTraveller((prev) => ({
      ...prev,
      laserGratingCombinations: combinations,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleCreateLaserGratingFiles = async (
    overwrite: boolean
  ): Promise<LaserGratingFileResult> => {
    const createFiles = window.desktopAPI?.createLaserGratingFiles;
    if (!createFiles) {
      return {
        success: false,
        error: 'Creating files is available in the Windows desktop app only.'
      };
    }

    const result = await createFiles(
      traveller.serialNumber,
      traveller.partNumber || '',
      traveller.customerName || '',
      StorageService.getSaveLocation(),
      traveller.laserGratingCombinations || [],
      overwrite,
      traveller.networkSystemFolderPath
    );
    if (result.success) {
      const directory = result.files[0]?.replace(/[\\/][^\\/]*$/, '') || '';
      setNotification(
        `Created ${result.files.length} blank file(s) in ${directory}`
      );
    }
    return result;
  };

  const handleCreateSystemFolders = async (): Promise<SystemFolderResult> => {
    const createFolders = window.desktopAPI?.createSystemFolders;
    if (!createFolders) {
      return {
        success: false,
        error: 'Creating system folders is available in the Windows desktop app only.'
      };
    }

    const result = await createFolders(
      traveller.serialNumber,
      traveller.partNumber || '',
      traveller.customerName || '',
      StorageService.getSaveLocation(),
      traveller.networkSystemFolderPath
    );
    if (result.success) {
      setNotification(`Created system folder structure in ${result.directory}`);
    }
    return result;
  };

  const handleUpdateNetworkSaveLocation =
    async (): Promise<NetworkSaveLocationOperationResult> => {
      const updateLocation = window.desktopAPI?.updateNetworkSaveLocation;
      if (!updateLocation) {
        return {
          success: false,
          error: 'Updating the network save location is available in the Windows desktop app only.'
        };
      }

      const configuredLocation = NetworkShareConfigService
        .getLocationsForSystem(traveller.system)
        .find((location) => location.category === 'Test Data Copies')?.path || '';
      return updateLocation(
        traveller.serialNumber,
        traveller.partNumber || '',
        traveller.customerName || '',
        configuredLocation
      );
    };

  const handleNetworkSystemFolderUpdated = (directory: string) => {
    setTraveller((current) => ({
      ...current,
      networkSystemFolderPath: directory,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleSaveMotorScanResults = async (
    entries: MotorScanEntry[]
  ): Promise<MotorScanSaveResult> => {
    const saveResults = window.desktopAPI?.saveMotorScanResults;
    if (!saveResults) {
      return {
        success: false,
        error: 'Saving motor scan results is available in the Windows desktop app only.'
      };
    }
    if (!traveller.networkSystemFolderPath) {
      return {
        success: false,
        error: 'Complete Update Network Save Location before saving motor scan results.'
      };
    }
    return saveResults(
      traveller.networkSystemFolderPath,
      traveller.serialNumber,
      traveller.partNumber || '',
      traveller.customerName || '',
      entries
    );
  };

  const handleCreateTestSheets = async (
    overwrite: boolean,
    testSheetMetadata?: DigitalTestSheetMetadata
  ): Promise<TestSheetResult> => {
    const createTestSheets = window.desktopAPI?.createTestSheets;
    if (!createTestSheets) {
      return {
        success: false,
        error: 'Creating test sheets is available in the Windows desktop app only.'
      };
    }

    const masterSheet = NetworkShareConfigService
      .getLocationsForSystem(traveller.system)
      .find((location) => location.category === 'Master Sheet');
    if (typeof masterSheet?.path !== 'string' || !masterSheet.path.trim()) {
      return {
        success: false,
        error: `Configure the ${traveller.system} master test sheet path in Settings.`
      };
    }
    const masterRecordsFolder = NetworkShareConfigService
      .getLocationsForSystem(traveller.system)
      .find((location) => location.category === 'Master Test Records');
    if (typeof masterRecordsFolder?.path !== 'string' || !masterRecordsFolder.path.trim()) {
      return {
        success: false,
        error: `Configure the ${traveller.system} Master Test Acceptance & Minor Deviation Records folder in Settings.`
      };
    }

    const result = await createTestSheets(
      traveller.system,
      traveller.serialNumber,
      traveller.partNumber || '',
      traveller.customerName || '',
      StorageService.getSaveLocation(),
      masterSheet.path,
      masterRecordsFolder.path,
      traveller.networkSystemFolderPath,
      traveller.laserGratingCombinations || [],
      overwrite,
      testSheetMetadata
    );
    if (result.success) {
      const recordsFile = result.files[result.files.length - 2];
      setNotification(
        `Created test sheets and copied both master records to ${recordsFile?.replace(/[\\/][^\\/]*$/, '')}`
      );
    }
    return result;
  };
  return (
    <WindowFrame
      system={traveller.system}
      serialNumber={traveller.serialNumber}
      theme={theme}
      isAdmin={isAdmin}
      onToggleTheme={handleToggleTheme}
      onOpenSettings={() => setIsAdminSettingsOpen(true)}
      onOpenConfig={() => setIsConfigModalOpen(true)}
      onExportJson={handleExportJson}
      onImportJsonClick={handleImportJsonClick}
      onNewTraveller={handleNewTravellerClick}
    >
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-4 z-50 bg-slate-900 border border-blue-500/70 text-slate-100 px-3.5 py-2 rounded-lg shadow-xl text-xs flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span>{notification}</span>
        </div>
      )}

      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Tabs Across the Top with snug metadata pills (S/N, Customer, Job, Part) & Tech selector on the right */}
      <WorkflowTabs
        currentStage={activeStage}
        traveller={traveller}
        isAdmin={isAdmin}
        theme={theme}
        onSelectStage={handleSelectStage}
        onAddTab={handleAddTab}
        onChangeOperator={handleChangeOperator}
        onOpenSystemDetails={() => setIsSystemDetailsModalOpen(true)}
        isCleanupOpen={isCleanupOpen}
        onOpenCleanup={() => {
          setIsCleanupOpen(true);
          setSelectedStepId(null);
        }}
      />

      {/* Split Window Body: Left Workflow Steps | Right Instrument Inspector & Summary */}
      {isCleanupOpen ? (
        <PcCleanupPanel theme={theme} />
      ) : (
      <div
        className={`flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden ${
          isResizingLeftPane ? 'select-none cursor-col-resize' : ''
        }`}
      >
        {/* Left Side: Workflow Steps List with Name, Status, Timestamp */}
        <StepList
          steps={traveller.steps}
          activeStage={activeStage}
          selectedStepId={selectedStepId}
          isAdmin={isAdmin}
          theme={theme}
          width={leftPaneWidth}
          onSelectStep={handleSelectStep}
          onOpenAddStep={() => setIsConfigModalOpen(true)}
          onReorderSteps={handleReorderSteps}
        />

        {/* Resizable Divider Handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingLeftPane(true);
          }}
          onDoubleClick={() => setLeftPaneWidth(320)}
          title="Drag to resize left pane (Double-click to reset to 320px)"
          role="separator"
          aria-orientation="vertical"
          className={`hidden md:flex items-center justify-center w-2 -ml-1 z-10 cursor-col-resize select-none transition-colors group flex-shrink-0 ${
            isResizingLeftPane
              ? 'bg-blue-600'
              : theme === 'dark'
              ? 'hover:bg-blue-500/40 bg-transparent'
              : 'hover:bg-blue-400/40 bg-transparent'
          }`}
        >
          {/* Subtle tactile grip line */}
          <div
            className={`h-8 w-1 rounded-full transition-colors ${
              isResizingLeftPane
                ? 'bg-white'
                : theme === 'dark'
                ? 'bg-slate-700 group-hover:bg-blue-400'
                : 'bg-slate-300 group-hover:bg-blue-500'
            }`}
          />
        </div>

        {/* Right Side: Step Details & Calibration Audit Trail */}
        <TravellerSummary
          traveller={traveller}
          selectedStep={selectedStep}
          theme={theme}
          onOpenStepDialog={(step) => {
            setSelectedStepId(step.id);
            setIsStepDialogOpen(true);
          }}
        />
      </div>
      )}

      {/* Step Instruction & Execution Modal Dialog */}
      <StepDialog
        step={selectedStep}
        operatorName={traveller.operatorName}
        theme={theme}
        isOpen={isStepDialogOpen}
        onClose={() => setIsStepDialogOpen(false)}
        onOpenWireKey={() => {
          setWireKeySerial(traveller.serialNumber);
          setIsWireKeyModalOpen(true);
        }}
        onUpdateDetails={handleUpdateDetails}
        onUpdateStatus={handleUpdateStepStatus}
        onToggleChecklist={handleToggleChecklist}
        onUpdateMeasurement={handleUpdateMeasurement}
        serialNumber={traveller.serialNumber}
        jobNumber={traveller.jobNumber || ''}
        partNumber={traveller.partNumber || ''}
        customerName={traveller.customerName || ''}
        saveLocation={StorageService.getSaveLocation()}
        laserGratingCombinations={traveller.laserGratingCombinations || []}
        onUpdateLaserGratingCombinations={handleUpdateLaserGratingCombinations}
        onCreateLaserGratingFiles={handleCreateLaserGratingFiles}
        onCreateSystemFolders={handleCreateSystemFolders}
        onUpdateNetworkSaveLocation={handleUpdateNetworkSaveLocation}
        onNetworkSystemFolderUpdated={handleNetworkSystemFolderUpdated}
        onSaveMotorScanResults={handleSaveMotorScanResults}
        system={traveller.system}
        onCreateTestSheets={handleCreateTestSheets}
        digitalTestSheetSettings={DigitalTestSheetSettingsService.get()}
        onSaveDigitalTestSheetSettings={DigitalTestSheetSettingsService.save}
      />

      {/* Barcode & Unit Details Scanner Modal Dialog */}
      <SystemDetailsModal
        isOpen={isSystemDetailsModalOpen}
        traveller={traveller}
        onClose={() => setIsSystemDetailsModalOpen(false)}
        onUpdateDetails={handleUpdateDetails}
      />

      {/* Configurable Workflow Modal Dialog */}
      <WorkflowConfigModal
        isOpen={isConfigModalOpen}
        traveller={traveller}
        onClose={() => setIsConfigModalOpen(false)}
        onAddStep={handleAddCustomStep}
      />

      {/* Settings Modal (Excel Hub with Network Locations, All-Systems Workflows & Add New System) */}
      <AdminSettingsModal
        isOpen={isAdminSettingsOpen}
        system={traveller.system}
        traveller={traveller}
        theme={theme}
        onClose={() => setIsAdminSettingsOpen(false)}
        onApplyWorkflows={handleApplyWorkflows}
        onUpdateTravellerFromExcel={(updatedRec, msg) => {
          setTraveller(updatedRec);
          setNotification(msg);
        }}
        onSystemAdded={(newSystem) => {
          setNotification(`Registered new system: "${newSystem}".`);
        }}
      />

      {/* Get WiRE Key Modal */}
      <WireKeyModal
        isOpen={isWireKeyModalOpen}
        initialSerialNumber={wireKeySerial || traveller.serialNumber}
        theme={theme}
        onClose={() => setIsWireKeyModalOpen(false)}
        onSaveKey={handleSaveWireKey}
      />

      {/* Confirmation Modal for +New Traveller */}
      {/* New Traveller Modal Dialog (Select instrument system) */}
      <NewTravellerModal
        isOpen={isNewTravellerConfirmOpen}
        currentSystem={traveller.system}
        theme={theme}
        onConfirm={handleConfirmNewTraveller}
        onCancel={() => setIsNewTravellerConfirmOpen(false)}
      />
    </WindowFrame>
  );
};

export default App;
