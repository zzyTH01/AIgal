export function StrategyHint({ independence, empathy }: { independence: number; empathy: number }) {
  if (independence >= 75) {
    return (
      <p data-testid="strategy-hint" role="note">
        她独立性很强：少用“帮忙/保护”，多用尊重、真诚与共同选择，Good End 更可达。
      </p>
    );
  }
  if (empathy >= 75) {
    return (
      <p data-testid="strategy-hint" role="note">
        她共情力很高：真诚表达感受会更容易建立信任。
      </p>
    );
  }
  return null;
}
