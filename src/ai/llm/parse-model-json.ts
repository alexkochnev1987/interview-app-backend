/**
 * Strips optional ```json fences and trims the payload.
 */
export function extractJsonStringFromModelOutput(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function parseJsonFromModelOutput(text: string): unknown {
  const extracted = extractJsonStringFromModelOutput(text);
  return JSON.parse(extracted) as unknown;
}
