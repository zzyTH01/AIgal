export function Background({ locationName }: { locationName?: string }) {
  return (
    <div
      data-testid="background"
      aria-label={`背景：${locationName ?? '未知地点'}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: 'linear-gradient(180deg, #0f2027, #203a43, #2c5364)',
      }}
    />
  );
}
