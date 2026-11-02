import { SystemType, WorkflowStep, WorkflowStage } from '../types/traveller';
import { SYSTEM_PROFILES } from './defaultWorkflows';
import { SystemRegistryService } from './systemRegistryService';
import {
  LASER_GRATING_FILES_SAVE_INSTRUCTION,
  LASER_GRATING_SELECTION_STEP_NAME,
  LEGACY_LASER_GRATING_SELECTION_STEP_NAME,
  CREATE_TEST_SHEETS_STEP_NAME,
  CREATE_TEST_SHEETS_STEP_INSTRUCTIONS,
  PAT_TEST_STEP_NAME,
  PRE_SYSTEM_TEST_STEP_NAME,
  RECORD_SYSTEM_DETAILS_STEP_INSTRUCTIONS,
  RECORD_SYSTEM_DETAILS_STEP_NAME,
  SAVE_WIRE_PASSWORDS_STEP_INSTRUCTIONS,
  SAVE_WIRE_PASSWORDS_STEP_NAME,
  SYSTEM_UNBOXING_STEP_INSTRUCTIONS,
  SYSTEM_UNBOXING_STEP_NAME,
  LEGACY_SYSTEM_UNBOXING_STEP_NAME,
  SYSTEM_FOLDERS_STEP_NAME,
  SYSTEM_FOLDERS_STEP_INSTRUCTIONS,
  UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
  UPDATE_NETWORK_SAVE_LOCATION_STEP_INSTRUCTIONS,
  PAT_TEST_STEP_INSTRUCTIONS,
  PRE_SYSTEM_TEST_STEP_INSTRUCTIONS,
  IN_VIA_VIRSA_CALIBRATION_STEP_NAMES,
  IN_VIA_VIRSA_SETUP_STEP_NAMES,
  normalizeInViaVirsaWorkflowSteps
} from './laserGratingWorkflow';

export interface WorkflowTemplateItem {
  name: string;
  stage: WorkflowStage;
  instructions: string[];
  checklist?: { id: string; label: string; done: boolean }[];
  measuredData?: { parameter: string; value: string; unit: string; tolerance?: string }[];
}

const PAT_TEST_TEMPLATE_STEP: WorkflowTemplateItem = {
  name: PAT_TEST_STEP_NAME,
  stage: 'Set Up',
  instructions: [...PAT_TEST_STEP_INSTRUCTIONS],
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

const PRE_SYSTEM_TEST_TEMPLATE_STEP: WorkflowTemplateItem = {
  name: PRE_SYSTEM_TEST_STEP_NAME,
  stage: 'Set Up',
  instructions: [...PRE_SYSTEM_TEST_STEP_INSTRUCTIONS]
};

const SYSTEM_UNBOXING_TEMPLATE_STEP: WorkflowTemplateItem = {
  name: SYSTEM_UNBOXING_STEP_NAME,
  stage: 'Set Up',
  instructions: [...SYSTEM_UNBOXING_STEP_INSTRUCTIONS]
};

const RECORD_SYSTEM_DETAILS_TEMPLATE_STEP: WorkflowTemplateItem = {
  name: RECORD_SYSTEM_DETAILS_STEP_NAME,
  stage: 'Set Up',
  instructions: [...RECORD_SYSTEM_DETAILS_STEP_INSTRUCTIONS]
};

const SAVE_WIRE_PASSWORDS_TEMPLATE_STEP: WorkflowTemplateItem = {
  name: SAVE_WIRE_PASSWORDS_STEP_NAME,
  stage: 'Set Up',
  instructions: [...SAVE_WIRE_PASSWORDS_STEP_INSTRUCTIONS]
};

const SYSTEM_FOLDERS_TEMPLATE_STEP: WorkflowTemplateItem = {
  name: SYSTEM_FOLDERS_STEP_NAME,
  stage: 'Set Up',
  instructions: [...SYSTEM_FOLDERS_STEP_INSTRUCTIONS]
};

const UPDATE_NETWORK_SAVE_LOCATION_TEMPLATE_STEP: WorkflowTemplateItem = {
  name: UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
  stage: 'Set Up',
  instructions: [...UPDATE_NETWORK_SAVE_LOCATION_STEP_INSTRUCTIONS]
};

function ensureNetworkSaveLocationStepAfterDetails(
  steps: WorkflowTemplateItem[]
): WorkflowTemplateItem[] {
  const orderedSteps = [...steps];
  const wireStepIndex = orderedSteps.findIndex(
    (step) => step.name === SAVE_WIRE_PASSWORDS_STEP_NAME
  );
  const wireStep = wireStepIndex >= 0
    ? { ...orderedSteps.splice(wireStepIndex, 1)[0], stage: 'Set Up' }
    : SAVE_WIRE_PASSWORDS_TEMPLATE_STEP;
  const existingIndex = orderedSteps.findIndex(
    (step) => step.name === UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME
  );
  const updateStep = existingIndex >= 0
    ? { ...orderedSteps.splice(existingIndex, 1)[0], stage: 'Set Up' }
    : UPDATE_NETWORK_SAVE_LOCATION_TEMPLATE_STEP;
  const detailsIndex = orderedSteps.findIndex(
    (step) => step.name === RECORD_SYSTEM_DETAILS_STEP_NAME
  );
  const detailsStepIndex = detailsIndex >= 0 ? detailsIndex : -1;
  orderedSteps.splice(detailsStepIndex + 1, 0, wireStep);
  orderedSteps.splice(detailsStepIndex + 2, 0, updateStep);
  return orderedSteps;
}

function ensureTestSheetsStepAfterSelection(
  steps: WorkflowTemplateItem[],
  system: SystemType
): WorkflowTemplateItem[] {
  if (!['inVia', 'Virsa', 'inLux'].includes(system)) return steps;
  const selectionIndex = steps.findIndex((step) => step.name === LASER_GRATING_SELECTION_STEP_NAME);
  if (selectionIndex < 0) return steps;

  const orderedSteps = [...steps];
  const existingIndex = orderedSteps.findIndex((step) => step.name === CREATE_TEST_SHEETS_STEP_NAME);
  const testSheetsStep = existingIndex >= 0
    ? { ...orderedSteps.splice(existingIndex, 1)[0], stage: 'Calibration' }
    : {
        name: CREATE_TEST_SHEETS_STEP_NAME,
        stage: 'Calibration',
        instructions: [...CREATE_TEST_SHEETS_STEP_INSTRUCTIONS]
      };
  const updatedSelectionIndex = orderedSteps.findIndex(
    (step) => step.name === LASER_GRATING_SELECTION_STEP_NAME
  );
  orderedSteps.splice(updatedSelectionIndex + 1, 0, testSheetsStep);
  return orderedSteps;
}

function ensureSystemFoldersStepAfterSelection(
  steps: WorkflowTemplateItem[]
): WorkflowTemplateItem[] {
  const folderIndex = steps.findIndex((step) => step.name === SYSTEM_FOLDERS_STEP_NAME);
  const selectionIndex = steps.findIndex(
    (step) => step.name === LASER_GRATING_SELECTION_STEP_NAME
  );
  if (folderIndex < 0 || selectionIndex < 0 || folderIndex === selectionIndex + 1) {
    return steps.map((step) =>
      step.name === SYSTEM_FOLDERS_STEP_NAME
        ? { ...step, instructions: [...SYSTEM_FOLDERS_STEP_INSTRUCTIONS] }
        : step
    );
  }

  const orderedSteps = [...steps];
  const [folderStep] = orderedSteps.splice(folderIndex, 1);
  const updatedSelectionIndex = orderedSteps.findIndex(
    (step) => step.name === LASER_GRATING_SELECTION_STEP_NAME
  );
  orderedSteps.splice(updatedSelectionIndex + 1, 0, {
    ...folderStep,
    instructions: [...SYSTEM_FOLDERS_STEP_INSTRUCTIONS]
  });
  return orderedSteps;
}

function normalizeInViaVirsaTemplateSteps(
  steps: WorkflowTemplateItem[],
  system: SystemType
): WorkflowTemplateItem[] {
  const profileDefaults = SYSTEM_PROFILES[system]?.defaultSteps || [];
  const existingSteps = steps.map((step) => ({
    ...step,
    name: step.name === LEGACY_LASER_GRATING_SELECTION_STEP_NAME
      ? LASER_GRATING_SELECTION_STEP_NAME
      : step.name === 'Fiber Probe Head Coupling & Shutter Test'
        ? 'Fibre Probe Head Coupling & Shutter Test'
        : step.name
  }));
  const findExisting = (name: string) => existingSteps.find((step) => step.name === name);
  const findProfileDefault = (name: string) => {
    const profileStep = profileDefaults.find((step) =>
      step.name === name ||
      (name === SYSTEM_UNBOXING_STEP_NAME &&
        step.stage === 'Set Up' &&
        step.name !== PAT_TEST_STEP_NAME &&
        step.name !== PRE_SYSTEM_TEST_STEP_NAME)
    );
    return profileStep
      ? {
          name,
          stage: profileStep.stage,
          instructions: [...profileStep.instructions],
          checklist: profileStep.checklist?.map((item) => ({ ...item, done: false })),
          measuredData: profileStep.measuredData?.map((item) => ({ ...item, value: '' }))
        }
      : undefined;
  };
  const requiredDefault: Record<string, WorkflowTemplateItem> = {
    [PAT_TEST_STEP_NAME]: PAT_TEST_TEMPLATE_STEP,
    [RECORD_SYSTEM_DETAILS_STEP_NAME]: RECORD_SYSTEM_DETAILS_TEMPLATE_STEP,
    [SAVE_WIRE_PASSWORDS_STEP_NAME]: SAVE_WIRE_PASSWORDS_TEMPLATE_STEP,
    [UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME]: UPDATE_NETWORK_SAVE_LOCATION_TEMPLATE_STEP,
    [SYSTEM_FOLDERS_STEP_NAME]: SYSTEM_FOLDERS_TEMPLATE_STEP
  };
  const requiredSetupSteps = IN_VIA_VIRSA_SETUP_STEP_NAMES.map((name) => {
    const step = findExisting(name) ||
      (name === SYSTEM_UNBOXING_STEP_NAME
        ? findExisting(LEGACY_SYSTEM_UNBOXING_STEP_NAME)
        : undefined) ||
      requiredDefault[name] ||
      findProfileDefault(name);
    if (!step) {
      throw new Error(`Missing default workflow step "${name}" for ${system}.`);
    }
    return {
      ...step,
      name,
      stage: 'Set Up',
      ...(name === SYSTEM_FOLDERS_STEP_NAME
        ? { instructions: [...SYSTEM_FOLDERS_STEP_INSTRUCTIONS] }
        : {})
    };
  });
  const preSystemTestStep = system === 'inVia'
    ? {
        ...(findExisting(PRE_SYSTEM_TEST_STEP_NAME) || PRE_SYSTEM_TEST_TEMPLATE_STEP),
        stage: 'Set Up',
        instructions: [...PRE_SYSTEM_TEST_STEP_INSTRUCTIONS],
        checklist: [],
        measuredData: []
      }
    : undefined;

  const requiredCalibrationSteps = IN_VIA_VIRSA_CALIBRATION_STEP_NAMES.flatMap((name) => {
    const step = findExisting(name) || findProfileDefault(name);
    return step ? [{ ...step, name, stage: 'Calibration' }] : [];
  });
  const requiredNames = new Set([
    ...IN_VIA_VIRSA_SETUP_STEP_NAMES,
    ...IN_VIA_VIRSA_CALIBRATION_STEP_NAMES,
    ...(system === 'inVia' ? [PRE_SYSTEM_TEST_STEP_NAME] : []),
    LEGACY_SYSTEM_UNBOXING_STEP_NAME
  ]);
  const additionalSteps = existingSteps.filter((step) => !requiredNames.has(step.name));
  const existingCalibrationNames = new Set(
    existingSteps.map((step) => step.name)
  );
  const missingCalibrationSteps = requiredCalibrationSteps.filter(
    (step) => !existingCalibrationNames.has(step.name)
  );

  return normalizeInViaVirsaWorkflowSteps([
    ...requiredSetupSteps,
    ...(preSystemTestStep ? [preSystemTestStep] : []),
    ...additionalSteps,
    ...missingCalibrationSteps
  ]);
}

export interface WorkflowTemplate {
  system: SystemType;
  stages: string[];
  steps: WorkflowTemplateItem[];
  version: string;
  lastUpdated: string;
}

export interface MultiSystemWorkflowBundle {
  version: string;
  exportedAt: string;
  systems: Record<string, WorkflowTemplate>;
}

const TEMPLATE_STORAGE_PREFIX = 'digital_traveller_workflow_template_';

export class WorkflowTemplateService {
  /**
   * Get the active workflow template for a system model.
   * If an admin has added custom tabs or steps, they are loaded from persistent storage.
   * Otherwise, the base defaults are initialized and saved.
   */
  static getTemplate(system: SystemType): WorkflowTemplate {
    const normalizedSystem: SystemType = (system as string).toLowerCase() === 'invia' ? 'inVia' : system;
    const storageKey = `${TEMPLATE_STORAGE_PREFIX}${normalizedSystem}`;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as WorkflowTemplate;
        if (parsed && Array.isArray(parsed.stages) && Array.isArray(parsed.steps)) {
          // Normalize stage names: change 'Setup' to 'Set Up'
          const stages = Array.from(new Set(parsed.stages.map((st) => (st === 'Setup' ? 'Set Up' : st))));
          if (!stages.includes('Set Up')) stages.unshift('Set Up');
          if (!stages.includes('Calibration')) stages.push('Calibration');
          if (!stages.includes('Final Test & Release')) stages.push('Final Test & Release');

          const steps = parsed.steps.map((s) => ({
            ...s,
            stage: s.stage === 'Setup' ? 'Set Up' : s.stage,
            name: s.name === LEGACY_LASER_GRATING_SELECTION_STEP_NAME
              ? LASER_GRATING_SELECTION_STEP_NAME
              : s.name === LEGACY_SYSTEM_UNBOXING_STEP_NAME
                ? SYSTEM_UNBOXING_STEP_NAME
                : s.name,
            ...(s.name === PRE_SYSTEM_TEST_STEP_NAME
              ? {
                  instructions: [...PRE_SYSTEM_TEST_STEP_INSTRUCTIONS],
                  checklist: [],
                  measuredData: []
                }
              : {})
          }));

          const isInViaOrVirsa = normalizedSystem === 'inVia' || normalizedSystem === 'Virsa';
          const normalizedSteps = isInViaOrVirsa
            ? normalizeInViaVirsaTemplateSteps(steps, normalizedSystem)
            : ensureSystemFoldersStepAfterSelection(
                ensureNetworkSaveLocationStepAfterDetails(
                  ensureTestSheetsStepAfterSelection(steps, normalizedSystem)
                )
              );
          const updatedTemplate: WorkflowTemplate = {
            ...parsed,
            system: normalizedSystem,
            stages,
            steps: normalizedSteps,
            version: isInViaOrVirsa ? '2.5.0' : parsed.version,
            lastUpdated: parsed.lastUpdated || new Date().toISOString()
          };
          if (
            (isInViaOrVirsa && parsed.version !== '2.5.0') ||
            JSON.stringify(parsed.steps) !== JSON.stringify(normalizedSteps)
          ) {
            this.saveTemplate(updatedTemplate);
          }
          return updatedTemplate;
        }
      }
    } catch (e) {
      console.warn(`Failed to read workflow template for ${normalizedSystem}`, e);
    }

    // Default template extraction from system profile or generic template for new systems
    const profile = SYSTEM_PROFILES[normalizedSystem];
    const defaultStages = profile?.defaultSteps
      ? Array.from(new Set(profile.defaultSteps.map((s) => s.stage)))
      : ['Set Up', 'Calibration', 'Final Test & Release'];

    let defaultSteps: WorkflowTemplateItem[] = [];
    if (profile && profile.defaultSteps) {
      const isinVia = normalizedSystem === 'inVia';
      if (isinVia) {
        // Build inVia steps exactly as required
        const baseSteps = profile.defaultSteps.map((s) => ({
          name: s.name,
          stage: s.stage,
          instructions: [...s.instructions],
          checklist: s.checklist ? s.checklist.map((c) => ({ ...c, done: false })) : [],
          measuredData: s.measuredData ? s.measuredData.map((m) => ({ ...m, value: '' })) : []
        }));

        const patStep = baseSteps.find((s) => s.name === PAT_TEST_STEP_NAME) || PAT_TEST_TEMPLATE_STEP;
        const preSysStep = baseSteps.find((s) => s.name === PRE_SYSTEM_TEST_STEP_NAME) || PRE_SYSTEM_TEST_TEMPLATE_STEP;
        const setupStep = baseSteps.find((s) => s.name === SYSTEM_UNBOXING_STEP_NAME) || SYSTEM_UNBOXING_TEMPLATE_STEP;

        const otherSteps = baseSteps.filter((s) =>
          s.name !== PAT_TEST_STEP_NAME &&
          s.name !== PRE_SYSTEM_TEST_STEP_NAME &&
          s.name !== SYSTEM_UNBOXING_STEP_NAME
        );

        defaultSteps = [
          patStep,
          preSysStep,
          setupStep,
          RECORD_SYSTEM_DETAILS_TEMPLATE_STEP,
          SAVE_WIRE_PASSWORDS_TEMPLATE_STEP,
          UPDATE_NETWORK_SAVE_LOCATION_TEMPLATE_STEP,
          ...otherSteps
        ];
        const laserSelectionIndex = defaultSteps.findIndex(
          (step) => step.name === LASER_GRATING_SELECTION_STEP_NAME
        );
        if (laserSelectionIndex >= 0) {
          defaultSteps.splice(laserSelectionIndex + 1, 0, SYSTEM_FOLDERS_TEMPLATE_STEP);
        } else {
          defaultSteps.push(SYSTEM_FOLDERS_TEMPLATE_STEP);
        }
      } else {
        defaultSteps = profile.defaultSteps.map((s) => ({
          name: s.name,
          stage: s.stage,
          instructions: [...s.instructions],
          checklist: s.checklist ? s.checklist.map((c) => ({ ...c, done: false })) : [],
          measuredData: s.measuredData ? s.measuredData.map((m) => ({ ...m, value: '' })) : []
        }));
        const firstSetupIndex = defaultSteps.findIndex((step) => step.stage === 'Set Up' || step.stage === 'Setup');
        const initialSetupStep = firstSetupIndex >= 0
          ? defaultSteps.splice(firstSetupIndex, 1)[0]
          : SYSTEM_UNBOXING_TEMPLATE_STEP;
        defaultSteps.unshift(
          {
            ...initialSetupStep,
            name: SYSTEM_UNBOXING_STEP_NAME,
            stage: 'Set Up',
            instructions: [
              ...initialSetupStep.instructions,
              ...SYSTEM_UNBOXING_STEP_INSTRUCTIONS
            ]
          },
          RECORD_SYSTEM_DETAILS_TEMPLATE_STEP,
          SAVE_WIRE_PASSWORDS_TEMPLATE_STEP,
          UPDATE_NETWORK_SAVE_LOCATION_TEMPLATE_STEP
        );
        const laserSelectionIndex = defaultSteps.findIndex(
          (step) => step.name === LASER_GRATING_SELECTION_STEP_NAME
        );
        if (laserSelectionIndex >= 0) {
          defaultSteps.splice(laserSelectionIndex + 1, 0, SYSTEM_FOLDERS_TEMPLATE_STEP);
        } else {
          defaultSteps.push(SYSTEM_FOLDERS_TEMPLATE_STEP);
        }
      }
    } else {
      // Default placeholder workflows for newly created custom systems
      defaultSteps = [
        {
          ...SYSTEM_UNBOXING_TEMPLATE_STEP,
          name: SYSTEM_UNBOXING_STEP_NAME,
          stage: 'Set Up',
          instructions: [
            `Verify ${normalizedSystem} baseplate and chassis integrity.`,
            'Confirm electrical grounding and safety interlock loop continuity.',
            'Record environment temperature (20°C ± 1°C) and cleanroom status.',
            ...SYSTEM_UNBOXING_STEP_INSTRUCTIONS
          ],
          checklist: [
            { id: 'c1', label: 'Chassis unboxing inspection complete', done: false },
            { id: 'c2', label: 'Earth ground resistance < 0.1 Ohm verified', done: false }
          ]
        },
        RECORD_SYSTEM_DETAILS_TEMPLATE_STEP,
        UPDATE_NETWORK_SAVE_LOCATION_TEMPLATE_STEP,
        SYSTEM_FOLDERS_TEMPLATE_STEP,
        {
          name: `${normalizedSystem} Optical & Sensor Calibration`,
          stage: 'Calibration',
          instructions: [
            'Align laser source with entrance aperture.',
            'Execute standard silicon reference peak verification (520.7 cm⁻¹).',
            'Log detector sensitivity and background noise level.'
          ],
          checklist: [
            { id: 'c3', label: 'Reference peak alignment passed', done: false }
          ],
          measuredData: [
            { parameter: 'Calibration Peak Center', value: '', unit: 'cm⁻¹', tolerance: '520.70 ± 0.10' },
            { parameter: 'Signal Intensity', value: '', unit: 'cts/sec', tolerance: '> 50,000' }
          ]
        },
        {
          name: `${normalizedSystem} Final Test Acceptance & Quality Sign-Off`,
          stage: 'Final Test & Release',
          instructions: [
            'Complete full system automated diagnostic run.',
            'Verify all test acceptance criteria and minor deviation records.',
            'Affix quality hologram seal and generate signed certificate of conformity.'
          ],
          checklist: [
            { id: 'c4', label: 'All test sheets and parameters confirmed', done: false },
            { id: 'c5', label: 'QA acceptance sign-off recorded', done: false }
          ]
        }
      ];
    }

    if (normalizedSystem === 'inVia' || normalizedSystem === 'Virsa') {
      defaultSteps = normalizeInViaVirsaTemplateSteps(defaultSteps, normalizedSystem);
    }

    const initialTemplate: WorkflowTemplate = {
      system: normalizedSystem,
      stages: defaultStages,
      steps: defaultSteps,
      version: '2.5.0',
      lastUpdated: new Date().toISOString()
    };

    this.saveTemplate(initialTemplate);
    return initialTemplate;
  }

  /**
   * Save workflow template to persistent storage
   */
  static saveTemplate(template: WorkflowTemplate): void {
    const normalizedSystem: SystemType = (template.system as string).toLowerCase() === 'invia' ? 'inVia' : template.system;
    const storageKey = `${TEMPLATE_STORAGE_PREFIX}${normalizedSystem}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        ...template,
        system: normalizedSystem,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.error(`Failed to save workflow template for ${normalizedSystem}`, e);
    }
  }

  /**
   * Add a new workflow stage/tab to the persistent template
   */
  static addTabToTemplate(system: SystemType, tabName: string): WorkflowTemplate {
    const template = this.getTemplate(system);
    if (!template.stages.includes(tabName)) {
      template.stages.push(tabName);
      this.saveTemplate(template);
    }
    return template;
  }

  /**
   * Add a new workflow step to the persistent template
   */
  static addStepToTemplate(
    system: SystemType,
    stage: string,
    stepName: string,
    instructions: string[]
  ): WorkflowTemplate {
    const template = this.getTemplate(system);
    if (!template.stages.includes(stage)) {
      template.stages.push(stage);
    }
    template.steps.push({
      name: stepName,
      stage,
      instructions,
      checklist: [{ id: `chk-${Date.now()}`, label: 'Verify procedure completed', done: false }]
    });
    this.saveTemplate(template);
    return template;
  }

  /**
   * Update the ordering of steps in the persistent template
   */
  static updateStepsOrderInTemplate(system: SystemType, activeSteps: WorkflowStep[]): void {
    const template = this.getTemplate(system);
    const templateSteps: WorkflowTemplateItem[] = activeSteps.map((s) => ({
      name: s.name,
      stage: s.stage,
      instructions: [...s.instructions],
      checklist: s.checklist ? s.checklist.map((c) => ({ ...c, done: false })) : [],
      measuredData: s.measuredData ? s.measuredData.map((m) => ({ ...m, value: '' })) : []
    }));

    template.steps = templateSteps;
    this.saveTemplate(template);
  }

  /**
   * Export ALL systems workflows in ONE single unified JSON file
   */
  static exportAllSystemsBundle(activeTravellerForCurrentSystem?: { system: SystemType; stages: string[]; steps: WorkflowStep[] }): void {
    const systems = SystemRegistryService.getSystems();
    const bundle: MultiSystemWorkflowBundle = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      systems: {}
    };

    systems.forEach((sys) => {
      // If caller provided current live traveler snapshot for this system, prefer it to capture latest edits
      if (activeTravellerForCurrentSystem && activeTravellerForCurrentSystem.system === sys) {
        bundle.systems[sys] = {
          system: sys,
          stages: [...activeTravellerForCurrentSystem.stages],
          steps: activeTravellerForCurrentSystem.steps.map((s) => ({
            name: s.name,
            stage: s.stage,
            instructions: [...s.instructions],
            checklist: s.checklist ? s.checklist.map((c) => ({ ...c, done: false })) : [],
            measuredData: s.measuredData ? s.measuredData.map((m) => ({ ...m, value: '' })) : []
          })),
          version: '2.0.0',
          lastUpdated: new Date().toISOString()
        };
      } else {
        bundle.systems[sys] = this.getTemplate(sys);
      }
    });

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Renishaw_All_Systems_Workflows_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  /**
   * Import all workflows from a single unified JSON file (supports single or multi-system bundle)
   */
  static importAllSystemsBundle(jsonText: string): { importedSystems: string[]; totalStepsCount: number } {
    const parsed = JSON.parse(jsonText);
    const importedSystems: string[] = [];
    let totalStepsCount = 0;

    // Case 1: Multi-system bundle { systems: { inVia: {...}, Virsa: {...} } }
    if (parsed.systems && typeof parsed.systems === 'object') {
      Object.keys(parsed.systems).forEach((sysKey) => {
        const t = parsed.systems[sysKey];
        if (t && Array.isArray(t.stages) && Array.isArray(t.steps)) {
          const sysName: SystemType = sysKey.toLowerCase() === 'invia' ? 'inVia' : sysKey;
          // Register system if it was custom
          SystemRegistryService.addSystem(sysName);
          const tToSave: WorkflowTemplate = {
            system: sysName,
            stages: t.stages,
            steps: t.steps,
            version: t.version || '2.0.0',
            lastUpdated: new Date().toISOString()
          };
          this.saveTemplate(tToSave);
          importedSystems.push(sysName);
          totalStepsCount += t.steps.length;
        }
      });
    } else if (parsed.system && Array.isArray(parsed.stages) && Array.isArray(parsed.steps)) {
      // Case 2: Single system template legacy file
      const sysName: SystemType = parsed.system.toLowerCase() === 'invia' ? 'inVia' : parsed.system;
      SystemRegistryService.addSystem(sysName);
      const tToSave: WorkflowTemplate = {
        system: sysName,
        stages: parsed.stages,
        steps: parsed.steps,
        version: parsed.version || '1.2.0',
        lastUpdated: new Date().toISOString()
      };
      this.saveTemplate(tToSave);
      importedSystems.push(sysName);
      totalStepsCount += parsed.steps.length;
    } else {
      throw new Error('Unrecognized JSON format: Expected multi-system workflow bundle or system template.');
    }

    return { importedSystems, totalStepsCount };
  }

  /**
   * Export single system template (backward-compatibility alias)
   */
  static exportTemplateToFile(system: SystemType): void {
    const template = this.getTemplate(system);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `WorkflowTemplate_${system}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}
