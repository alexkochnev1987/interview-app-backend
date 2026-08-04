const QUOTED_NAME = /["“](.+?)["”]/;
const NAMED_PATTERNS = [
  /\bquestion (?:named|called|titled)\s+(.+?)(?:[.?!]|$)/i,
  /\bcreate (?:a )?question(?:\s+(?:about|on|for))?\s+(.+?)(?:[.?!]|$)/i,
  /\badd (?:a )?(?:new )?question(?:\s+(?:about|on|for))?\s+(.+?)(?:[.?!]|$)/i,
];

export function extractQuestionName(message: string): string | undefined {
  const quoted = message.match(QUOTED_NAME)?.[1]?.trim();
  if (quoted) {
    return quoted.slice(0, 200);
  }

  for (const pattern of NAMED_PATTERNS) {
    const match = message.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      return value.replace(/[.?!]+$/, '').slice(0, 200);
    }
  }
  return undefined;
}
