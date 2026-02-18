/**
 * LLM Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMService, createLLMClient, resetLLMService } from '../llm-client.js';
import type { LLMClient, LLMCompletionResponse } from '../types.js';

// Mock fetch for GroqClient
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('createLLMClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetLLMService();
  });

  it('should create Groq client when GROQ_API_KEY is set', () => {
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.LLM_PROVIDER = 'groq';

    const client = createLLMClient();

    expect(client.provider).toBe('groq');
  });

  it('should throw if API key is missing', () => {
    delete process.env.GROQ_API_KEY;
    process.env.LLM_PROVIDER = 'groq';

    expect(() => createLLMClient()).toThrow(/Missing API key/);
  });

  it('should use provided API key over env var', () => {
    process.env.GROQ_API_KEY = 'env-key';

    const client = createLLMClient('groq', 'provided-key');

    expect(client.provider).toBe('groq');
  });

  it('should default to groq provider', () => {
    process.env.GROQ_API_KEY = 'test-key';
    delete process.env.LLM_PROVIDER;

    const client = createLLMClient();

    expect(client.provider).toBe('groq');
  });
});

describe('LLMService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.LLM_PROVIDER = 'groq';
  });

  afterEach(() => {
    process.env = originalEnv;
    resetLLMService();
  });

  const mockSuccessResponse = {
    ok: true,
    json: async () => ({
      id: 'test-id',
      model: 'llama-3.3-70b-versatile',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Test response' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    }),
  };

  describe('complete', () => {
    it('should complete successfully', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse);

      const service = new LLMService();
      const response = await service.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(response.content).toBe('Test response');
      expect(response.usage.totalTokens).toBe(15);
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResponse);

      process.env.LLM_RETRY_COUNT = '1';
      process.env.LLM_RETRY_DELAY_MS = '10';

      const service = new LLMService();
      const response = await service.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.content).toBe('Test response');
    });

    it('should use fallback on primary failure', async () => {
      // Set up fallback
      process.env.LLM_FALLBACK_PROVIDER = 'groq';
      process.env.LLM_RETRY_COUNT = '0';

      mockFetch
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce(mockSuccessResponse);

      const service = new LLMService({
        primaryProvider: 'groq',
        fallbackProvider: 'groq', // Same for testing
        primaryApiKey: 'primary-key',
        fallbackApiKey: 'fallback-key',
      });

      const response = await service.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(response.content).toBe('Test response');
    });

    it('should throw after all retries and fallback fail', async () => {
      process.env.LLM_RETRY_COUNT = '0';

      mockFetch.mockRejectedValue(new Error('All failed'));

      const service = new LLMService();

      await expect(
        service.complete([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow(/failed after/);
    });

    it('should use exponential backoff for rate limits', async () => {
      const rateLimitError = new Error('Groq API error (429): Rate limit exceeded');
      
      mockFetch
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockSuccessResponse);

      process.env.LLM_RETRY_COUNT = '2';
      process.env.LLM_RETRY_DELAY_MS = '10';

      const service = new LLMService();
      const startTime = Date.now();
      
      await service.complete([{ role: 'user', content: 'Hello' }]);
      
      const elapsed = Date.now() - startTime;
      // Should have delays: 10ms + 20ms (exponential)
      expect(elapsed).toBeGreaterThanOrEqual(20);
    });
  });

  describe('healthCheck', () => {
    it('should return health status for primary', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse);

      const service = new LLMService();
      const health = await service.healthCheck();

      expect(health.primary.provider).toBe('groq');
      expect(health.primary.healthy).toBe(true);
    });

    it('should include fallback health when configured', async () => {
      process.env.LLM_FALLBACK_PROVIDER = 'groq';
      
      mockFetch
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockResolvedValueOnce(mockSuccessResponse);

      const service = new LLMService({
        primaryProvider: 'groq',
        fallbackProvider: 'groq',
        primaryApiKey: 'key1',
        fallbackApiKey: 'key2',
      });
      
      const health = await service.healthCheck();

      expect(health.fallback).toBeDefined();
      expect(health.fallback?.healthy).toBe(true);
    });

    it('should report unhealthy on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const service = new LLMService();
      const health = await service.healthCheck();

      expect(health.primary.healthy).toBe(false);
    });
  });

  describe('provider property', () => {
    it('should return the primary provider name', () => {
      const service = new LLMService();
      expect(service.provider).toBe('groq');
    });
  });
});
