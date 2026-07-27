/*
 * Seeds a completed interview in the local dev DB for HR candidate-feedback testing.
 *
 * Prerequisites:
 *   - docker compose up -d
 *   - npm run start:dev (or API on BASE_URL)
 *   - AI_PROVIDER + API key in .env (validation eval + later feedback generate)
 *   - OPENAI_API_KEY optional if answers include clientTranscript (Whisper fallback)
 *
 * Usage (from backend root):
 *   npx ts-node scripts/seed-local-feedback-case.ts
 *
 * Optional env:
 *   BASE_URL=http://localhost:3000
 *   STAFF_EMAIL=admin@test.local
 *   STAFF_PASSWORD=TestPass123!
 */
export {};

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
const STAFF_EMAIL = process.env.STAFF_EMAIL ?? 'admin@test.local';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD ?? 'TestPass123!';
const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

function pickCookie(res: Response, name: string): string | null {
  const all = (res.headers as any).getSetCookie?.() as string[] | undefined;
  const list =
    all ?? (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
  for (const entry of list) {
    if (entry.startsWith(`${name}=`)) return entry.split(';')[0];
  }
  return null;
}

function mergeCookies(existing: string | null, res: Response): string {
  const jar = new Map<string, string>();
  for (const part of (existing ?? '').split(';').map((item) => item.trim()).filter(Boolean)) {
    const [name, ...rest] = part.split('=');
    if (name) jar.set(name, rest.join('='));
  }
  const all = (res.headers as any).getSetCookie?.() as string[] | undefined;
  const list =
    all ?? (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
  for (const entry of list) {
    const [pair] = entry.split(';');
    const [name, ...rest] = pair.split('=');
    if (name) jar.set(name, rest.join('='));
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.url}: ${text}`);
  }
  return JSON.parse(text) as T;
}

function authHeaders(cookie: string): Record<string, string> {
  return { Cookie: cookie, 'Content-Type': 'application/json' };
}

function buildQuestionPayload(questionText: string) {
  return {
    primaryLocale: 'en',
    translations: {
      en: {
        questionText,
        followUpQuestions: ['Can you give a concrete example?'],
        expectedConcepts: [
          {
            id: 'core_concept',
            label: 'Core concept',
            weight: 1,
            description: 'Clear structured answer.',
          },
        ],
        redFlags: [
          { id: 'hand_wavy', label: 'Hand-wavy answer', severity: 'medium' },
        ],
        sampleGoodAnswer: 'A concrete answer with trade-offs.',
      },
    },
    difficulty: 'medium',
    weight: 1,
    tags: ['local-seed', 'candidate-feedback'],
  };
}

function mediaKey(interviewId: string, questionIndex: number) {
  return `dev/interviews/${interviewId}/answers/q${questionIndex}-camera-${Date.now()}.webm`;
}

function buildSubmitPayload(
  interviewId: string,
  questionIndex: number,
  answerText: string,
  versionNumber: number,
  recordingSessionId: string,
) {
  const startedAt = new Date();
  const submittedAt = new Date(startedAt.getTime() + 8_000);
  return {
    questionIndex,
    versionNumber,
    submitAnswer: true,
    mediaKey: mediaKey(interviewId, questionIndex),
    screenMediaKey: mediaKey(interviewId, questionIndex).replace(
      'camera',
      'screen',
    ),
    durationSeconds: 8,
    startedAt: startedAt.toISOString(),
    submittedAt: submittedAt.toISOString(),
    cameraFileSizeBytes: 4096,
    screenFileSizeBytes: 8192,
    behaviorSignals: {
      tabHiddenCount: 0,
      windowBlurCount: 0,
      pasteCount: 0,
      keydownCount: 18,
      copyCount: 0,
      resizeCount: 0,
    },
    clientTranscript: {
      text: answerText,
      language: 'en',
      provider: 'browser',
      generatedAt: submittedAt.toISOString(),
      isFinal: true,
    },
    recordingSessionId,
  };
}

function parseTakeToken(candidateLink: string): string {
  const match = candidateLink.match(/[?&]token=([^&]+)/);
  if (!match?.[1]) {
    throw new Error(`Could not parse token from candidate link: ${candidateLink}`);
  }
  return decodeURIComponent(match[1]);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCompleted(
  cookie: string,
  interviewId: string,
  timeoutMs = 180_000,
): Promise<{ status: string; result?: unknown }> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${BASE}/interviews/${interviewId}`, {
      headers: { Cookie: cookie },
    });
    const interview = await readJson<{
      status: string;
      result?: unknown;
      answers?: Array<{
        questionIndex: number;
        validation?: { status: string; errorMessage?: string };
      }>;
    }>(res);

    if (interview.status === 'completed') {
      return interview;
    }

    const validations = interview.answers?.map(
      (answer) =>
        `q${answer.questionIndex}:${answer.validation?.status ?? 'none'}${
          answer.validation?.errorMessage
            ? ` (${answer.validation.errorMessage.slice(0, 80)})`
            : ''
        }`,
    );
    process.stdout.write(
      `\r  status=${interview.status} validations=[${validations?.join(', ') ?? '?'}]   `,
    );
    await sleep(3000);
  }
  throw new Error(`Interview ${interviewId} did not reach completed within ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  console.log(`API: ${BASE}`);
  console.log(`Staff login: ${STAFF_EMAIL}`);

  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(
      `Login failed (${loginRes.status}). Try STAFF_EMAIL/STAFF_PASSWORD env vars.\n${body}`,
    );
  }
  const cookie = pickCookie(loginRes, 'session');
  if (!cookie) throw new Error('No session cookie from login');

  console.log('Creating questions...');
  const stamp = Date.now();
  const cases = [
    {
      questionText: `How would you reduce API latency under load? [seed ${stamp}]`,
      answerText:
        'Profile hot paths, add caching on read-heavy endpoints, and scale the API tier. We cut p95 from 900ms to 180ms.',
    },
    {
      questionText: `How do you handle a production incident? [seed ${stamp}]`,
      answerText:
        'Set severity, page on-call, rollback or flag the change, post updates every 15 minutes, then run a postmortem with owners and deadlines.',
    },
  ] as const;

  const questionIds: string[] = [];
  for (const item of cases) {
    const questionRes = await fetch(`${BASE}/questions`, {
      method: 'POST',
      headers: authHeaders(cookie),
      body: JSON.stringify(buildQuestionPayload(item.questionText)),
    });
    const question = await readJson<{ id: string }>(questionRes);
    questionIds.push(question.id);
  }

  console.log('Creating interview...');
  const interviewRes = await fetch(`${BASE}/interviews`, {
    method: 'POST',
    headers: authHeaders(cookie),
    body: JSON.stringify({
      candidateName: 'Короткие ответы',
      candidateEmail: `short-answers.${stamp}@local.test`,
      position: 'Backend Engineer',
      questionIds,
    }),
  });
  const created = await readJson<{
    id: string;
    candidateLink: string;
  }>(interviewRes);
  const interviewId = created.id;
  const takeToken = parseTakeToken(created.candidateLink);

  console.log('Candidate take flow...');
  const takeOpenRes = await fetch(
    `${BASE}/take/${interviewId}?token=${encodeURIComponent(takeToken)}`,
  );
  let candidateCookie = mergeCookies(null, takeOpenRes);
  await readJson(takeOpenRes);

  for (const questionIndex of [0, 1]) {
    const recordingSessionId = `seed-session-q${questionIndex}`;
    const reserveRes = await fetch(
      `${BASE}/take/${interviewId}/answer/reserve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: candidateCookie,
        },
        body: JSON.stringify({ questionIndex, recordingSessionId }),
      },
    );
    candidateCookie = mergeCookies(candidateCookie, reserveRes);
    const reserved = await readJson<{ versionNumber: number }>(reserveRes);

    const submitRes = await fetch(`${BASE}/take/${interviewId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: candidateCookie,
      },
      body: JSON.stringify(
        buildSubmitPayload(
          interviewId,
          questionIndex,
          cases[questionIndex].answerText,
          reserved.versionNumber,
          recordingSessionId,
        ),
      ),
    });
    candidateCookie = mergeCookies(candidateCookie, submitRes);
    await readJson(submitRes);
    console.log(`  submitted answer q${questionIndex}`);
  }

  console.log('Starting validation (Validate all)...');
  const validateRes = await fetch(`${BASE}/interviews/${interviewId}/validate`, {
    method: 'POST',
    headers: authHeaders(cookie),
  });
  const validateBody = await readJson<{
    queuedCount: number;
    skippedCount: number;
  }>(validateRes);
  console.log(
    `  queued=${validateBody.queuedCount} skipped=${validateBody.skippedCount}`,
  );

  console.log('Waiting for completed...');
  const completed = await waitForCompleted(cookie, interviewId);
  console.log('\nDone.\n');

  const takeUrl = `${FRONTEND_URL}/take/${interviewId}?token=${encodeURIComponent(takeToken)}`;
  const hrUrl = `${FRONTEND_URL}/interviews/${interviewId}`;

  console.log('--- Local candidate-feedback test case ---');
  console.log(`Interview ID:  ${interviewId}`);
  console.log(`Status:        ${completed.status}`);
  console.log(`HR UI:         ${hrUrl}`);
  console.log(`Candidate URL: ${takeUrl}`);
  console.log(`API feedback:  GET ${BASE}/interviews/${interviewId}/candidate-feedback`);
  console.log('');
  console.log('Next: open HR UI → Candidate feedback tab → Generate.');
  console.log('Requires AI_PROVIDER in .env (your server must be restarted after .env changes).');
}

void main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
