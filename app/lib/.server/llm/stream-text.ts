import { convertToCoreMessages, streamText as _streamText, type Message } from 'ai';
import { MAX_TOKENS, type FileMap } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { discussPrompt } from '~/lib/common/prompts/discuss-prompt';
import type { DesignScheme } from '~/types/design-scheme';

export type Messages = Message[];

export interface StreamingOptions extends Omit<Parameters<typeof _streamText>[0], 'model'> {
  supabaseConnection?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

// =================================================================
// START: New System Prompt for "Patch Mode"
// =================================================================

/**
 * Creates a specialized system prompt for "Patch Mode".
 * This prompt instructs the AI to output changes in the unified diff format.
 */
function getPatchPrompt(options: { modificationTagName: string; cwd: string }): string {
  return `You are an expert AI programmer specializing in code modification. Your task is to act as an automated code editing tool.
You will be given a user request and the content of relevant files.
Your SOLE an ONLY output format MUST be a unified diff format, contained within a specific XML-like tag.

You MUST follow these rules:
1.  Analyze the user's request to understand the required changes.
2.  Analyze the provided file content within the 'CONTEXT BUFFER'.
3.  Generate a set of changes in the unified diff format.
4.  Wrap the entire response in a <${options.modificationTagName}> tag.
5.  Inside this tag, each file modification must be wrapped in a <diff path="path/to/file"> tag.
6.  The content inside the <diff> tag must be a valid unified diff, starting with '@@ ... @@'.
7.  DO NOT include the '---' or '+++' file headers in the diff content. The patch application system will handle this.
8.  DO NOT output any conversational text, explanations, or code blocks. Your response must ONLY be the diff itself.

Here is an example of a PERFECT response:

<${options.modificationTagName}>
<diff path="src/components/ui/Button.tsx">
@@ -10,7 +10,7 @@
   return (
     <button
       className={cn(buttonVariants({ variant, size, className }))}
-      ref={ref}
+      ref={ref} // Add a reference to the button
       {...props}
     />
   );
</diff>
</${options.modificationTagName}>

Begin! The user's files are located in the '${options.cwd}' directory.`;
}

// =================================================================
// END: New System Prompt for "Patch Mode"
// =================================================================

const logger = createScopedLogger('stream-text');

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
  // START: Updated chatMode type to include 'patch'
  chatMode?: 'discuss' | 'build' | 'patch';
  // END: Updated chatMode type
  designScheme?: DesignScheme;
}) {
  const {
    messages,
    env: serverEnv,
    options,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    contextFiles,
    summary,
    chatMode,
    designScheme,
  } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  let processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      content = content.replace(
        /<boltAction type="file" filePath="package-lock\.json">[\s\S]*?<\/boltAction>/g,
        '[package-lock.json content removed]',
      );

      content = content.trim();

      return { ...message, content };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const dynamicMaxTokens = modelDetails?.maxTokenAllowed || MAX_TOKENS;
  logger.info(
    `Max tokens for model ${modelDetails.name} is ${dynamicMaxTokens} based on ${modelDetails.maxTokenAllowed} or ${MAX_TOKENS}`,
  );

  // START: Logic to select the system prompt based on chatMode
  let systemPrompt: string;

  switch (chatMode) {
    case 'patch':
      systemPrompt = getPatchPrompt({
        modificationTagName: MODIFICATIONS_TAG_NAME,
        cwd: WORK_DIR,
      });
      break;
    case 'discuss':
      systemPrompt = discussPrompt();
      break;
    case 'build':
    default:
      systemPrompt =
        PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
          cwd: WORK_DIR,
          allowedHtmlElements: allowedHTMLElements,
          modificationTagName: MODIFICATIONS_TAG_NAME,
          designScheme,
          supabase: {
            isConnected: options?.supabaseConnection?.isConnected || false,
            hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
            credentials: options?.supabaseConnection?.credentials || undefined,
          },
        }) ?? getSystemPrompt();
      break;
  }
  // END: Logic to select the system prompt

  // The context buffer is still useful for all modes that need file context
  if ((chatMode === 'build' || chatMode === 'patch') && contextFiles && contextOptimization) {
    const codeContext = createFilesContext(contextFiles, true);

    systemPrompt = `${systemPrompt}\n\nBelow is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.\nCONTEXT BUFFER:\n---\n${codeContext}\n---`;

    if (summary) {
      systemPrompt = `${systemPrompt}\n\n_below is the chat history till now_\nCHAT SUMMARY:\n---\n${props.summary}\n---`;

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();
        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
    }
  }

  const effectiveLockedFilePaths = new Set<string>();

  if (files) {
    for (const [filePath, fileDetails] of Object.entries(files)) {
      if (fileDetails?.isLocked) {
        effectiveLockedFilePaths.add(filePath);
      }
    }
  }

  if (effectiveLockedFilePaths.size > 0) {
    const lockedFilesListString = Array.from(effectiveLockedFilePaths)
      .map((filePath) => `- ${filePath}`)
      .join('\n');
    systemPrompt = `${systemPrompt}\n\nIMPORTANT: The following files are locked and MUST NOT be modified in any way. Do not suggest or make any changes to these files. You can proceed with the request but DO NOT make any changes to these files specifically:\n${lockedFilesListString}\n---`;
  } else {
    console.log('No locked files found from any source for prompt.');
  }

  logger.info(`Sending llm call to ${provider.name} with model ${modelDetails.name}`);

  return await _streamText({
    model: provider.getModelInstance({
      model: modelDetails.name,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
    system: systemPrompt, // Use the dynamically selected system prompt
    maxTokens: dynamicMaxTokens,
    messages: convertToCoreMessages(processedMessages as any),
    ...options,
  });
}