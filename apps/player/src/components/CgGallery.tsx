export function CgGallery({ endings }: { endings: string[] }) {
  return (
    <div data-testid="cg-gallery">
      <h3>CG 收集</h3>
      {endings.length === 0 ? (
        <span>尚无 CG</span>
      ) : (
        endings.map((ending) => (
          <div key={ending} data-cg-id={ending}>
            <div
              style={{
                width: 80,
                height: 60,
                background: 'linear-gradient(135deg, #ffd89b, #19547b)',
                borderRadius: 6,
              }}
            />
            <span>{ending}</span>
          </div>
        ))
      )}
    </div>
  );
}
