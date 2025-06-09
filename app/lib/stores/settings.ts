import { atom, map } from 'nanostores';
import { PROVIDER_LIST } from '~/utils/constants';
import type { IProviderConfig, IProviderSetting } from '~/types/model';
import type {
  TabVisibilityConfig,
  TabWindowConfig,
  UserTabConfig,
  DevTabConfig,
} from '~/components/@settings/core/types';
import { DEFAULT_TAB_CONFIG } from '~/components/@settings/core/constants';
import { toggleTheme } from './theme';
import { create } from 'zustand';

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlOrMetaKey?: boolean;
  action: () => void;
  description?: string;
  isPreventDefault?: boolean;
}

export interface Shortcuts {
  toggleTheme: Shortcut;
  toggleTerminal: Shortcut;
}

export const URL_CONFIGURABLE_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'];
export const LOCAL_PROVIDERS = ['OpenAILike', 'LMStudio', 'Ollama'];

export type ProviderSetting = Record<string, IProviderConfig>;

export const shortcutsStore = map<Shortcuts>({
  toggleTheme: {
    key: 'd',
    metaKey: true,
    altKey: true,
    shiftKey: true,
    action: () => toggleTheme(),
    description: 'Toggle theme',
    isPreventDefault: true,
  },
  toggleTerminal: {
    key: '`',
    ctrlOrMetaKey: true,
    action: () => {
      // Handled by terminal component
    },
    description: 'Toggle terminal',
    isPreventDefault: true,
  },
});

const PROVIDER_SETTINGS_KEY = 'provider_settings';
const isBrowser = typeof window !== 'undefined';

const getInitialProviderSettings = (): ProviderSetting => {
  const initialSettings: ProviderSetting = {};
  PROVIDER_LIST.forEach((provider) => {
    initialSettings[provider.name] = {
      ...provider,
      settings: {
        enabled: !LOCAL_PROVIDERS.includes(provider.name),
      },
    };
  });

  if (isBrowser) {
    const savedSettings = localStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        Object.entries(parsed).forEach(([key, value]) => {
          if (initialSettings[key]) {
            initialSettings[key].settings = (value as IProviderConfig).settings;
          }
        });
      } catch (error) {
        console.error('Error parsing provider settings:', error);
      }
    }
  }
  return initialSettings;
};

export const providersStore = map<ProviderSetting>(getInitialProviderSettings());

export const updateProviderSettings = (provider: string, settings: Partial<IProviderConfig['settings']>) => {
  const currentSettings = providersStore.get();
  const updatedProvider = {
    ...currentSettings[provider],
    settings: {
      ...currentSettings[provider].settings,
      ...settings,
    },
  };
  providersStore.setKey(provider, updatedProvider);
  localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(providersStore.get()));
};

export const isDebugMode = atom(false);

const SETTINGS_KEYS = {
  LATEST_BRANCH: 'isLatestBranch',
  AUTO_SELECT_TEMPLATE: 'autoSelectTemplate',
  CONTEXT_OPTIMIZATION: 'contextOptimizationEnabled',
  EVENT_LOGS: 'isEventLogsEnabled',
  PROMPT_ID: 'promptId',
  DEVELOPER_MODE: 'isDeveloperMode',
  SELECTED_PROVIDER: 'selectedProvider',
  SELECTED_MODEL: 'selectedModel',
  TAB_CONFIGURATION: 'bolt_tab_configuration',
} as const;

const getInitialSettings = () => {
  const getStoredBoolean = (key: string, defaultValue: boolean) => (isBrowser ? localStorage.getItem(key) === 'true' : defaultValue);
  const getStoredString = (key: string, defaultValue: string) => (isBrowser ? localStorage.getItem(key) || defaultValue : defaultValue);
  return {
    latestBranch: getStoredBoolean(SETTINGS_KEYS.LATEST_BRANCH, false),
    autoSelectTemplate: getStoredBoolean(SETTINGS_KEYS.AUTO_SELECT_TEMPLATE, true),
    contextOptimization: getStoredBoolean(SETTINGS_KEYS.CONTEXT_OPTIMIZATION, true),
    eventLogs: getStoredBoolean(SETTINGS_KEYS.EVENT_LOGS, true),
    promptId: getStoredString(SETTINGS_KEYS.PROMPT_ID, 'default'),
    developerMode: getStoredBoolean(SETTINGS_KEYS.DEVELOPER_MODE, false),
    selectedProviderName: getStoredString(SETTINGS_KEYS.SELECTED_PROVIDER, PROVIDER_LIST[0]?.name || ''),
    selectedModelName: getStoredString(SETTINGS_KEYS.SELECTED_MODEL, PROVIDER_LIST[0]?.defaultModel || ''),
  };
};

const initialSettings = getInitialSettings();

interface SettingsState {
  providers: IProviderConfig[];
  models: Record<string, any[]>;
  selectedProvider: IProviderConfig | undefined;
  selectedModel: string;
  providerSettings: ProviderSetting;
}

export const settingsStore = map<SettingsState>({
  providers: PROVIDER_LIST,
  models: {},
  selectedProvider: PROVIDER_LIST.find(p => p.name === initialSettings.selectedProviderName),
  selectedModel: initialSettings.selectedModelName,
  providerSettings: getInitialProviderSettings(),
});

settingsStore.listen((currentValue) => {
    if(isBrowser) {
        if (currentValue.selectedProvider) {
            localStorage.setItem(SETTINGS_KEYS.SELECTED_PROVIDER, currentValue.selectedProvider.name);
        }
        if (currentValue.selectedModel) {
            localStorage.setItem(SETTINGS_KEYS.SELECTED_MODEL, currentValue.selectedModel);
        }
    }
});

export const latestBranchStore = atom<boolean>(initialSettings.latestBranch);
export const autoSelectStarterTemplate = atom<boolean>(initialSettings.autoSelectTemplate);
export const enableContextOptimizationStore = atom<boolean>(initialSettings.contextOptimization);
export const isEventLogsEnabled = atom<boolean>(initialSettings.eventLogs);
export const promptStore = atom<string>(initialSettings.promptId);

export const updateLatestBranch = (enabled: boolean) => {
  latestBranchStore.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.LATEST_BRANCH, JSON.stringify(enabled));
};
export const updateAutoSelectTemplate = (enabled: boolean) => {
  autoSelectStarterTemplate.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.AUTO_SELECT_TEMPLATE, JSON.stringify(enabled));
};
export const updateContextOptimization = (enabled: boolean) => {
  enableContextOptimizationStore.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.CONTEXT_OPTIMIZATION, JSON.stringify(enabled));
};
export const updateEventLogs = (enabled: boolean) => {
  isEventLogsEnabled.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.EVENT_LOGS, JSON.stringify(enabled));
};
export const updatePromptId = (id: string) => {
  promptStore.set(id);
  localStorage.setItem(SETTINGS_KEYS.PROMPT_ID, id);
};

const getInitialTabConfiguration = (): TabWindowConfig => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
    developerTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is DevTabConfig => tab.window === 'developer'),
  };
  if (!isBrowser) return defaultConfig;
  try {
    const saved = localStorage.getItem(SETTINGS_KEYS.TAB_CONFIGURATION);
    if (!saved) return defaultConfig;
    const parsed = JSON.parse(saved);
    return {
      userTabs: parsed.userTabs.filter((tab: any): tab is UserTabConfig => tab.window === 'user'),
      developerTabs: parsed.developerTabs.filter((tab: any): tab is DevTabConfig => tab.window === 'developer'),
    };
  } catch (error) {
    return defaultConfig;
  }
};

export const tabConfigurationStore = map<TabWindowConfig>(getInitialTabConfiguration());
export const updateTabConfiguration = (config: TabVisibilityConfig) => {
  const currentConfig = tabConfigurationStore.get();
  const targetArray = config.window === 'user' ? 'userTabs' : 'developerTabs';
  const updatedTabs = currentConfig[targetArray].map((tab) => (tab.id === config.id ? config : tab));
  if (!updatedTabs.some((tab) => tab.id === config.id)) {
    updatedTabs.push(config as any);
  }
  const newConfig = { ...currentConfig, [targetArray]: updatedTabs };
  tabConfigurationStore.set(newConfig);
  localStorage.setItem(SETTINGS_KEYS.TAB_CONFIGURATION, JSON.stringify(newConfig));
};

// --- START: THE FINAL FIX ---
// This function was accidentally removed and is now restored.
export const resetTabConfiguration = () => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
    developerTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is DevTabConfig => tab.window === 'developer'),
  };
  tabConfigurationStore.set(defaultConfig);
  localStorage.setItem(SETTINGS_KEYS.TAB_CONFIGURATION, JSON.stringify(defaultConfig));
};
// --- END: THE FINAL FIX ---

export const developerModeStore = atom<boolean>(initialSettings.developerMode);
export const setDeveloperMode = (value: boolean) => {
  developerModeStore.set(value);
  if (isBrowser) {
    localStorage.setItem(SETTINGS_KEYS.DEVELOPER_MODE, JSON.stringify(value));
  }
};

interface SettingsPanelStore {
  isOpen: boolean;
  selectedTab: string;
  openSettings: () => void;
  closeSettings: () => void;
  setSelectedTab: (tab: string) => void;
}

export const useSettingsPanelStore = create<SettingsPanelStore>((set) => ({
  isOpen: false,
  selectedTab: 'user',
  openSettings: () => set({ isOpen: true, selectedTab: 'user' }),
  closeSettings: () => set({ isOpen: false, selectedTab: 'user' }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
}));