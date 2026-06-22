import './load-env';

import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DatabaseService } from './database.service';
import { runMigrations } from './migration-runner';
import {
  DEMO_INTERVIEWS,
  DEMO_QUESTIONS,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  DEMO_USER_NAME,
} from './demo-seed-data';

type Executor = Pick<DatabaseService, 'query'>;

async function upsertDemoUser(db: Executor): Promise<void> {
  // Random password: the demo login issues a session directly, it is never used.
  const passwordHash = await bcrypt.hash(randomUUID(), 10);
  await db.query(
    `
      INSERT INTO users (id, email, name, role, organization_id, password_hash, demo)
      VALUES ($1, $2, $3, 'hr', NULL, $4, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = 'hr',
        demo = TRUE,
        updated_at = NOW()
    `,
    [DEMO_USER_ID, DEMO_USER_EMAIL, DEMO_USER_NAME, passwordHash],
  );
}

async function upsertDemoQuestions(db: Executor): Promise<void> {
  for (const q of DEMO_QUESTIONS) {
    await db.query(
      `
        INSERT INTO questions (
          id, external_id, role, focus, output_language, category, subcategory,
          text, question_text, follow_up_questions, expected_concepts,
          expected_concepts_json, red_flags, red_flags_json, difficulty, weight,
          sample_good_answer, minimum_pass_score, tags, metadata, deleted,
          usage_count, demo
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13,
          $14::jsonb, $15, $16, $17, $18, $19, $20::jsonb, FALSE, $21, TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          external_id = EXCLUDED.external_id,
          role = EXCLUDED.role,
          focus = EXCLUDED.focus,
          output_language = EXCLUDED.output_language,
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          text = EXCLUDED.text,
          question_text = EXCLUDED.question_text,
          follow_up_questions = EXCLUDED.follow_up_questions,
          expected_concepts = EXCLUDED.expected_concepts,
          expected_concepts_json = EXCLUDED.expected_concepts_json,
          red_flags = EXCLUDED.red_flags,
          red_flags_json = EXCLUDED.red_flags_json,
          difficulty = EXCLUDED.difficulty,
          weight = EXCLUDED.weight,
          sample_good_answer = EXCLUDED.sample_good_answer,
          minimum_pass_score = EXCLUDED.minimum_pass_score,
          tags = EXCLUDED.tags,
          metadata = EXCLUDED.metadata,
          deleted = FALSE,
          usage_count = EXCLUDED.usage_count,
          demo = TRUE,
          updated_at = NOW()
      `,
      [
        q.id,
        q.externalId ?? null,
        q.role ?? null,
        q.focus ?? null,
        q.outputLanguage,
        q.category ?? null,
        q.subcategory ?? null,
        q.questionText,
        q.questionText,
        q.followUpQuestions,
        q.expectedConcepts.map((c) => c.label),
        JSON.stringify(q.expectedConcepts),
        q.redFlags.map((r) => r.label),
        JSON.stringify(q.redFlags),
        q.difficulty,
        q.weight,
        q.sampleGoodAnswer ?? null,
        q.minimumPassScore,
        q.tags,
        JSON.stringify(q.metadata),
        q.usageCount,
      ],
    );
  }
}

async function upsertDemoInterviews(db: Executor): Promise<void> {
  for (const interview of DEMO_INTERVIEWS) {
    await db.query(
      `
        INSERT INTO interviews (
          id, candidate_name, candidate_email, position, questions_json,
          answers_json, status, result_json, workflow_json, created_by_id,
          created_at, updated_at, demo
        )
        VALUES (
          $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, NULL, $9, $10, $11, TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          candidate_name = EXCLUDED.candidate_name,
          candidate_email = EXCLUDED.candidate_email,
          position = EXCLUDED.position,
          questions_json = EXCLUDED.questions_json,
          answers_json = EXCLUDED.answers_json,
          status = EXCLUDED.status,
          result_json = EXCLUDED.result_json,
          created_by_id = EXCLUDED.created_by_id,
          updated_at = EXCLUDED.updated_at,
          demo = TRUE
      `,
      [
        interview.id,
        interview.candidateName,
        interview.candidateEmail ?? null,
        interview.position,
        JSON.stringify(interview.questions),
        JSON.stringify(interview.answers),
        interview.status,
        interview.result ? JSON.stringify(interview.result) : null,
        DEMO_USER_ID,
        interview.createdAt,
        interview.updatedAt,
      ],
    );
  }
}

function assertSeedAllowed(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const optIn = (process.env.ALLOW_DEMO_SEED ?? '').toLowerCase();
  if (optIn === 'true' || optIn === 'yes') {
    return;
  }
  // Refuse by default in production: the seed creates a credential-free demo
  // account that must never run against prod (override with ALLOW_DEMO_SEED).
  throw new Error(
    'Refusing to seed demo data: NODE_ENV=production. The demo seed creates a ' +
      'credential-free demo account and must never run against production. Set ' +
      'ALLOW_DEMO_SEED=true to override if you are certain this is intended.',
  );
}

async function main(): Promise<void> {
  // Guard before any DB connection or write so a blocked run touches nothing.
  assertSeedAllowed();
  const databaseService = new DatabaseService();
  try {
    await runMigrations(databaseService);
    await upsertDemoUser(databaseService);
    await upsertDemoQuestions(databaseService);
    await upsertDemoInterviews(databaseService);
    console.log(
      `Seeded demo data: 1 user, ${DEMO_QUESTIONS.length} questions, ${DEMO_INTERVIEWS.length} interviews`,
    );
  } finally {
    await databaseService.onModuleDestroy();
  }
}

void main().catch((error) => {
  console.error('Demo seed failed');
  console.error(error);
  process.exit(1);
});
