import { describe, expect, it, vi } from 'vitest';
import { OpenAIAdapter } from './openai-adapter.js';
import { OpenAICompatibleAdapter } from './openai-compatible-adapter.js';
import { AnthropicAdapter } from './anthropic-adapter.js';
import { createGateway, supportedGatewayKinds } from './registry.js';
import { InMemoryUsageStore } from './cost.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenAIAdapter', () => {
  it('sends OpenAI-shaped requests and maps usage/cost', async () => {
    const usageStore = new InMemoryUsageStore();
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer test-key' });
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('gpt-test');
      expect(body.messages[0].content).toBe('hello');
      return jsonResponse(200, {
        choices: [{ message: { content: 'world' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });
    });
    const adapter = new OpenAIAdapter(
      {
        apiKey: 'test-key',
        model: 'gpt-test',
        baseUrl: 'https://mock.local/v1',
        costPerInputToken: 0.01,
        costPerOutputToken: 0.02,
      },
      { fetchImpl, usageListener: usageStore },
    );

    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hello' }] });
    expect(result.text).toBe('world');
    expect(result.usage?.promptTokens).toBe(10);
    expect(usageStore.records[0]?.totalCostUsd).toBeCloseTo(0.0002);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retries rate-limit then succeeds', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse(429, { error: { message: 'slow down' } });
      return jsonResponse(200, {
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    });
    const adapter = new OpenAIAdapter(
      { apiKey: 'test-key', model: 'gpt-test', baseUrl: 'https://mock.local/v1', maxRetries: 1 },
      { fetchImpl },
    );
    const result = await adapter.generate({ messages: [{ role: 'user', content: 'retry' }] });
    expect(result.text).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry authentication errors', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: { message: 'bad key' } }));
    const adapter = new OpenAIAdapter(
      { apiKey: 'bad', model: 'gpt-test', baseUrl: 'https://mock.local/v1', maxRetries: 2 },
      { fetchImpl },
    );
    await expect(adapter.generate({ messages: [] })).rejects.toMatchObject({ code: 'auth_error' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe('OpenAICompatibleAdapter', () => {
  it('requires baseUrl for local/compatible providers', () => {
    expect(() => new OpenAICompatibleAdapter({ apiKey: 'k', model: 'm' })).toThrow(/baseUrl/);
  });
});

describe('AnthropicAdapter', () => {
  it('sends Anthropic-shaped requests and maps text/usage', async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.system).toBe('system rule');
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(init?.headers).toMatchObject({ 'x-api-key': 'anthropic-key' });
      return jsonResponse(200, {
        content: [{ type: 'text', text: 'anthropic response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 7, output_tokens: 3 },
      });
    });
    const adapter = new AnthropicAdapter(
      { apiKey: 'anthropic-key', model: 'claude-test', baseUrl: 'https://mock.local' },
      { fetchImpl },
    );
    const result = await adapter.generate({
      messages: [
        { role: 'system', content: 'system rule' },
        { role: 'user', content: 'hi' },
      ],
    });
    expect(result.text).toBe('anthropic response');
    expect(result.usage?.totalTokens).toBe(10);
  });
});

describe('Gateway registry', () => {
  it('creates adapters from provider config', () => {
    expect(supportedGatewayKinds()).toEqual(['openai', 'anthropic', 'openai-compatible']);
    expect(createGateway({ kind: 'openai', apiKey: 'k', model: 'm' })).toBeInstanceOf(
      OpenAIAdapter,
    );
    expect(
      createGateway({
        kind: 'openai-compatible',
        apiKey: 'k',
        model: 'm',
        baseUrl: 'http://localhost:11434/v1',
      }),
    ).toBeInstanceOf(OpenAICompatibleAdapter);
    expect(createGateway({ kind: 'anthropic', apiKey: 'k', model: 'm' })).toBeInstanceOf(
      AnthropicAdapter,
    );
  });
});
