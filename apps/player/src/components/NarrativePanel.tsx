export interface NarrativeEntry {
  id: string;
  text: string;
  /** transition：选项节点之间的过场文段（旁白+对话）。 */
  kind?: 'scenario' | 'reaction' | 'transition';
}

export function NarrativePanel({ entries }: { entries: NarrativeEntry[] }) {
  return (
    <div data-testid="narrative-panel" aria-live="polite">
      {entries.map((entry) =>
        entry.kind === 'transition' ? (
          <p
            key={entry.id}
            data-testid="transition-line"
            style={{ fontStyle: 'italic', opacity: 0.8 }}
          >
            {entry.text}
          </p>
        ) : (
          <p key={entry.id}>{entry.text}</p>
        ),
      )}
    </div>
  );
}
