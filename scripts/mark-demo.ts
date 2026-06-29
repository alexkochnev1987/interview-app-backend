/*
 * Marks an existing interview as the demo interview on a remote environment by
 * calling the admin-only endpoint. No database access needed. Flips the chosen
 * interview to demo, reassigns it to the demo account and removes the fabricated
 * placeholder demo interview.
 *
 * Run from the backend folder, e.g. against dev:
 *   $env:PROD_BASE_URL  = "https://develop.d1z0clbcev0y8a.amplifyapp.com/api"
 *   $env:ADMIN_EMAIL    = "admin@interview-app.com"
 *   $env:ADMIN_PASSWORD = "admin123"
 *   $env:INTERVIEW_ID   = "00000000-0000-4000-8000-0000000000a1"
 *   npx ts-node scripts/mark-demo.ts
 */
export {};

const BASE = (process.env.PROD_BASE_URL ?? '').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const INTERVIEW_ID = process.env.INTERVIEW_ID ?? '';

function pickCookie(res: Response, name: string): string | null {
  const all = (res.headers as any).getSetCookie?.() as string[] | undefined;
  const list = all ?? (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
  for (const entry of list) {
    if (entry.startsWith(`${name}=`)) return entry.split(';')[0];
  }
  return null;
}

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function main(): Promise<void> {
  if (!BASE || !ADMIN_EMAIL || !ADMIN_PASSWORD || !INTERVIEW_ID) {
    throw new Error('Set PROD_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD and INTERVIEW_ID.');
  }

  console.log(`Marking interview ${INTERVIEW_ID} as demo on ${BASE} ...`);
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`login -> ${loginRes.status}: ${await readBody(loginRes)}`);
  const cookie = pickCookie(loginRes, 'session');
  if (!cookie) throw new Error('No session cookie returned from login.');

  const res = await fetch(`${BASE}/interviews/${INTERVIEW_ID}/mark-demo`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const body = await readBody(res);
  if (!res.ok) {
    if (res.status === 403) {
      console.error(
        `\nThe environment blocked marking (403). This means it runs as production, ` +
          `so it needs ALLOW_DEMO_SEED=true set on the backend. Ask the mentor to set that ` +
          `one variable, then run this again.\n\nServer said: ${body}`,
      );
    } else {
      console.error(`\nMarking failed -> ${res.status}: ${body}`);
    }
    process.exit(1);
  }

  console.log('\nInterview marked as demo successfully.');
  console.log(body);
  console.log('\nThe read-only demo should now show this interview.');
}

void main().catch((e) => {
  console.error('\nFAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
