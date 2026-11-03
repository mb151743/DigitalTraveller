import {
  DigitalTestSheetCellMappings,
  DigitalTestSheetCellMappingsBySystem,
  RecordCellMappings,
  RecordCellMappingsBySystem,
  RecordWorkbookCellMappings
} from '../types/traveller';

export interface DigitalTestSheetSettings {
  powerMeterSerialNumber: string;
  powerMeterHeadSerialNumber: string;
  cellMappings: DigitalTestSheetCellMappingsBySystem;
  recordCellMappings: RecordCellMappingsBySystem;
  laserTypes: Record<string, string[]>;
  gratingTypes: Record<string, string[]>;
}

const STORAGE_KEY = 'digital_traveller_virsa_test_sheet_settings_v1';

const EMPTY_SETTINGS: DigitalTestSheetSettings = {
  powerMeterSerialNumber: '224',
  powerMeterHeadSerialNumber: '219',
  cellMappings: {},
  recordCellMappings: {},
  laserTypes: {},
  gratingTypes: {}
};

export const DEFAULT_LASER_TYPES_BY_SYSTEM: Record<string, string[]> = {
  inVia: ['532', '785'],
  Virsa: ['532', '785'],
  inLux: ['532', '785']
};
export const DEFAULT_GRATING_TYPES_BY_SYSTEM: Record<string, string[]> = {
  inVia: ['1200', '1800'],
  Virsa: ['1200', '1800'],
  inLux: ['1200', '1800']
};

export const DEFAULT_RECORD_CELL_MAPPINGS: RecordCellMappings = {
  minorDeviation: {
    partNumber: 'C4',
    customerName: 'E4',
    serialNumber: 'H4'
  },
  testAcceptance: {
    partNumber: 'C4',
    customerName: 'E4',
    serialNumber: 'G4',
    technicianName: 'D28',
    currentDate: 'G28'
  }
};

export const DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS: DigitalTestSheetCellMappingsBySystem = {
  inVia: {
    jobNumber: 'C3',
    customerName: 'E3',
    serialNumber: 'H3',
    powerMeterSerialNumber: 'C10',
    powerMeterHeadSerialNumber: 'E10',
    hasPL: 'H6'
  },
  Virsa: {
    jobNumber: 'C2',
    customerName: 'E2',
    partNumber: 'G2',
    serialNumber: 'I2',
    powerMeterSerialNumber: 'C5',
    powerMeterHeadSerialNumber: 'E5',
    hasPL: 'H6'
  },
  inLux: {
    customerName: 'C2',
    jobNumber: 'C3',
    serialNumber: 'F3',
    powerMeterSerialNumber: 'E10',
    powerMeterHeadSerialNumber: 'G10',
    hasPL: 'H6'
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
            'powerMeterSerialNumber', 'powerMeterHeadSerialNumber', 'hasPL'].includes(field) &&
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
      const laserTypes = DigitalTestSheetSettingsService.normalizeTypeLists(
        parsed.laserTypes,
        DEFAULT_LASER_TYPES_BY_SYSTEM
      );
      const gratingTypes = DigitalTestSheetSettingsService.normalizeTypeLists(
        parsed.gratingTypes,
        DEFAULT_GRATING_TYPES_BY_SYSTEM
      );
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
      const recordCellMappings: RecordCellMappingsBySystem = {};
      const savedRecordMappings = DigitalTestSheetSettingsService.normalizeRecordMappings(
        parsed.recordCellMappings
      );
      for (const configuredSystem of new Set([
        ...Object.keys(DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS),
        ...Object.keys(savedRecordMappings)
      ])) {
        recordCellMappings[configuredSystem] = {
          minorDeviation: {
            ...DEFAULT_RECORD_CELL_MAPPINGS.minorDeviation,
            ...savedRecordMappings[configuredSystem]?.minorDeviation
          },
          testAcceptance: {
            ...DEFAULT_RECORD_CELL_MAPPINGS.testAcceptance,
            ...savedRecordMappings[configuredSystem]?.testAcceptance
          }
        };
      }
      return {
        powerMeterSerialNumber:
          typeof parsed.powerMeterSerialNumber === 'string' && parsed.powerMeterSerialNumber.trim()
            ? parsed.powerMeterSerialNumber
            : '224',
        powerMeterHeadSerialNumber:
          typeof parsed.powerMeterHeadSerialNumber === 'string' &&
          parsed.powerMeterHeadSerialNumber.trim()
            ? parsed.powerMeterHeadSerialNumber
            : '219',
        cellMappings,
        recordCellMappings,
        laserTypes,
        gratingTypes
      };
    } catch (error) {
      console.error('Failed to load Virsa test sheet settings', error);
      return {
        ...EMPTY_SETTINGS,
        cellMappings: { ...DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS },
        recordCellMappings: Object.fromEntries(
          Object.keys(DEFAULT_DIGITAL_TEST_SHEET_CELL_MAPPINGS).map((system) => [
            system,
            DEFAULT_RECORD_CELL_MAPPINGS
          ])
        ),
        laserTypes: DEFAULT_LASER_TYPES_BY_SYSTEM,
        gratingTypes: DEFAULT_GRATING_TYPES_BY_SYSTEM
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
      ),
      recordCellMappings: DigitalTestSheetSettingsService.normalizeRecordMappings(
        settings.recordCellMappings ?? current.recordCellMappings
      ),
      laserTypes: DigitalTestSheetSettingsService.normalizeTypeLists(
        settings.laserTypes ?? current.laserTypes,
        {}
      ),
      gratingTypes: DigitalTestSheetSettingsService.normalizeTypeLists(
        settings.gratingTypes ?? current.gratingTypes,
        {}
      )
    }));
  }

  static getCellMappings(system: string): DigitalTestSheetCellMappings {
    return DigitalTestSheetSettingsService.get().cellMappings[system] || {};
  }

  static getRecordCellMappings(system: string): RecordCellMappings {
    return DigitalTestSheetSettingsService.get().recordCellMappings[system] ||
      DEFAULT_RECORD_CELL_MAPPINGS;
  }

  private static normalizeTypeLists(
    value: unknown,
    defaults: Record<string, string[]>
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [system, values] of Object.entries(defaults)) {
      result[system] = [...values];
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const [system, values] of Object.entries(value)) {
      if (!Array.isArray(values)) continue;
      result[system] = [...new Set(values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean))];
    }
    return result;
  }

  private static normalizeRecordMappings(mappings: unknown): RecordCellMappingsBySystem {
    const normalized: RecordCellMappingsBySystem = {};
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) return normalized;

    for (const [system, recordTypes] of Object.entries(mappings)) {
      if (!recordTypes || typeof recordTypes !== 'object' || Array.isArray(recordTypes)) continue;
      const normalizeRecord = (value: unknown): RecordWorkbookCellMappings => {
        const fields: RecordWorkbookCellMappings = {};
        if (!value || typeof value !== 'object' || Array.isArray(value)) return fields;
        for (const [field, cell] of Object.entries(value)) {
          if (
            ['jobNumber', 'customerName', 'partNumber', 'serialNumber',
              'powerMeterSerialNumber', 'powerMeterHeadSerialNumber', 'technicianName',
              'currentDate'].includes(field) &&
            typeof cell === 'string'
          ) {
            fields[field as keyof RecordWorkbookCellMappings] = cell.trim().toUpperCase();
          }
        }
        return fields;
      };
      normalized[system] = {
        minorDeviation: normalizeRecord(recordTypes.minorDeviation),
        testAcceptance: normalizeRecord(recordTypes.testAcceptance)
      };
    }
    return normalized;
  }
}
