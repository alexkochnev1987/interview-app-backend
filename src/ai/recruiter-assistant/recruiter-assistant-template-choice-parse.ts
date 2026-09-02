export type TemplateChoice = { kind: 'own' } | { kind: 'index'; index: number };

const CREATE_OWN_PATTERNS = [
  /^(?:create\s+)?my\s+own$/i,
  /^own$/i,
  /^(?:созда(?:ть|й|йте)\s+)?(?:сво[йё]|своё|свой)$/iu,
  /^(?:ствары(?:ць\s+)?)?(?:сво[йё]|свой)$/iu,
  /^(?:utw[oó]rz\s+)?(?:m[oó]j\s+)?w[łl]asny$/iu,
];

const TEMPLATE_INDEX_PATTERN = /^(?:(?:template|шаблон|szablon)\s*)?(\d+)$/iu;

function normalizeChoiceMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .replace(/[,.!?;:«»"'""]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCreateOwnChoice(message: string): boolean {
  const normalized = normalizeChoiceMessage(message);
  return CREATE_OWN_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function parseTemplateChoice(message: string): TemplateChoice | null {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  if (isCreateOwnChoice(trimmed)) {
    return { kind: 'own' };
  }

  const indexMatch = normalizeChoiceMessage(trimmed).match(
    TEMPLATE_INDEX_PATTERN,
  );
  if (indexMatch) {
    return { kind: 'index', index: Number.parseInt(indexMatch[1], 10) };
  }

  return null;
}
