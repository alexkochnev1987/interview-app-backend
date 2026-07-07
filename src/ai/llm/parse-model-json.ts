export function extractJsonStringFromModelOutput(text: string): string {
  let trimmed = text.trim();

  const fullFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fullFenceMatch?.[1]) {
    trimmed = fullFenceMatch[1].trim();
  } else {
    trimmed = trimmed.replace(/^```(?:json)?\s*\n?/i, '');
    trimmed = trimmed.replace(/\n?```\s*$/i, '').trim();
  }

  const balanced = extractBalancedJson(trimmed);
  if (balanced) {
    return balanced;
  }

  return trimmed;
}

function extractBalancedJson(text: string): string | undefined {
  const startIdx = text.search(/[{[]/);
  if (startIdx < 0) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth++;
    }
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }

  return undefined;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseJsonFromModelOutput(text: string): unknown | undefined {
  try {
    const extracted = extractJsonStringFromModelOutput(text);
    return JSON.parse(extracted) as unknown;
  } catch {
    return undefined;
  }
}
