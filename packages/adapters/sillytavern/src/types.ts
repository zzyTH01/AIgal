import type { CharacterDefinition } from '@ag/schemas';

/** SillyTavern Character Card V2（JSON 形式；PNG 元数据卡由导入器负责嵌入）。 */
export interface STCardData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  extensions: Record<string, unknown>;
  character_book?: STWorldBook;
}

export interface STCharacterCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: STCardData;
}

export interface STWorldBookEntry {
  uid: number;
  comment?: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  position: 'before_char' | 'after_char';
  depth: number;
  order: number;
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
}

export interface STWorldBook {
  entries: Record<string, STWorldBookEntry>;
}

export interface STPromptSections {
  systemRules: string;
  currentState: string;
  recentEvents: string;
  memories: string;
  internalState: string;
  task: string;
}

export interface STExtensionRequest {
  type: string;
  requestId?: string;
  payload?: unknown;
}

export interface STExtensionResponse {
  type: string;
  requestId?: string;
  payload?: unknown;
  error?: string;
}

export interface STExtensionHandler {
  (payload: unknown): unknown | Promise<unknown>;
}

export interface STExtensionBridgeConfig {
  prefix?: string;
}

/** 扩展槽位：始终保存完整 CharacterDefinition，保证 round-trip 无损。 */
export const AG_EXTENSION_KEY = 'ag';

export interface AgCardExtension {
  characterDefinition: CharacterDefinition;
}
