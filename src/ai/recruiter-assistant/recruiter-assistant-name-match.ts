export function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function scorePersonNameMatch(actual: string, query: string): number {
  const normalizedActual = normalizePersonName(actual);
  const normalizedQuery = normalizePersonName(query);

  if (!normalizedActual || !normalizedQuery) {
    return 0;
  }

  if (normalizedActual === normalizedQuery) {
    return 100;
  }

  if (
    normalizedActual.startsWith(normalizedQuery)
    || normalizedQuery.startsWith(normalizedActual)
  ) {
    return 80;
  }

  const actualTokens = normalizedActual.split(' ');
  const queryTokens = normalizedQuery.split(' ');
  const queryInActual = queryTokens.every((token) => actualTokens.includes(token));
  const actualInQuery = actualTokens.every((token) => queryTokens.includes(token));

  if (queryInActual || actualInQuery) {
    return 70;
  }

  if (
    normalizedActual.includes(normalizedQuery)
    || normalizedQuery.includes(normalizedActual)
  ) {
    return 60;
  }

  const overlap = queryTokens.filter((token) => actualTokens.includes(token)).length;
  if (overlap > 0) {
    return 40 + overlap * 10;
  }

  return 0;
}

export function pickUniqueByPersonName<T>(
  items: T[],
  query: string,
  getName: (item: T) => string,
  minimumScore = 60,
): T | null {
  if (items.length === 0) {
    return null;
  }

  const scored = items
    .map((item) => ({
      item,
      score: scorePersonNameMatch(getName(item), query),
    }))
    .filter((entry) => entry.score >= minimumScore)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return null;
  }

  if (scored.length === 1) {
    return scored[0].item;
  }

  return scored[0].score > scored[1].score ? scored[0].item : null;
}
