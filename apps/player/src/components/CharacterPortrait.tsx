export function CharacterPortrait({
  name,
  emotion,
  src,
}: {
  name: string;
  emotion?: string;
  src?: string;
}) {
  return (
    <figure data-testid="character-portrait" aria-label={`${name} 立绘`}>
      {src ? (
        <img src={src} alt={name} width={120} height={160} style={{ borderRadius: 12 }} />
      ) : (
        <div
          style={{
            width: 120,
            height: 160,
            background: 'linear-gradient(160deg, #a8c0e0, #7c6ea8)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 20,
          }}
        >
          {name}
        </div>
      )}
      <figcaption>
        {name}
        {emotion ? ` · ${emotion}` : ''}
      </figcaption>
    </figure>
  );
}
