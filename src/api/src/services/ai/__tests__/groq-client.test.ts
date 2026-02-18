/**
 * Groq Client Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GroqClient } from '../clients/groq.client.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GroqClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw if no API key provided', () => {
      expect(() => new GroqClient('')).toThrow('Groq API key is required');
    });

    it('should create client with valid API key', () => {
      const client = new GroqClient('test-api-key');
      expect(client.provider).toBe('groq');
    });

    it('should use default model if not specified', () => {
      const client = new GroqClient('test-api-key');
      expect(client.provider).toBe('groq');
    });

    it('should accept custom model', () => {
      const client = new GroqClient('test-api-key', 'llama-3.3-70b-versatile');
      expect(client.provider).toBe('groq');
    });
  });

  describe('complete', () => {
    it('should make correct API call', async () => {
      const client = new GroqClient('test-api-key');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-3.3-70b-versatile',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you?',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
        }),
      });

      const response = await client.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          },
        })
      );

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.usage.totalTokens).toBe(18);
      expect(response.finishReason).toBe('stop');
    });

    it('should handle JSON response format', async () => {
      const client = new GroqClient('test-api-key');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test-id',
          model: 'llama-3.3-70b-versatile',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: '{"result": "test"}',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const response = await client.complete(
        [{ role: 'user', content: 'Return JSON' }],
        { responseFormat: 'json' }
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(response.content).toBe('{"result": "test"}');
    });

    it('should handle API errors', async () => {
      const client = new GroqClient('test-api-key');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        client.complete([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow('Groq API error (429): Rate limit exceeded');
    });

    it('should handle timeout', async () => {
      const client = new GroqClient('test-api-key');
      
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 100);
        })
      );

      await expect(
        client.complete(
          [{ role: 'user', content: 'Hello' }],
          { timeoutMs: 50 }
        )
      ).rejects.toThrow('Groq request timed out after 50ms');
    });
  });

  describe('healthCheck', () => {
    it('should return true on success', async () => {
      const client = new GroqClient('test-api-key');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          model: 'test',
        }),
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const client = new GroqClient('test-api-key');
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });
});
