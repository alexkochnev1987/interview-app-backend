export interface DatabaseMigration {
  version: string;
  name: string;
  statements: string[];
}

export const DATABASE_MIGRATIONS: DatabaseMigration[] = [
  {
    version: '0001',
    name: 'initial_schema',
    statements: [
      `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'hr')),
          organization_id TEXT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS questions (
          id UUID PRIMARY KEY,
          external_id TEXT NULL,
          role TEXT NULL,
          focus TEXT NULL,
          output_language TEXT NOT NULL DEFAULT 'English',
          category TEXT NULL,
          subcategory TEXT NULL,
          text TEXT NOT NULL,
          question_text TEXT NOT NULL,
          follow_up_questions TEXT[] NOT NULL DEFAULT '{}',
          expected_concepts TEXT[] NOT NULL DEFAULT '{}',
          expected_concepts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          red_flags TEXT[] NOT NULL DEFAULT '{}',
          red_flags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
          weight DOUBLE PRECISION NOT NULL CHECK (weight > 0),
          sample_good_answer TEXT NULL,
          minimum_pass_score DOUBLE PRECISION NOT NULL DEFAULT 0,
          tags TEXT[] NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS interviews (
          id UUID PRIMARY KEY,
          candidate_name TEXT NOT NULL,
          position TEXT NOT NULL,
          questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'processing', 'completed', 'failed')),
          result_json JSONB NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
    ],
  },
  {
    version: '0002',
    name: 'expand_questions_for_ai_schema',
    statements: [
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS external_id TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS role TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS focus TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS output_language TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS category TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS subcategory TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_text TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS follow_up_questions TEXT[] NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS expected_concepts_json JSONB NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS red_flags_json JSONB NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS sample_good_answer TEXT NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS minimum_pass_score DOUBLE PRECISION NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags TEXT[] NULL;`,
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS metadata JSONB NULL;`,
      `
        UPDATE questions
        SET
          question_text = COALESCE(NULLIF(question_text, ''), text),
          output_language = COALESCE(NULLIF(output_language, ''), 'English'),
          follow_up_questions = COALESCE(follow_up_questions, '{}'::text[]),
          expected_concepts_json = COALESCE(expected_concepts_json, '[]'::jsonb),
          red_flags_json = COALESCE(red_flags_json, '[]'::jsonb),
          minimum_pass_score = COALESCE(minimum_pass_score, 0),
          tags = COALESCE(tags, '{}'::text[]),
          metadata = COALESCE(metadata, '{}'::jsonb)
        WHERE
          question_text IS NULL
          OR question_text = ''
          OR output_language IS NULL
          OR output_language = ''
          OR follow_up_questions IS NULL
          OR expected_concepts_json IS NULL
          OR red_flags_json IS NULL
          OR minimum_pass_score IS NULL
          OR tags IS NULL
          OR metadata IS NULL;
      `,
      `ALTER TABLE questions ALTER COLUMN output_language SET DEFAULT 'English';`,
      `ALTER TABLE questions ALTER COLUMN output_language SET NOT NULL;`,
      `ALTER TABLE questions ALTER COLUMN question_text SET NOT NULL;`,
      `ALTER TABLE questions ALTER COLUMN follow_up_questions SET DEFAULT '{}'::text[];`,
      `ALTER TABLE questions ALTER COLUMN follow_up_questions SET NOT NULL;`,
      `ALTER TABLE questions ALTER COLUMN expected_concepts_json SET DEFAULT '[]'::jsonb;`,
      `ALTER TABLE questions ALTER COLUMN expected_concepts_json SET NOT NULL;`,
      `ALTER TABLE questions ALTER COLUMN red_flags_json SET DEFAULT '[]'::jsonb;`,
      `ALTER TABLE questions ALTER COLUMN red_flags_json SET NOT NULL;`,
      `ALTER TABLE questions ALTER COLUMN minimum_pass_score SET DEFAULT 0;`,
      `ALTER TABLE questions ALTER COLUMN minimum_pass_score SET NOT NULL;`,
      `ALTER TABLE questions ALTER COLUMN tags SET DEFAULT '{}'::text[];`,
      `ALTER TABLE questions ALTER COLUMN tags SET NOT NULL;`,
      `ALTER TABLE questions ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;`,
      `ALTER TABLE questions ALTER COLUMN metadata SET NOT NULL;`,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS questions_external_id_unique_idx
        ON questions (external_id)
        WHERE external_id IS NOT NULL;
      `,
    ],
  },
  {
    version: '0003',
    name: 'allow_decimal_question_weight',
    statements: [
      `
        ALTER TABLE questions
        ALTER COLUMN weight TYPE DOUBLE PRECISION
        USING weight::double precision;
      `,
    ],
  },
  {
    version: '0004',
    name: 'add_interview_workflow_json',
    statements: [
      `
        ALTER TABLE interviews
        ADD COLUMN IF NOT EXISTS workflow_json JSONB NULL;
      `,
    ],
  },
  {
    version: '0005',
    name: 'add_question_embeddings',
    statements: [
      `CREATE EXTENSION IF NOT EXISTS vector;`,
      `
        CREATE TABLE IF NOT EXISTS question_embeddings (
          question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
          model TEXT NOT NULL,
          embedding VECTOR(1536) NOT NULL,
          text_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (question_id, model)
        );
      `,
      `
        CREATE INDEX IF NOT EXISTS question_embeddings_hnsw_cosine_idx
        ON question_embeddings
        USING hnsw (embedding vector_cosine_ops);
      `,
    ],
  },
  {
    version: '0006',
    name: 'add_questions_soft_delete_flag',
    statements: [
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;`,
      `DROP INDEX IF EXISTS questions_external_id_unique_idx;`,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS questions_external_id_unique_idx
        ON questions (external_id)
        WHERE external_id IS NOT NULL AND deleted = FALSE;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_active_idx
        ON questions (updated_at DESC)
        WHERE deleted = FALSE;
      `,
    ],
  },
];
