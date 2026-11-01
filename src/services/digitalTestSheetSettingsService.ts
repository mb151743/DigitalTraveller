import {
  DigitalTestSheetCellMappings,
  DigitalTestSheetCellMappingsBySystem
} from '../types/traveller';

export interface DigitalTestSheetSettings {
  powerMeterSerialNumber: string;
  powerMeterHeadSerialNumber: string;
  cellMappings: DigitalTestSheetCellMappingsBySystem;
}

const STORAGE_KEY = 'digital_traveller_virsa_test_sheet_settings_v1';

const EMPTY_SETTINGS: DigitalTestSheetSettings = {
  powerMeterSerialNumber: '',
  powerMeterHeadSerialNumber: '',
  cellMappings: {}
};

export const DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS: DigitalTestSheetCellMappingsBySystem = {
  inVia: {
    jobNumber: 'C3',
    customerName: 'E3',
    serialNumber: 'H3'
  },
  Virsa: {
    jobNumber: 'C2',
    customerName: 'E2',
    partNumber: 'G2',
    serialNumber: 'I2',
    powerMeterSerialNumber: 'C5',
    powerMeterHeadSerialNumber: 'E5'
  },
  inLux: {
    customerName: 'C2',
    jobNumber: 'C3',
    serialNumber: 'F3',
    powerMeterSerialNumber: 'E10',
    powerMeterHeadSerialNumber: 'G10'
  }
};

export class DigitalTestSheetSettingsService {
  private static normalizeMappings(
    mappings: unknown
  ): DigitalTestSheetCellMappingsBySystem {
    const normalized: DigitalTestSheetCellMappingsBySystem = {};
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) return normalized;

    for (const [system, values] of Object.entries(mappings)) {
      if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
      const fields: DigitalTestSheetCellMappings = {};
      for (const [field, cell] of Object.entries(values)) {
        if (
          ['jobNumber', 'customerName', 'partNumber', 'serialNumber',
            'powerMeterSerialNumber', 'powerMeterHeadSerialNumber'].includes(field) &&
          typeof cell === 'string'
        ) {
          fields[field as keyof DigitalTestSheetCellMappings] = cell.trim().toUpperCase();
        }
      }
      normalized[system] = fields;
    }
    return normalized;
  }

  static get(): DigitalTestSheetSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed: Partial<DigitalTestSheetSettings> = saved
        ? JSON.parse(saved) as Partial<DigitalTestSheetSettings>
        : {};
      const cellMappings: DigitalTestSheetCellMappingsBySystem = {
        ...DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS,
        ...DigitalTestSheetSettingsService.normalizeMappings(parsed.cellMappings)
      };
      for (const [system, mappings] of Object.entries(
        DigitalTestSheetSettingsService.normalizeMappings(parsed.cellMappings)
      )) {
        cellMappings[system] = {
          ...(DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS[system] || {}),
          ...mappings
        };
      }
      return {
        powerMeterSerialNumber:
          typeof parsed.powerMeterSerialNumber === 'string' ? parsed.powerMeterSerialNumber : '',
        powerMeterHeadSerialNumber:
          typeof parsed.powerMeterHeadSerialNumber === 'string'
            ? parsed.powerMeterHeadSerialNumber
            : '',
        cellMappings
      };
    } catch (error) {
      console.error('Failed to load Virsa test sheet settings', error);
      return {
        ...EMPTY_SETTINGS,
        cellMappings: { ...DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS }
      };
    }
  }

  static save(settings: Partial<DigitalTestSheetSettings>): void {
    const current = DigitalTestSheetSettingsService.get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      powerMeterSerialNumber:
        settings.powerMeterSerialNumber?.trim() ?? current.powerMeterSerialNumber,
      powerMeterHeadSerialNumber:
        settings.powerMeterHeadSerialNumber?.trim() ?? current.powerMeterHeadSerialNumber,
      cellMappings: DigitalTestSheetSettingsService.normalizeMappings(
        settings.cellMappings ?? current.cellMappings
      )
    }));
  }

  static getCellMappings(system: string): DigitalTestSheetCellMappings {
    return DigitalTestSheetSettingsService.get().cellMappings[system] || {};
  }
}
