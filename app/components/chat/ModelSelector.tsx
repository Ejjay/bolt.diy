import { useEffect, useState, useRef, useMemo, type KeyboardEvent, memo } from 'react';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { classNames } from '~/utils/classNames';
import { TabsWithSlider } from '~/components/ui/TabsWithSlider';
import { Label } from '~/components/ui/Label';
import { useStore } from '@nanostores/react';
import { settingsStore } from '~/lib/stores/settings';
import type { IProviderConfig, IProviderSetting } from '~/types/model';

// --- Interface for component props ---
interface ModelSelectorProps {
  // isLoading is passed from the parent to disable controls during submission
  isLoading: boolean;
  // This callback notifies the parent component about the mode change
  onChatModeChange: (mode: 'discuss' | 'build' | 'patch') => void;
  // This callback is used to fetch models for a provider when it's selected
  onFetchModels: (provider: IProviderConfig) => void;
}

export const ModelSelector = memo(({ isLoading, onChatModeChange, onFetchModels }: ModelSelectorProps) => {
  // --- State from Global Store ---
  // The component now gets all its data directly from the settingsStore.
  // This makes it the single source of truth.
  const { providers, models, selectedProvider, selectedModel, providerSettings } = useStore(settingsStore);

  // --- Local UI State ---
  // This state is only for controlling the UI (dropdowns, search, etc.)
  const [chatMode, setChatMode] = useState<'discuss' | 'build' | 'patch'>('build');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // --- Memoized Lists ---
  // Filters the providers and models based on the search query.
  const filteredProviders = useMemo(() => 
    providers.filter((p) => p.name.toLowerCase().includes(providerSearchQuery.toLowerCase())),
    [providers, providerSearchQuery]
  );

  const currentModels = useMemo(() => 
    (models[selectedProvider?.name || ''] || []).filter(
      (m: ModelInfo) =>
        m.label.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
    ),
    [models, selectedProvider, modelSearchQuery]
  );
  
  // --- Event Handlers to Update Global State ---
  // These handlers now update the global settingsStore directly.
  const handleProviderSelect = (provider: IProviderConfig) => {
    // Update the store with the new provider and its default model
    settingsStore.setKey('selectedProvider', provider);
    settingsStore.setKey('selectedModel', provider.defaultModel || provider.models?.[0]?.name || '');
    setIsProviderDropdownOpen(false);
    setProviderSearchQuery('');
    // Fetch models for the newly selected provider
    onFetchModels(provider);
  };

  const handleModelSelect = (modelName: string) => {
    settingsStore.setKey('selectedModel', modelName);
    setIsModelDropdownOpen(false);
    setModelSearchQuery('');
  };

  const handleChatModeChange = (mode: string) => {
    const newMode = mode as 'discuss' | 'build' | 'patch';
    setChatMode(newMode);
    onChatModeChange(newMode); // Notify parent component
  };

  const isProviderConfigured = (providerName: string) => {
    const settings = providerSettings[providerName] as IProviderSetting;
    return settings?.settings?.apiKey || settings?.settings?.isConfigured || !settings.isConfigurable;
  };

  // --- Effect for closing dropdowns on outside click ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setIsProviderDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // --- Render Logic ---
  const chatModeTabs = [
    { id: 'build', label: 'Build' },
    { id: 'patch', label: 'Patch' },
    { id: 'discuss', label: 'Discuss' },
  ];
  
  if (providers.length === 0) {
    return (
      <div className="mb-2 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary">
        <p className="text-center">No providers enabled. Please configure providers in settings.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 rounded-t-lg bg-bolt-background-dark text-xs text-white/50">
      <div className="flex items-center gap-4">
        {/* Provider Dropdown */}
        <div ref={providerDropdownRef} className="relative">
          <Label className="text-white/50">Provider</Label>
          <button
            onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
            disabled={isLoading}
            className="flex items-center justify-between w-32 p-1.5 rounded-md bg-bolt-background text-white/80"
          >
            <span className="truncate">{selectedProvider?.name || 'Select'}</span>
            <span className="i-ph:caret-down w-4 h-4" />
          </button>
          {isProviderDropdownOpen && (
            <div className="absolute z-20 w-48 mt-1 p-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg">
              <input
                type="text"
                value={providerSearchQuery}
                onChange={(e) => setProviderSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1 mb-1 rounded-md bg-bolt-background-dark border border-bolt-elements-borderColor focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus"
              />
              <div className="max-h-60 overflow-y-auto">
                {filteredProviders.map((p) => (
                  <div
                    key={p.name}
                    onClick={() => handleProviderSelect(p)}
                    className={classNames(
                      'px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-bolt-elements-background-depth-3',
                      !isProviderConfigured(p.name) && 'opacity-50 cursor-not-allowed',
                      selectedProvider?.name === p.name && 'bg-bolt-elements-background-depth-3'
                    )}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Model Dropdown */}
        <div ref={modelDropdownRef} className="relative">
          <Label className="text-white/50">Model</Label>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            disabled={isLoading || !selectedProvider}
            className="flex items-center justify-between w-48 p-1.5 rounded-md bg-bolt-background text-white/80"
          >
            <span className="truncate">{selectedModel || 'Select'}</span>
            <span className="i-ph:caret-down w-4 h-4" />
          </button>
          {isModelDropdownOpen && (
            <div className="absolute z-20 w-60 mt-1 p-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg">
              <input
                type="text"
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1 mb-1 rounded-md bg-bolt-background-dark border border-bolt-elements-borderColor focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus"
              />
              <div className="max-h-60 overflow-y-auto">
                {currentModels.map((m: ModelInfo) => (
                  <div
                    key={m.name}
                    onClick={() => handleModelSelect(m.name)}
                    className={classNames(
                      'px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-bolt-elements-background-depth-3',
                      selectedModel === m.name && 'bg-bolt-elements-background-depth-3'
                    )}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Mode Selector */}
      <div className="flex items-center gap-2">
        <Label className="mb-0 text-white/50">Chat Mode</Label>
        <TabsWithSlider
          tabs={chatModeTabs}
          activeTab={chatMode}
          onTabClick={handleChatModeChange}
          size="sm"
          disabled={isLoading}
        />
      </div>
    </div>
  );
});