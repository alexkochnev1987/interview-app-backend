export function trimField(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value
    .trim()
    .replace(/[.?!]+$/, '')
    .slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : undefined;
}
