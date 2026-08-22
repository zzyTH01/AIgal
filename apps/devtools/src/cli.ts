#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { gameStateSchema, turnResultSchema, type GameState, type TurnResult } from '@ag/schemas';
import { simulateRuns, fingerprint } from './simulation-engine.js';
import { inspectMemory, inspectState } from './inspectors.js';
import { TurnDebugger } from './turn-debugger.js';
import { runV1Acceptance } from './acceptance.js';
import { runLiveVerification } from './live-verify.js';
import { runLivePlaythrough } from './live-play.js';
import { writePlaythroughMarkdown } from './playthrough-markdown.js';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'simulate': {
      const runs = readInt(args, '--runs', 100);
      const turns = readInt(args, '--turns', 50);
      const seed = readInt(args, '--seed', 1000);
      const report = simulateRuns({ runs, turnsPerRun: turns, seedBase: seed });
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    case 'replay': {
      const seed = readInt(args, '--seed', 42);
      const runs = readInt(args, '--runs', 1);
      const report = simulateRuns({ runs, turnsPerRun: 30, seedBase: seed });
      console.log(JSON.stringify({ seed, runs, fingerprint: report.fingerprint }, null, 2));
      return;
    }
    case 'inspect': {
      const file = args[0];
      if (!file) throw new Error('usage: inspect <state.json>');
      const state = gameStateSchema.parse(JSON.parse(await readFile(file, 'utf8'))) as GameState;
      console.log(
        JSON.stringify({ state: inspectState(state), memory: inspectMemory(state) }, null, 2),
      );
      return;
    }
    case 'acceptance': {
      console.log(JSON.stringify(await runV1Acceptance(), null, 2));
      return;
    }
    case 'live-verify': {
      const turns = readInt(args, '--turns', 30);
      const seed = readInt(args, '--seed', 20260821);
      const demo = args.includes('--demo');
      const report = await runLiveVerification(demo ? { turns, seed, env: {} } : { turns, seed });
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    case 'live-play': {
      const turns = readInt(args, '--turns', 20);
      const seed = readInt(args, '--seed', 20260822);
      const demo = args.includes('--demo');
      const outIndex = args.indexOf('--out');
      const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
      const report = await runLivePlaythrough(demo ? { turns, seed, env: {} } : { turns, seed });
      const target = out ?? 'playthrough.md';
      writePlaythroughMarkdown(
        report,
        `Beat System 对局全记录（${report.providerConfigured ? '真实 DeepSeek' : 'DemoProvider'}）`,
        target,
      );
      console.log(`written: ${target}`);
      return;
    }
    case 'debug-turn': {
      const [file, turnId] = args;
      if (!file || !turnId) throw new Error('usage: debug-turn <history.json> <turnId>');
      const payload = JSON.parse(await readFile(file, 'utf8')) as { turns?: unknown };
      const turns = zArray(turnResultSchema, payload.turns ?? []) as TurnResult[];
      const view = new TurnDebugger(turns).debug(turnId);
      console.log(JSON.stringify(view, null, 2));
      return;
    }
    default:
      console.log(
        'Usage:\n  ag-devtools simulate --runs 100 [--turns 50] [--seed 1000]\n  ag-devtools replay --seed 42\n  ag-devtools inspect <state.json>\n  ag-devtools debug-turn <history.json> <turnId>\n  ag-devtools acceptance\n  ag-devtools live-verify [--turns 30] [--seed 20260821]  # 真实 LLM 复验，经 LLM_* 环境变量配置 Provider\n  ag-devtools live-play [--turns 20] [--out playthrough.md] [--demo]  # 完整对局 Markdown 记录',
      );
  }
}

function readInt(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? Number(args[index + 1]) : fallback;
}

function zArray<T>(schema: { parse(value: unknown): T }, value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error('Expected JSON array');
  return value.map((item) => schema.parse(item));
}

void main().catch((error) => {
  if (process.env.DEBUG_STACK) console.error(error);
  else console.error(String(error));
  process.exitCode = 1;
});

export { fingerprint };
