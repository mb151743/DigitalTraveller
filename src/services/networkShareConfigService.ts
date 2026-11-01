import { SystemType } from '../types/traveller';
import { SystemRegistryService } from './systemRegistryService';

export interface NetworkShareLocation {
  id: string;
  name: string;
  category: 'Master Sheet' | 'Test Acceptance Record' | 'Minor Deviation Log' | 'Custom';
  path: string;
  description: string;
}

const STORAGE_KEY_NETWORK_SHARES = 'digital_traveller_network_share_configs_v2';
const STORAGE_KEY_NETWORK_SAVE_LOCATIONS = 'digital_traveller_network_save_locations_v1';

const DEFAULT_NETWORK_SAVE_LOCATIONS: Record<string, string> = {
  inVia: '\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Test\\Final Test Data\\InVia\\000000_INLUX0726-11_CDC\\Internal data\\Digital Test Sheets\\',
  Virsa: '\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Test\\Final Test Data\\Virsa\\000000_INLUX0726-11_CDC\\Internal data\\Digital Test Sheets\\',
  inLux: '\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Test\\Final Test Data\\inLux\\000000_INLUX0726-11_CDC\\Internal data\\Digital Test Sheets\\'
};

/**
 * Renishaw production network share paths
 */
export const DEFAULT_NETWORK_CONFIGS: Record<string, [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation]> = {
  inVia: [
    {
      id: 'invia-master-sheet',
      name: 'Master Test Sheet (.xlsm)',
      category: 'Master Sheet',
      path: '\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Final Test\\Current Test Sheets\\InVia Final Test\\Digital Test Sheet PT-70046-12.xlsm',
      description: 'inVia master digital test sheet template PT-70046-12'
    },
    {
      id: 'invia-test-acceptance',
      name: 'Test Acceptance Record.xlsm',
      category: 'Test Acceptance Record',
      path: '',
      description: 'Master Test Acceptance Record workbook'
    },
    {
      id: 'invia-minor-deviation',
      name: 'Minor Deviation Log.xlsm',
      category: 'Minor Deviation Log',
      path: '',
      description: 'Master Minor Deviation Log workbook'
    }
  ],
  Virsa: [
    {
      id: 'virsa-master-sheet',
      name: 'Master Test Sheet (.xlsm)',
      category: 'Master Sheet',
      path: '\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Final Test\\Current Test Sheets\\VIRSA Test Sheets\\Virsa Test Sheet PT-70152-06.xlsm',
      description: 'Virsa master digital test sheet template PT-70152-06'
    },
    {
      id: 'virsa-test-acceptance',
      name: 'Test Acceptance Record.xlsm',
      category: 'Test Acceptance Record',
      path: '',
      description: 'Master Test Acceptance Record workbook'
    },
    {
      id: 'virsa-minor-deviation',
      name: 'Minor Deviation Log.xlsm',
      category: 'Minor Deviation Log',
      path: '',
      description: 'Master Minor Deviation Log workbook'
    }
  ],
  inLux: [
    {
      id: 'inlux-master-sheet',
      name: 'Master Test Sheet (.xlsm)',
      category: 'Master Sheet',
      path: '\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Final Test\\Current Test Sheets\\inLux Test Sheets\\inLux Test Sheet PT-70151.xlsm',
      description: 'inLux master digital test sheet template PT-70151 (whole system)'
    },
    {
      id: 'inlux-test-acceptance',
      name: 'Test Acceptance Record.xlsm',
      category: 'Test Acceptance Record',
      path: '',
      description: 'Master Test Acceptance Record workbook'
    },
    {
      id: 'inlux-minor-deviation',
      name: 'Minor Deviation Log.xlsm',
      category: 'Minor Deviation Log',
      path: '',
      description: 'Master Minor Deviation Log workbook'
    }
  ]
};

export class NetworkShareConfigService {
  /**
   * Helper to generate 3 default locations for any new custom system
   */
  static generateDefaultLocationsForCustomSystem(
    systemName: string
  ): [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation] {
    const slug = systemName.replace(/\s+/g, '_');
    return [
      {
        id: `${slug}-master-sheet`,
        name: `${systemName} Master Test Sheet`,
        category: 'Master Sheet',
        path: `\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Final Test\\Current Test Sheets\\${slug} Test Sheets\\${slug} Test Sheet.xlsm`,
        description: `Master digital test sheet template for ${systemName}`
      },
      {
        id: `${slug}-test-acceptance`,
        name: 'Test Acceptance Record.xlsm',
        category: 'Test Acceptance Record',
        path: '',
        description: `Master Test Acceptance Record workbook for ${systemName}`
      },
      {
        id: `${slug}-minor-deviation`,
        name: 'Minor Deviation Log.xlsm',
        category: 'Minor Deviation Log',
        path: '',
        description: `Master Minor Deviation Log workbook for ${systemName}`
      }
    ];
  }

  /**
   * Load configurations for all systems
   */
  static getAllConfigs(): Record<string, [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation]> {
    const registeredSystems = SystemRegistryService.getSystems();
    let configs: Record<string, [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation]> = {};
    let networkSaveLocations: Record<string, string> = {};
    let migratedLocations = false;
    let migratedSaveLocations = false;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_NETWORK_SHARES);
      if (stored) {
        configs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse network share configs from localStorage', e);
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NETWORK_SAVE_LOCATIONS);
      if (stored) networkSaveLocations = JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to parse network save locations from localStorage', e);
    }

    Object.entries(configs).forEach(([system, locations]) => {
      if (String(locations?.[1]?.category) === 'Test Data Copies') {
        networkSaveLocations[system] = networkSaveLocations[system] || locations[1].path;
        migratedSaveLocations = true;
        const oldRecordFolder = locations[2]?.path?.replace(/[\\/]+$/, '') || '';
        const migrated: [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation] = [
          locations[0],
          {
            id: `${system}-test-acceptance`,
            name: 'Test Acceptance Record.xlsm',
            category: 'Test Acceptance Record',
            path: oldRecordFolder ? `${oldRecordFolder}\\Test Acceptance Record.xlsm` : '',
            description: 'Master Test Acceptance Record workbook'
          },
          {
            id: `${system}-minor-deviation`,
            name: 'Minor Deviation Log.xlsm',
            category: 'Minor Deviation Log',
            path: oldRecordFolder ? `${oldRecordFolder}\\Minor Deviation Log.xlsm` : '',
            description: 'Master Minor Deviation Log workbook'
          }
        ];
        configs[system] = migrated;
        migratedLocations = true;
      }
    });

    // Ensure built-in systems have defaults if missing
    Object.keys(DEFAULT_NETWORK_CONFIGS).forEach((sys) => {
      if (!configs[sys]) {
        configs[sys] = DEFAULT_NETWORK_CONFIGS[sys];
      }
    });

    // Ensure any custom added system has 3 configured locations
    registeredSystems.forEach((sys) => {
      if (!configs[sys]) {
        configs[sys] = NetworkShareConfigService.generateDefaultLocationsForCustomSystem(sys);
      }
    });

    if (migratedSaveLocations) {
      try {
        localStorage.setItem(STORAGE_KEY_NETWORK_SAVE_LOCATIONS, JSON.stringify(networkSaveLocations));
      } catch (e) {
        console.error('Failed to save network save location configuration', e);
      }
    }
    if (migratedLocations) NetworkShareConfigService.saveAllConfigs(configs);
    return configs;
  }

  static getNetworkSaveLocation(system: SystemType): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NETWORK_SAVE_LOCATIONS);
      if (stored) {
        const locations = JSON.parse(stored) as Record<string, unknown>;
        if (typeof locations[system] === 'string') return locations[system] as string;
      }
    } catch (e) {
      console.warn('Failed to load network save locations', e);
    }
    return DEFAULT_NETWORK_SAVE_LOCATIONS[system] ||
      `\\\\renishaw.com\\global\\gb\\PLC\\SPD\\Data\\SPD_Data\\Operations\\Production\\Test\\Final Test Data\\${system.replace(/\s+/g, '_')}\\Internal data\\Digital Test Sheets\\`;
  }

  static setNetworkSaveLocation(system: SystemType, location: string): void {
    const stored = localStorage.getItem(STORAGE_KEY_NETWORK_SAVE_LOCATIONS);
    const locations = stored ? JSON.parse(stored) as Record<string, string> : {};
    locations[system] = location.trim();
    localStorage.setItem(STORAGE_KEY_NETWORK_SAVE_LOCATIONS, JSON.stringify(locations));
  }

  /**
   * Get 3 configured network share locations for a specific system
   */
  static getLocationsForSystem(system: SystemType): [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation] {
    const all = this.getAllConfigs();
    if (all[system]) return all[system];
    const newLocs = this.generateDefaultLocationsForCustomSystem(system);
    all[system] = newLocs;
    this.saveAllConfigs(all);
    return newLocs;
  }

  /**
   * Update one specific location for a system
   */
  static updateLocation(
    system: SystemType,
    index: 0 | 1 | 2,
    updates: Partial<NetworkShareLocation>
  ): Record<string, [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation]> {
    const all = this.getAllConfigs();
    if (!all[system]) {
      all[system] = this.generateDefaultLocationsForCustomSystem(system);
    }
    all[system][index] = {
      ...all[system][index],
      ...updates
    };
    this.saveAllConfigs(all);
    return all;
  }

  /**
   * Save all configs at once
   */
  static saveAllConfigs(
    configs: Record<string, [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation]>
  ): void {
    try {
      localStorage.setItem(STORAGE_KEY_NETWORK_SHARES, JSON.stringify(configs));
    } catch (e) {
      console.error('Failed to save network share configurations', e);
    }
  }

  /**
   * Reset configurations to default
   */
  static resetToDefaults(): Record<string, [NetworkShareLocation, NetworkShareLocation, NetworkShareLocation]> {
    try {
      localStorage.removeItem(STORAGE_KEY_NETWORK_SHARES);
      localStorage.removeItem(STORAGE_KEY_NETWORK_SAVE_LOCATIONS);
    } catch (e) {
      console.error('Failed to reset network share configurations', e);
    }
    return this.getAllConfigs();
  }
}
