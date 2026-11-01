import { LaserGratingCombination } from '../types/traveller';

export const LASER_GRATING_SELECTION_STEP_NAME = 'Select Laser and Grating Combinations';
export const CREATE_TEST_SHEETS_STEP_NAME = 'Create Test Sheets';
export const CREATE_TEST_SHEETS_STEP_INSTRUCTIONS = [
  'Copy the configured master digital test sheet into Internal data\\Digital Test Sheets.',
  'Create one test sheet for inLux, or one test sheet for each selected laser and grating combination for Virsa and inVia.'
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
export const SETUP_STEPS_AFTER_SYSTEM_FOLDERS = [
  'Silicon Internal Reference Standard 520.7 cm⁻¹',
  'Laser Beam Alignment & Safety Interlocks',
  'Grating Turret & Slit Alignment'
] as const;
export const LASER_GRATING_FILES_SAVE_INSTRUCTION =
  'Files are saved in the configured system folder under Internal data/Extra Data.';
export const SYSTEM_FOLDERS_STEP_INSTRUCTIONS = [
  'Create the system folder named <Serial Number>_<Part Number>_<Customer Name>.',
  'Create Customer data\\Probe 1, Customer data\\Reg Backup, and Customer data\\System Pictures.',
  'Create Internal data\\Digital Test Sheets and Internal data\\Extra Data. Save test sheets and records in Internal data.'
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
  'Search the configured network location for a system folder matching the Part Number and Customer Name.',
  'Rename a matching folder to <Serial Number>_<Part Number>_<Customer Name>, or create that folder when no match exists.',
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
      typeof combination?.gratingDensityLinesPerMm !== 'string'
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
