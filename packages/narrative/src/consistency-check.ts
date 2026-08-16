export interface NarrativeConsistencyRules {
  /** 必须出现的角色名/人称（至少一个）。 */
  allowedCharacters?: string[];
  /** 禁止出现的主题词。 */
  forbiddenTopics?: string[];
  /** 文本为空或过短视为不一致。 */
  minLength?: number;
}

export function checkNarrativeConsistency(
  text: string,
  rules: NarrativeConsistencyRules,
): string[] {
  const issues: string[] = [];
  if (text.trim().length < (rules.minLength ?? 1)) {
    issues.push('narrative is empty');
  }
  for (const topic of rules.forbiddenTopics ?? []) {
    if (text.includes(topic)) issues.push(`forbidden topic: ${topic}`);
  }
  if (rules.allowedCharacters && rules.allowedCharacters.length > 0) {
    const matched = rules.allowedCharacters.some((character) => text.includes(character));
    if (!matched) {
      issues.push(
        `narrative does not mention any allowed character: ${rules.allowedCharacters.join('/')}`,
      );
    }
  }
  return issues;
}
