export interface FlowControlsProps {
  phase: 'idle' | 'awaiting-advance' | 'awaiting-choice';
  autoPlay: boolean;
  onToggleAuto: () => void;
  onAdvance: () => void;
  busy: boolean;
}

/** P0.5 双推进模式：▼ 继续（手动）与自动连播；选择点必停。 */
export function FlowControls({
  phase,
  autoPlay,
  onToggleAuto,
  onAdvance,
  busy,
}: FlowControlsProps) {
  if (phase !== 'awaiting-advance') return null;
  return (
    <div data-testid="flow-controls" style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
      <button type="button" onClick={onAdvance} disabled={busy} aria-label="继续">
        ▼ 继续
      </button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="checkbox" checked={autoPlay} onChange={onToggleAuto} data-testid="auto-play" />
        自动连播
      </label>
    </div>
  );
}
