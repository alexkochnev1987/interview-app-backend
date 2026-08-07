export type TemplateChoice = { kind: 'own' } | { kind: 'index'; index: number };

const CREATE_OWN_PATTERN = /\b(?:create\s+)?my\s+own\b/i;

export function parseTemplateChoice(message: string): TemplateChoice | null {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  if (CREATE_OWN_PATTERN.test(trimmed) || /^own$/i.test(trimmed)) {
    return { kind: 'own' };
  }

  const indexMatch = trimmed.match(/^(?:template\s*)?(\d+)$/i);
  if (indexMatch) {
    return { kind: 'index', index: Number.parseInt(indexMatch[1], 10) };
  }

  return null;
}
