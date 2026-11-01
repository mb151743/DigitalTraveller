const CONFIG_SETTING_KEYS = new Set([
  'digital_traveller_theme',
  'digital_traveller_left_pane_width',
  'digital_traveller_technicians',
  'digital_traveller_last_tech',
  'digital_traveller_save_location',
  'digital_traveller_network_share_configs_v2',
  'digital_traveller_network_save_locations_v1',
  'digital_traveller_virsa_test_sheet_settings_v1',
  'digital_traveller_registered_systems_v1',
  'digital_traveller_network_share_path'
]);

const WORKFLOW_TEMPLATE_PREFIX = 'digital_traveller_workflow_template_';
let initializationError: string | null = null;

function isSettingKey(key: string): boolean {
  return CONFIG_SETTING_KEYS.has(key) || key.startsWith(WORKFLOW_TEMPLATE_PREFIX);
}

function readSettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isSettingKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  return settings;
}

export function initializeConfigJsonStorage(): void {
  const api = window.desktopAPI;
  if (!api) return;

  const loaded = api.loadSettingsConfig();
  if (!loaded.success) {
    initializationError = loaded.error;
    console.error(`Could not load config.json: ${initializationError}`);
    return;
  }

  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;
  const persistedSettings = loaded.settings || {};

  for (const [key, value] of Object.entries(persistedSettings)) {
    if (isSettingKey(key)) nativeSetItem.call(localStorage, key, value);
  }

  const persist = () => {
    const result = api.saveSettingsConfig(readSettings());
    if (!result.success) {
      initializationError = result.error;
      console.error(`Could not save config.json: ${result.error}`);
      window.dispatchEvent(new CustomEvent('digital-traveller-config-error', {
        detail: { message: result.error }
      }));
    } else {
      initializationError = null;
    }
  };

  Storage.prototype.setItem = function (key: string, value: string): void {
    nativeSetItem.call(this, key, value);
    if (this === localStorage && isSettingKey(key)) persist();
  };

  Storage.prototype.removeItem = function (key: string): void {
    nativeRemoveItem.call(this, key);
    if (this === localStorage && isSettingKey(key)) persist();
  };

  Storage.prototype.clear = function (): void {
    const hadSettings = this === localStorage && Object.keys(readSettings()).length > 0;
    nativeClear.call(this);
    if (hadSettings) persist();
  };

  persist();
}

export function getConfigJsonInitializationError(): string | null {
  return initializationError;
}
