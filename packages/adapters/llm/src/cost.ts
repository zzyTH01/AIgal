import type { LLMUsage } from './llm-port.js';

export interface TokenUsageRecord {
  timestamp: string;
  model: string;
  usage: LLMUsage;
  durationMs: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface UsageListener {
  onUsage(record: TokenUsageRecord): void;
}

export class InMemoryUsageStore implements UsageListener {
  readonly records: TokenUsageRecord[] = [];

  onUsage(record: TokenUsageRecord): void {
    this.records.push(record);
  }

  totalCostUsd(): number {
    return this.records.reduce((sum, record) => sum + record.totalCostUsd, 0);
  }
}

export function calculateUsageCost(
  usage: LLMUsage | undefined,
  costPerInputToken = 0,
  costPerOutputToken = 0,
): { inputCostUsd: number; outputCostUsd: number; totalCostUsd: number } {
  const promptTokens = usage?.promptTokens ?? 0;
  const completionTokens = usage?.completionTokens ?? 0;
  const inputCostUsd = (promptTokens / 1000) * costPerInputToken;
  const outputCostUsd = (completionTokens / 1000) * costPerOutputToken;
  return { inputCostUsd, outputCostUsd, totalCostUsd: inputCostUsd + outputCostUsd };
}
