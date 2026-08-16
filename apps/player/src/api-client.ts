import { ApplicationApi } from '@ag/runtime';

export interface PlayerApi {
  start(): ReturnType<ApplicationApi['gameStart']>;
  nextTurn(): ReturnType<ApplicationApi['turnStart']>;
  choose(optionId: string): ReturnType<ApplicationApi['turnChoice']>;
  state(): ReturnType<ApplicationApi['gameState']>;
  save(saveId: string): ReturnType<ApplicationApi['save']>;
  load(saveId: string): ReturnType<ApplicationApi['load']>;
  exportGame(): ReturnType<ApplicationApi['export']>;
}

export function createPlayerApi(): PlayerApi {
  const api = new ApplicationApi();
  return {
    start: () => api.gameStart(),
    nextTurn: () => api.turnStart(),
    choose: (optionId: string) => api.turnChoice(optionId),
    state: () => api.gameState(),
    save: (saveId: string) => api.save(saveId),
    load: (saveId: string) => api.load(saveId),
    exportGame: () => api.export(),
  };
}
