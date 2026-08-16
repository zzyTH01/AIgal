import type { GameState } from '@ag/schemas';

export interface ContextCacheStats {
  hits: number;
  misses: number;
}

/** 稳定内容缓存：Character Definition / Stable Personality / System Rules。 */
export class ContextCache {
  private readonly systemRules = new Map<string, string>();
  private readonly stableSummaries = new Map<string, string>();
  private stats: ContextCacheStats = { hits: 0, misses: 0 };

  getSystemRules(key: string, factory: () => string): string {
    const cached = this.systemRules.get(key);
    if (cached !== undefined) {
      this.stats.hits += 1;
      return cached;
    }
    const value = factory();
    this.systemRules.set(key, value);
    this.stats.misses += 1;
    return value;
  }

  getStableSummary(state: GameState, characterId: string): string {
    const character = state.characters[characterId];
    const key = `${characterId}:${character?.identity.name ?? ''}:${character?.identity.role ?? ''}`;
    const cached = this.stableSummaries.get(key);
    if (cached !== undefined) {
      this.stats.hits += 1;
      return cached;
    }
    const personality = character?.personality;
    const value = character
      ? [
          `${character.identity.name}（${character.identity.role}）`,
          `人格：独立 ${personality?.independence ?? 50}，共情 ${personality?.empathy ?? 50}，开放 ${personality?.openness ?? 50}`,
        ].join('\n')
      : '';
    this.stableSummaries.set(key, value);
    this.stats.misses += 1;
    return value;
  }

  getStats(): ContextCacheStats {
    return { ...this.stats };
  }
}
