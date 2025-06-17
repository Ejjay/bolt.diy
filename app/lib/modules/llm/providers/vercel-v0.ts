import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class VercelV0Provider extends BaseProvider {
  name = 'Vercel v0';
  getApiKeyLink = 'https://v0.dev/settings';
  labelForGetApiKey = 'Get v0 API Key';
  icon = '/icons/Vercel.svg'; 

  config = {
    apiTokenKey: 'V0_API_KEY',
    baseUrl: 'https://api.v0.dev/v1',
  };

  staticModels: ModelInfo[] = [
    { 
      name: 'v0-1.0-md', 
      label: 'v0 1.0 (Markdown)', 
      provider: 'Vercel v0', 
      maxTokenAllowed: 8000,
      description: 'Optimized for generating React components and web applications'
    },
    { 
      name: 'v0-1.5-md', 
      label: 'v0 1.5 (Markdown)', 
      provider: 'Vercel v0', 
      maxTokenAllowed: 8000,
      description: 'Latest v0 model with improved code generation capabilities'
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'V0_BASE_URL',
      defaultApiTokenKey: 'V0_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider. Please add your v0 API key in the settings.`);
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: baseUrl || 'https://api.v0.dev/v1',
    });

    return openai(model);
  }
}