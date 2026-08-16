import type { GameState } from '@ag/schemas';
import { GameRuntime, type RuntimeConfig } from './game-runtime.js';

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Application API 的服务端形态（CLI/HTTP 共用）：
 * /game/start /turn/start /turn/choice /game/state /save /load /export。
 */
export class ApplicationApi {
  constructor(readonly runtime: GameRuntime = new GameRuntime()) {}

  static create(config: RuntimeConfig = {}): ApplicationApi {
    return new ApplicationApi(new GameRuntime(config));
  }

  async gameStart(): Promise<ApiResult<GameState>> {
    return this.run(() => this.runtime.startGame());
  }

  async turnStart(): Promise<ApiResult<Awaited<ReturnType<GameRuntime['startTurn']>>>> {
    return this.run(() => this.runtime.startTurn());
  }

  async turnChoice(
    optionId: string,
  ): Promise<ApiResult<Awaited<ReturnType<GameRuntime['chooseOption']>>>> {
    return this.run(() => this.runtime.chooseOption(optionId));
  }

  async gameState(): Promise<ApiResult<GameState>> {
    return this.run(() => this.runtime.getState());
  }

  async save(saveId: string): Promise<ApiResult<GameState>> {
    return this.run(() => this.runtime.save(saveId));
  }

  async load(saveId: string): Promise<ApiResult<GameState>> {
    return this.run(() => this.runtime.load(saveId));
  }

  async export(): Promise<ApiResult<string>> {
    return this.run(() => this.runtime.export());
  }

  private async run<T>(operation: () => T | Promise<T>): Promise<ApiResult<T>> {
    try {
      return { ok: true, data: await operation() };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }
}
