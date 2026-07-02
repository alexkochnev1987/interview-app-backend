import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DatabaseService } from './database.service';
import {
  DEMO_INTERVIEWS,
  DEMO_PLACEHOLDER_INTERVIEW_ID,
  DEMO_QUESTIONS,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  DEMO_USER_NAME,
} from './demo-seed-data';

/**
 * Minimal surface needed to run the demo seed: the standalone seed script passes
 * a DatabaseService, and the in-app provisioning path passes the same instance.
 */
export type DemoSeedExecutor = Pick<DatabaseService, 'query'>;

export interface DemoSeedCounts {
  users: number;
  questions: number;
  interviews: number;
}

/**
 * Single source of truth for whether demo seeding is permitted in the current
 * environment. Demo data must never reach production: outside production it is
 * always allowed; in production it requires an explicit ALLOW_DEMO_SEED opt-in.
 * Both the CLI seed and the in-app provisioning endpoint gate on this.
 */
export function isDemoSeedAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const optIn = (process.env.ALLOW_DEMO_SEED ?? '').toLowerCase();
  return optIn === 'true' || optIn === 'yes';
}

export async function upsertDemoUser(db: DemoSeedExecutor): Promise<void> {
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

export async function upsertDemoQuestions(db: DemoSeedExecutor): Promise<void> {
  for (const q of DEMO_QUESTIONS) {
    await db.query(
      `
        INSERT INTO questions (
          id, external_id, role, focus, output_language, primary_locale,
          translations_json, category, subcategory,
          text, question_text, follow_up_questions, expected_concepts,
          expected_concepts_json, red_flags, red_flags_json, difficulty, weight,
          sample_good_answer, minimum_pass_score, tags, metadata, deleted,
          usage_count, demo
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14::jsonb, $15,
          $16::jsonb, $17, $18, $19, $20, $21, $22::jsonb, FALSE, $23, TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          external_id = EXCLUDED.external_id,
          role = EXCLUDED.role,
          focus = EXCLUDED.focus,
          output_language = EXCLUDED.output_language,
          primary_locale = EXCLUDED.primary_locale,
          translations_json = EXCLUDED.translations_json,
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
        q.primaryLocale,
        JSON.stringify(q.translations),
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

export async function upsertDemoInterviews(db: DemoSeedExecutor): Promise<void> {
  for (const interview of DEMO_INTERVIEWS) {
    // Once a real recorded interview has been promoted to the demo, do not
    // recreate the fabricated placeholder on a later re-seed.
    if (interview.id === DEMO_PLACEHOLDER_INTERVIEW_ID) {
      const replaced = await db.query(
        `SELECT 1 FROM interviews WHERE demo = TRUE AND status = 'completed' AND id <> $1 LIMIT 1`,
        [DEMO_PLACEHOLDER_INTERVIEW_ID],
      );
      if ((replaced.rowCount ?? 0) > 0) {
        continue;
      }
    }
    await db.query(
      `
        INSERT INTO interviews (
          id, candidate_name, candidate_email, position, interview_locale,
          questions_json, answers_json, status, result_json, workflow_json,
          created_by_id, created_at, updated_at, demo
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, NULL, $10, $11, $12, TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          candidate_name = EXCLUDED.candidate_name,
          candidate_email = EXCLUDED.candidate_email,
          position = EXCLUDED.position,
          interview_locale = EXCLUDED.interview_locale,
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
        interview.interviewLocale,
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

/**
 * Upserts the full demo dataset (one read-only demo user, demo questions, demo
 * interviews). Idempotent: every write is an upsert keyed by a fixed id, so it
 * is safe to run repeatedly. Migrations are NOT run here; callers that run
 * outside a booted app (the CLI seed) run them first.
 */
export async function seedDemoData(
  db: DemoSeedExecutor,
): Promise<DemoSeedCounts> {
  await upsertDemoUser(db);
  await upsertDemoQuestions(db);
  await upsertDemoInterviews(db);
  return {
    users: 1,
    questions: DEMO_QUESTIONS.length,
    interviews: DEMO_INTERVIEWS.length,
  };
}
