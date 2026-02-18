/**
 * LLM Client Factory
 * Creates LLM clients based on configuration
 * Supports automatic fallback between providers
 */

import { GroqClient } from './clients/groq.client.js';
import type {
  LLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMProvider,
} from './types.js';

// ============================================
// Provider Configuration
// ============================================

interface ProviderConfig {
  envKey: string;
  defaultModel: string;
}

const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  groq: {
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  google: {
    envKey: 'GOOGLE_AI_API_KEY',
    defaultModel: 'gemini-1.5-flash',
  },
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  mistral: {
    envKey: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-small-latest',
  },
  openrouter: {
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct',
  },
};

// ============================================
// Factory Function
// ============================================

/**
 * Create an LLM client for the specified provider
 * @param provider - LLM provider name
 * @param apiKey - Optional API key (uses env var if not provided)
 * @param model - Optional model override
 */
export function createLLMClient(
  provider?: LLMProvider,
  apiKey?: string,
  model?: string
): LLMClient {
  const selectedProvider = provider ?? (process.env.LLM_PROVIDER as LLMProvider) ?? 'groq';
  const config = PROVIDER_CONFIGS[selectedProvider];
  
  if (!config) {
    throw new Error(`Unknown LLM provider: ${selectedProvider}`);
  }
  
  const key = apiKey ?? process.env[config.envKey];
  const selectedModel = model ?? process.env.LLM_MODEL ?? config.defaultModel;

  if (!key) {
    throw new Error(
      `Missing API key for ${selectedProvider}. ` +
      `Set ${config.envKey} environment variable or pass apiKey parameter.`
    );
  }

  switch (selectedProvider) {
    case 'groq':
      return new GroqClient(key, selectedModel);
    
    // Future implementations:
    // case 'google':
    //   return new GoogleClient(key, selectedModel);
    // case 'anthropic':
    //   return new AnthropicClient(key, selectedModel);
    // case 'mistral':
    //   return new MistralClient(key, selectedModel);
    // case 'openrouter':
    //   return new OpenRouterClient(key, selectedModel);
    
    default:
      // Fallback to Groq for MVP
      console.warn(`Provider ${selectedProvider} not implemented, falling back to Groq`);
      return new GroqClient(
        process.env.GROQ_API_KEY || key,
        selectedModel
      );
  }
}

// ============================================
// LLM Service with Fallback
// ============================================

interface LLMServiceOptions {
  primaryProvider?: LLMProvider;
  fallbackProvider?: LLMProvider;
  primaryApiKey?: string;
  fallbackApiKey?: string;
}

/**
 * LLM Service with automatic fallback
 * Tries primary provider first, falls back to secondary on failure
 */
export class LLMService {
  private primaryClient: LLMClient;
  private fallbackClient?: LLMClient;
  private retryCount: number;
  private retryDelayMs: number;

  constructor(options: LLMServiceOptions = {}) {
    const primaryProvider = options.primaryProvider 
      ?? (process.env.LLM_PROVIDER as LLMProvider) 
      ?? 'groq';
    
    const fallbackProvider = options.fallbackProvider 
      ?? (process.env.LLM_FALLBACK_PROVIDER as LLMProvider | undefined);

    this.primaryClient = createLLMClient(primaryProvider, options.primaryApiKey);
    this.retryCount = parseInt(process.env.LLM_RETRY_COUNT || '2', 10);
    this.retryDelayMs = parseInt(process.env.LLM_RETRY_DELAY_MS || '1000', 10);

    if (fallbackProvider) {
      try {
        this.fallbackClient = createLLMClient(fallbackProvider, options.fallbackApiKey);
        console.log(`[LLM] Fallback provider configured: ${fallbackProvider}`);
      } catch (error) {
        console.warn(
          `[LLM] Fallback provider ${fallbackProvider} not configured:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    console.log(`[LLM] Primary provider: ${this.primaryClient.provider}`);
  }

  /**
   * Complete a prompt with automatic retry and fallback
   */
  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    let lastError: Error | undefined;

    // Try primary client with retries
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        return await this.primaryClient.complete(messages, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const isRateLimited = lastError.message.includes('429') || 
                              lastError.message.toLowerCase().includes('rate limit');
        const isTimeout = lastError.message.toLowerCase().includes('timeout');
        
        console.warn(
          `[LLM] Primary (${this.primaryClient.provider}) attempt ${attempt + 1} failed:`,
          lastError.message
        );

        // Don't retry on certain errors
        if (!isRateLimited && !isTimeout && attempt === this.retryCount) {
          break;
        }

        // Wait before retry (exponential backoff for rate limits)
        if (attempt < this.retryCount) {
          const delay = isRateLimited 
            ? this.retryDelayMs * Math.pow(2, attempt) 
            : this.retryDelayMs;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Try fallback client if available
    if (this.fallbackClient) {
      console.log(`[LLM] Falling back to ${this.fallbackClient.provider}`);
      try {
        return await this.fallbackClient.complete(messages, options);
      } catch (fallbackError) {
        console.error(
          `[LLM] Fallback (${this.fallbackClient.provider}) also failed:`,
          fallbackError instanceof Error ? fallbackError.message : fallbackError
        );
      }
    }

    // All attempts failed
    throw new Error(
      `LLM request failed after ${this.retryCount + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Get the current provider name
   */
  get provider(): string {
    return this.primaryClient.provider;
  }

  /**
   * Check health of all configured clients
   */
  async healthCheck(): Promise<{
    primary: { provider: string; healthy: boolean };
    fallback?: { provider: string; healthy: boolean };
  }> {
    const primaryHealthy = await this.primaryClient.healthCheck();
    
    return {
      primary: {
        provider: this.primaryClient.provider,
        healthy: primaryHealthy,
      },
      fallback: this.fallbackClient
        ? {
            provider: this.fallbackClient.provider,
            healthy: await this.fallbackClient.healthCheck(),
          }
        : undefined,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

let llmServiceInstance: LLMService | null = null;

/**
 * Get the shared LLM service instance
 * Creates one if it doesn't exist
 */
export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

/**
 * Reset the LLM service instance (for testing)
 */
export function resetLLMService(): void {
  llmServiceInstance = null;
}
