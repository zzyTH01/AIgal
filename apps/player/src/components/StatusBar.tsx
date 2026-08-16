import type { GameState } from '@ag/schemas';

export function StatusBar({ state }: { state: GameState | null }) {
  if (!state) return <div data-testid="status-bar">未开始</div>;
  return (
    <div data-testid="status-bar" role="status">
      Day {state.run.day} ｜ {state.run.time} ｜ Progress {state.run.dailyProgress}/
      {state.run.dailyProgressLimit} ｜ Turn {state.run.turn}
    </div>
  );
}
