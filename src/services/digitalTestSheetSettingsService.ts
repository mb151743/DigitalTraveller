export interface DigitalTestSheetSettings {
  powerMeterSerialNumber: string;
  powerMeterHeadSerialNumber: string;
}

const STORAGE_KEY = 'digital_traveller_virsa_test_sheet_settings_v1';

const EMPTY_SETTINGS: DigitalTestSheetSettings = {
  powerMeterSerialNumber: '',
  powerMeterHeadSerialNumber: ''
};

export class DigitalTestSheetSettingsService {
  static get(): DigitalTestSheetSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return { ...EMPTY_SETTINGS };

      const parsed = JSON.parse(saved) as Partial<DigitalTestSheetSettings>;
      return {
        powerMeterSerialNumber:
          typeof parsed.powerMeterSerialNumber === 'string' ? parsed.powerMeterSerialNumber : '',
        powerMeterHeadSerialNumber:
          typeof parsed.powerMeterHeadSerialNumber === 'string'
            ? parsed.powerMeterHeadSerialNumber
            : ''
      };
    } catch (error) {
      console.error('Failed to load Virsa test sheet settings', error);
      return { ...EMPTY_SETTINGS };
    }
  }

  static save(settings: DigitalTestSheetSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      powerMeterSerialNumber: settings.powerMeterSerialNumber.trim(),
      powerMeterHeadSerialNumber: settings.powerMeterHeadSerialNumber.trim()
    }));
  }
}
