import { describe, expect, it } from 'vitest';
import type { ModelContext } from '@ag/schemas';
import { modelContextToRequest } from './context-request.js';

const context = {
  schemaVersion: '0.1.0',
  runId: 'run_1',
  turnId: 'run_1/day_001/turn_001',
  day: 1,
  time: '09:00',
  systemRules: 'system rules',
  currentState: {
    run: { runId: 'run_1', day: 1, turn: 0, time: '09:00' },
    world: { day: 1, time: '09:00', currentLocationId: 'loc_library' },
    relationships: {
      rel_1: {
        relationshipId: 'rel_1',
        sourceId: 'player',
        targetId: 'char_mio',
        affection: 30,
        trust: 40,
      },
    },
  },
  currentEvent: {
    instanceId: 'e1',
    eventId: 'event_rain',
    runId: 'run_1',
    day: 1,
    turn: 0,
    locationId: 'loc_library',
    title: '雨天',
    description: '下雨了',
    status: 'active',
    createdAt: { day: 1, time: '09:00' },
  },
  recentEvents: [],
  retrievedMemories: [
    {
      id: 'mem_1',
      type: 'episodic',
      content: '玩家帮忙整理书架',
      createdAt: { day: 1, time: '09:00' },
      importance: 50,
      emotionalIntensity: 40,
      valence: 10,
      strength: 60,
      accuracy: 90,
      tags: ['help'],
      relatedCharacters: ['char_mio'],
      sourceTurnId: 't1',
      retrievalCount: 0,
    },
  ],
  internalState: {},
  generationTask: { task: 'generate_scenario', outputSchema: 'scenario.schema.json' },
  budget: {
    capacity: 80,
    systemRules: 15,
    currentState: 15,
    recentEvents: 20,
    memories: 20,
    internalState: 10,
  },
} as unknown as ModelContext;

describe('modelContextToRequest', () => {
  it('converts context sections into provider messages', () => {
    const request = modelContextToRequest(context);
    expect(request.messages[0]).toEqual({ role: 'system', content: 'system rules' });
    expect(request.messages[1]?.content).toContain('雨天');
    expect(request.messages[1]?.content).toContain('玩家帮忙整理书架');
    expect(request.messages[1]?.content).toContain('affection 30');
    expect(request.responseSchema).toBe('scenario.schema.json');
  });
});
