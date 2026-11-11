import { LaserGratingCombination } from '../types/traveller';

export const LEGACY_LASER_GRATING_SELECTION_STEP_NAME = 'Select Laser and Grating Combinations';
export const LASER_GRATING_SELECTION_STEP_NAME = 'Select Laser & Grating Combinations';
export const CREATE_TEST_SHEETS_STEP_NAME = 'Create Test Sheets';
export const CREATE_TEST_SHEETS_STEP_INSTRUCTIONS = [
  'Part 1: Copy editable blank master test sheets and record templates to the Local Save Location.',
  'Name each workbook <wavelength>nm_<grating> (for example, 532nm_1200).',
  'Part 2: Populate the local copies. If population fails, the blank editable copies remain available.',
  'Part 3: Publish the populated test sheets and records to the network system folder.',
  'Part 4: Remove the local copies after confirming they were published to the network.'
];
export const LASER_GRATING_FILES_STEP_NAME = 'Create Extra Data Files';
export const PAT_TEST_STEP_NAME = 'PAT Test';
export const PRE_SYSTEM_TEST_STEP_NAME = 'Pre System Test';
export const UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME = 'Update Network Save Location';
export const SYSTEM_UNBOXING_STEP_NAME = 'System & PC Set Up';
export const LEGACY_SYSTEM_UNBOXING_STEP_NAME = 'System & PC Unboxing & Set Up';
export const RECORD_SYSTEM_DETAILS_STEP_NAME = 'Record System Details';
export const SAVE_WIRE_PASSWORDS_STEP_NAME = 'Save WiRE Passwords';
export const SAVE_WIRE_PASSWORDS_STEP_INSTRUCTIONS = [
  'Generate and save the WiRE feature permission key for this system.',
  'Record the system WiRE passwords in System Details.'
];
export const SYSTEM_FOLDERS_STEP_NAME = 'Create System Folders';
export const OBSOLETE_SETUP_STEP_NAMES = ['New Test', 'name1'] as const;
export const IN_VIA_VIRSA_SETUP_STEP_NAMES = [
  PAT_TEST_STEP_NAME,
  SYSTEM_UNBOXING_STEP_NAME,
  RECORD_SYSTEM_DETAILS_STEP_NAME,
  SAVE_WIRE_PASSWORDS_STEP_NAME,
  UPDATE_NETWORK_SAVE_LOCATION_STEP_NAME,
  LASER_GRATING_SELECTION_STEP_NAME,
  SYSTEM_FOLDERS_STEP_NAME,
  CREATE_TEST_SHEETS_STEP_NAME,
  LASER_GRATING_FILES_STEP_NAME
] as const;
export const IN_VIA_VIRSA_CALIBRATION_STEP_NAMES = [
  'Silicon Internal Reference Standard 520.7 cm⁻¹',
  'Laser Beam Alignment & Safety Interlocks',
  'Grating Turret & Slit Alignment',
  'Fibre Probe Head Coupling & Shutter Test'
] as const;

export function normalizeInViaVirsaWorkflowSteps<T extends { name: string; stage: string }>(
  steps: T[]
): T[] {
  const normalizedSteps = steps.map((step) => ({
    ...step,
    name: step.name === LEGACY_LASER_GRATING_SELECTION_STEP_NAME
      ? LASER_GRATING_SELECTION_STEP_NAME
      : step.name === 'Fiber Probe Head Coupling & Shutter Test'
        ? 'Fibre Probe Head Coupling & Shutter Test'
        : step.name
  }));
  const setupSteps = IN_VIA_VIRSA_SETUP_STEP_NAMES.flatMap((name) => {
    const step = normalizedSteps.find((item) => item.name === name);
    return step ? [{ ...step, stage: 'Set Up' }] : [];
  });
  const otherSteps = normalizedSteps
    .filter((step) => !IN_VIA_VIRSA_SETUP_STEP_NAMES.some((name) => name === step.name))
    .map((step) => ({
      ...step,
      stage: IN_VIA_VIRSA_CALIBRATION_STEP_NAMES.some((name) => name === step.name)
        ? 'Calibration'
        : step.stage === 'Setup'
          ? 'Set Up'
          : step.stage
    }));

  return [...setupSteps, ...otherSteps];
}
export const LASER_GRATING_FILES_SAVE_INSTRUCTION =
  'Files are saved in the Local Save Location under <Serial Number>_<Part Number>_<Customer Name>/Internal data/Extra Data.';
export const SYSTEM_FOLDERS_STEP_INSTRUCTIONS = [
  'Create the system folder named <Serial Number>_<Part Number>_<Customer Name> in the Local Save Location.',
  'Create Customer data\\Reg Backup, Customer data\\System Pictures, and each discovered customer data combination folder.',
  'Create Internal data\\Digital Test Sheets and Internal data\\Extra Data in the local system folder.'
];
export const PAT_TEST_STEP_INSTRUCTIONS = [
  'Perform electrical safety inspection and Portable Appliance Testing (PAT).',
  'Verify earth continuity resistance (< 0.1 Ω).',
  'Measure insulation resistance (> 2 MΩ at 500V DC).',
  'Confirm touch leakage and substitute leakage current within safe limits (< 0.5 mA).',
  'Affix passed PAT test label with test date, retest period, and tester initials.'
];
export const PRE_SYSTEM_TEST_STEP_INSTRUCTIONS = [
  'Scan the system motors and record the result and any required action for each motor.',
  'Complete each motor instruction, then save the motor test results to the network.'
];
export const UPDATE_NETWORK_SAVE_LOCATION_STEP_INSTRUCTIONS = [
  'Part 1: Find an existing network folder using the Part Number. Check whether its Customer Name matches the saved system details and review the combination folders inside Customer data.',
  'Part 2: Update the Serial Number on a matching folder while preserving its existing Customer Name, or create a new folder using the saved details when no Part Number match exists.',
  'Review and record the folder names already present in the system folder.'
];
export const SYSTEM_UNBOXING_STEP_INSTRUCTIONS = [
  'Inspect system and PC for transit damage, connect required peripherals, and complete base mechanical set up.'
];
export const RECORD_SYSTEM_DETAILS_STEP_INSTRUCTIONS = [
  'Enter the system serial number, customer name, job number, and part number.'
];

export function getLaserGratingFileName(combination: LaserGratingCombination): string {
  return `${Number(combination.wavelengthNm)}nm_${Number(combination.gratingDensityLinesPerMm)}.txt`;
}

export function parseLaserGratingCombinationFolder(
  folderName: string
): LaserGratingCombination | null {
  const match = folderName.match(
    /^\s*(\d+(?:\.\d+)?)\s*cm-1[_\s]+(\d+(?:\.\d+)?)\s*nm[_\s]+(\d+)\s*lmm\s*$/i
  );
  if (!match) return null;
  return {
    cutoffValue: match[1],
    wavelengthNm: match[2],
    gratingDensityLinesPerMm: match[3],
    pl: false
  };
}

export function validateLaserGratingCombinations(
  combinations: LaserGratingCombination[]
): string | null {
  if (combinations.length === 0) {
    return 'Add at least one laser and grating combination.';
  }

  for (let index = 0; index < combinations.length; index += 1) {
    const combination = combinations[index];
    if (
      typeof combination?.wavelengthNm !== 'string' ||
      typeof combination?.gratingDensityLinesPerMm !== 'string' ||
      typeof combination?.cutoffValue !== 'string' ||
      typeof combination?.pl !== 'boolean'
    ) {
      return `Enter a wavelength and grating density in row ${index + 1}.`;
    }
    const wavelength = Number(combination.wavelengthNm);
    const gratingDensity = Number(combination.gratingDensityLinesPerMm);
    if (
      !combination.wavelengthNm.trim() ||
      !Number.isFinite(wavelength) ||
      wavelength <= 0 ||
      !combination.gratingDensityLinesPerMm.trim() ||
      !Number.isInteger(gratingDensity) ||
      gratingDensity <= 0
    ) {
      return `Enter a positive wavelength and a positive whole-number grating density in row ${index + 1}.`;
    }
  }

  return null;
}
