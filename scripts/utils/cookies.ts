export function extractSetCookieHeaders(res: Response): string[] {
  const all = (
    res.headers as unknown as { getSetCookie?: () => string[] }
  ).getSetCookie?.() as string[] | undefined;
  return (
    all ??
    (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : [])
  );
}

export function pickCookie(res: Response, name: string): string | null {
  const list = extractSetCookieHeaders(res);
  for (const entry of list) {
    if (entry.startsWith(`${name}=`)) return entry.split(';')[0];
  }
  return null;
}

export function mergeCookies(existing: string | null, res: Response): string {
  const jar = new Map<string, string>();
  for (const part of (existing ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const [name, ...rest] = part.split('=');
    if (name) jar.set(name, rest.join('='));
  }
  const list = extractSetCookieHeaders(res);
  for (const entry of list) {
    const [pair] = entry.split(';');
    const [name, ...rest] = pair.split('=');
    if (name) jar.set(name, rest.join('='));
  }
  return [...jar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}
