import type { GameState } from '@ag/schemas';

export function RelationshipPanel({ state }: { state: GameState | null }) {
  const relationships = Object.values(state?.relationships ?? {});
  return (
    <aside data-testid="relationship-panel">
      {relationships.length === 0 ? (
        <span>暂无关系</span>
      ) : (
        relationships.map((relationship) => (
          <div key={relationship.relationshipId}>
            {relationship.sourceId} → {relationship.targetId}（{relationship.type}）：好感{' '}
            {relationship.affection} / 信任 {relationship.trust}
          </div>
        ))
      )}
    </aside>
  );
}
