import { describe, expect, it } from 'vitest';
import { TestProvider } from './index.js';

describe('@ag/llm package entry', () => {
  it('exports a working TestProvider', async () => {
    const provider = TestProvider.fromText('hello');
    expect(await provider.generate({ messages: [] })).toEqual({ text: 'hello' });
  });
});
