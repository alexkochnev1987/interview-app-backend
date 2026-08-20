import { createHash } from 'crypto';

import { ONBOARDING_STARTER_EMAIL_SUFFIX } from '../common/onboarding-starter';
import type {
  Answer,
  Interview,
  InterviewQuestion,
} from '../interview/interfaces/interview.interface';
import type { Locale } from '../locale/locale.constants';
import type { UserRole } from '../user/interfaces/user.interface';
import type { DemoSeedExecutor } from './demo-seed-core';

const LOCALE: Locale = 'en';
const STARTED_AT = new Date('2026-06-15T10:00:00.000Z');
const SUBMITTED_AT = new Date('2026-06-15T10:18:00.000Z');

export function shouldSeedOnboardingLitePack(
  role: UserRole,
  demo = false,
): boolean {
  if (demo) {
    return false;
  }

  return role === 'hr' || role === 'admin' || role === 'super_admin';
}

export function onboardingStarterStableId(
  userId: string,
  part: string,
): string {
  const hex = createHash('sha256')
    .update(`onboarding-lite:${userId}:${part}`)
    .digest('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function embeddedQuestion(
  id: string,
  category: string,
  questionText: string,
): InterviewQuestion {
  return {
    id,
    primaryLocale: LOCALE,
    translations: {
      [LOCALE]: {
        questionText,
        followUpQuestions: [],
        expectedConcepts: [],
        redFlags: [],
      },
    },
    outputLanguage: 'English',
    category,
    questionText,
    followUpQuestions: [],
    expectedConcepts: [],
    redFlags: [],
    difficulty: 'medium',
    weight: 1,
    minimumPassScore: 0.5,
    tags: ['onboarding-sample'],
    metadata: { onboardingSample: true },
  };
}

function submittedAwaitingAnswer(
  questionId: string,
  index: number,
  transcript: string,
): Answer {
  return {
    questionIndex: index,
    questionId,
    status: 'submitted',
    uploadedAt: SUBMITTED_AT,
    durationSeconds: 90 + index * 10,
    retakeCount: 0,
    startedAt: STARTED_AT,
    submittedAt: SUBMITTED_AT,
    behaviorSignals: {
      tabHiddenCount: 0,
      windowBlurCount: 0,
      pasteCount: 0,
      keydownCount: 0,
      copyCount: 0,
      resizeCount: 0,
    },
    transcript: {
      text: transcript,
      language: 'en-US',
      provider: 'onboarding-sample',
      generatedAt: SUBMITTED_AT,
      isFinal: true,
    },
    validation: {
      status: 'idle',
    },
  } as Answer;
}

export function buildOnboardingLiteInterview(userId: string): Interview {
  const interviewId = onboardingStarterStableId(userId, 'interview');
  const questions = [
    embeddedQuestion(
      onboardingStarterStableId(userId, 'q1'),
      'JavaScript',
      'What is a closure in JavaScript, and when would you use one?',
    ),
    embeddedQuestion(
      onboardingStarterStableId(userId, 'q2'),
      'React',
      'Explain the difference between state and props in React.',
    ),
  ];

  return {
    id: interviewId,
    candidateName: 'Sample candidate',
    candidateEmail: `${userId}${ONBOARDING_STARTER_EMAIL_SUFFIX}`,
    position: 'Frontend Trainee (example)',
    interviewLocale: LOCALE,
    questions,
    answers: [
      submittedAwaitingAnswer(
        questions[0].id,
        0,
        'A closure keeps access to its lexical scope. I use them for private state and factory helpers.',
      ),
      submittedAwaitingAnswer(
        questions[1].id,
        1,
        'Props are read-only from the parent; state is local and updated with a setter, which triggers a re-render.',
      ),
    ],
    status: 'in_progress',
    createdById: userId,
    demo: false,
    createdAt: STARTED_AT,
    updatedAt: SUBMITTED_AT,
  };
}

async function starterInterviewExists(
  db: DemoSeedExecutor,
  userId: string,
): Promise<boolean> {
  const result = await db.query(
    `
      SELECT 1
      FROM interviews
      WHERE created_by_id = $1
        AND candidate_email = $2
      LIMIT 1
    `,
    [userId, `${userId}${ONBOARDING_STARTER_EMAIL_SUFFIX}`],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function seedOnboardingLitePack(
  db: DemoSeedExecutor,
  userId: string,
): Promise<{ interviews: number }> {
  if (await starterInterviewExists(db, userId)) {
    return { interviews: 0 };
  }

  const interview = buildOnboardingLiteInterview(userId);

  await db.query(
    `
      INSERT INTO interviews (
        id, candidate_name, candidate_email, position, interview_locale,
        questions_json, answers_json, status, result_json, workflow_json,
        created_by_id, created_at, updated_at, demo
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, NULL, NULL, $9, $10, $11, FALSE
      )
      ON CONFLICT (id) DO NOTHING
    `,
    [
      interview.id,
      interview.candidateName,
      interview.candidateEmail ?? null,
      interview.position,
      interview.interviewLocale,
      JSON.stringify(interview.questions),
      JSON.stringify(interview.answers),
      interview.status,
      userId,
      interview.createdAt,
      interview.updatedAt,
    ],
  );

  return { interviews: 1 };
}
