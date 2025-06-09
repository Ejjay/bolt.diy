import { memo, useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { settingsStore } from '~/lib/stores/settings';
import { TabsWithSlider } from '~/components/ui/TabsWithSlider';
import { Label } from '~/components/ui/Label';
import { classNames } from '~/utils/classNames';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderConfig, IProviderSetting } from '~/types/model';

// --- Props Interface ---
// This is simplified to only include what the component truly needs from its parent.
interface ModelSelectorProps {
  isLoading: boolean;
  onChatModeChange: (mode: 'discuss' | 'build' | 'patch') => void;
  onFetchModels: (provider: IProviderConfig) => void;
}

export const ModelSelector = memo(({ isLoading, onChatModeChange, onFetchModels }: ModelSelectorProps) => {
  // --- Global State ---
  // The component now correctly gets all its data from the single 'settingsStore'.
  const { providers, models, selectedProvider, selectedModel, providerSettings } = useStore(settingsStore);

  // --- Local UI State ---
  // This state is only for controlling the UI appearance (dropdowns, search text, etc.).
  const [chatMode, setChatMode] = useState<'discuss' | 'build' | 'patch'>('build');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // --- Event Handlers ---
  // These functions update the single source of truth: the global settingsStore.
  const handleProviderSelect = (provider: IProviderConfig) => {
    settingsStore.setKey('selectedProvider', provider);
    settingsStore.setKey('selectedModel', provider.defaultModel || provider.models?.[0]?.name || '');
    setIsProviderDropdownOpen(false);
    setProviderSearchQuery('');
    onFetchModels(provider); // Ask the parent to fetch models
  };

  const handleModelSelect = (modelName: string) => {
    settingsStore.setKey('selectedModel', modelName);
    setIsModelDropdownOpen(false);
    setModelSearchQuery('');
  };

  const handleChatModeChange = (mode: string) => {
    const newMode = mode as 'discuss' | 'build' | 'patch';
    setChatMode(newMode);
    onChatModeChange(newMode);
  };
  
  // --- Derived Data & Helpers ---
  const isProviderConfigured = (providerName: string) => {
    const settings = providerSettings[providerName] as IProviderSetting;
    return settings?.settings?.apiKey || settings?.settings?.isConfigured || !settings.isConfigurable;
  };

  const filteredProviders = useMemo(() => 
    providers.filter((p) => p.name.toLowerCase().includes(providerSearchQuery.toLowerCase())),
    [providers, providerSearchQuery]
  );

  const currentModels = useMemo(() => {
    const providerName = selectedProvider?.name || '';
    const modelsForProvider = models[providerName] || [];
    return modelsForProvider.filter(
      (m: ModelInfo) =>
        m.label.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
    );
  }, [models, selectedProvider, modelSearchQuery]);

  // --- Effects ---
  // Close dropdowns when clicking outside of them.
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

  const chatModeTabs = [
    { id: 'build', label: 'Build' },
    { id: 'patch', label: 'Patch' },
    { id: 'discuss', label: 'Discuss' },
  ];

  return (
    <div className="flex items-center justify-between p-2 rounded-t-lg bg-bolt-background-dark text-xs text-white/50">
      <div className="flex items-center gap-4">
        {/* Provider Dropdown */}
        <div ref={providerDropdownRef} className="relative">
          <Label className="text-white/50">Provider</Label>
          <button
            onClick={() => setIsProviderDropdownOpen(p => !p)}
            disabled={isLoading}
            className="flex items-center justify-between w-36 p-1.5 rounded-md bg-bolt-background text-white/80 border border-transparent focus-within:ring-2 focus-within:ring-bolt-elements-focus"
          >
            <span className="truncate">{selectedProvider?.name || 'Select'}</span>
            <span className={classNames('i-ph:caret-down w-4 h-4 transition-transform', isProviderDropdownOpen && 'rotate-180')} />
          </button>
          {isProviderDropdownOpen && (
            <div className="absolute z-20 w-48 mt-1 p-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg">
              <input
                type="text"
                value={providerSearchQuery}
                onChange={(e) => setProviderSearchQuery(e.target.value)}
                placeholder="Search..."
                autoFocus
                className="w-full px-2 py-1 mb-1 rounded-md bg-bolt-background-dark border border-bolt-elements-borderColor focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus"
              />
              <div className="max-h-60 overflow-y-auto">
                {filteredProviders.map((p) => (
                  <div
                    key={p.name}
                    onClick={() => isProviderConfigured(p.name) && handleProviderSelect(p)}
                    className={classNames(
                      'px-2 py-1.5 text-sm rounded',
                      isProviderConfigured(p.name) ? 'cursor-pointer hover:bg-bolt-elements-background-depth-3' : 'opacity-50 cursor-not-allowed',
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
            onClick={() => setIsModelDropdownOpen(p => !p)}
            disabled={isLoading || !selectedProvider}
            className="flex items-center justify-between w-48 p-1.5 rounded-md bg-bolt-background text-white/80 border border-transparent focus-within:ring-2 focus-within:ring-bolt-elements-focus"
          >
            <span className="truncate">{selectedModel || 'Select a provider'}</span>
            <span className={classNames('i-ph:caret-down w-4 h-4 transition-transform', isModelDropdownOpen && 'rotate-180')} />
          </button>
          {isModelDropdownOpen && (
            <div className="absolute z-20 w-60 mt-1 p-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg">
               <input
                type="text"
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                placeholder="Search models..."
                autoFocus
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