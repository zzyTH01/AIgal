export interface NarrativeEntry {
  id: string;
  text: string;
}

export function NarrativePanel({ entries }: { entries: NarrativeEntry[] }) {
  return (
    <div data-testid="narrative-panel" aria-live="polite">
      {entries.map((entry) => (
        <p key={entry.id}>{entry.text}</p>
      ))}
    </div>
  );
}
