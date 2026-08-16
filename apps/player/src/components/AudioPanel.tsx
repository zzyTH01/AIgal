export function AudioPanel() {
  return (
    <div data-testid="audio-panel" aria-label="音频面板（占位）">
      <button type="button" disabled>
        TTS（后续接入）
      </button>
      <button type="button" disabled>
        BGM（后续接入）
      </button>
      <button type="button" disabled>
        SE（后续接入）
      </button>
    </div>
  );
}
