/**
 * Groq LLM Client
 * Implementation for Groq API (Llama 3.1 70B)
 * 
 * Tier gratuito: 30 req/min, 14.4K tokens/min
 */

import type {
  LLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResponse,
} from '../types.js';

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqChatRequest {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'text' | 'json_object' };
  stop?: string[];
}

interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GroqClient implements LLMClient {
  readonly provider = 'groq';
  private apiKey: string;
  private defaultModel: string;
  private baseUrl = 'https://api.groq.com/openai/v1';

  constructor(apiKey: string, model = 'llama-3.3-70b-versatile') {
    if (!apiKey) {
      throw new Error('Groq API key is required');
    }
    this.apiKey = apiKey;
    this.defaultModel = model;
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    const model = options?.model ?? this.defaultModel;
    const timeout = options?.timeoutMs ?? 30000;

    const requestBody: GroqChatRequest = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stop: options?.stop,
    };

    // Groq supports JSON mode
    if (options?.responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorBody}`);
      }

      const data = (await response.json()) as GroqChatResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw new Error('No response choice from Groq');
      }

      return {
        content: choice.message.content ?? '',
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        model: data.model,
        finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Groq request timed out after ${timeout}ms`);
        }
        throw error;
      }
      
      throw new Error('Unknown error in Groq client');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.complete(
        [{ role: 'user', content: 'ping' }],
        { maxTokens: 5, timeoutMs: 10000 }
      );
      return true;
    } catch {
      return false;
    }
  }
}
