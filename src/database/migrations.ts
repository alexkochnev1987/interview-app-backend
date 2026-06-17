import {
  BUILD_PRIMARY_TRANSLATION_BLOCK_SQL,
  MAP_OUTPUT_LANGUAGE_TO_PRIMARY_LOCALE_SQL,
  QUESTIONS_MISSING_PRIMARY_BLOCK_WHERE,
  QUESTIONS_PRIMARY_LOCALE_ROLLBACK_STATEMENTS,
} from './migration-sql/question-locale';

export interface DatabaseMigration {
  version: string;
  name: string;
  statements: string[];
  /** Optional manual rollback SQL — not applied automatically; see docs/database-migrations.md */
  rollbackStatements?: string[];
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
          status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'processing', 'completed', 'failed')), -- INTERVIEW_STATUSES
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
  {
    version: '0007',
    name: 'remove_seeded_test_users',
    statements: [
      `DELETE FROM users WHERE email IN ('admin@test.com', 'hr@test.com');`,
    ],
  },
  {
    version: '0008',
    name: 'enforce_active_question_text_unique',
    statements: [
      `
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY lower(question_text)
              ORDER BY updated_at DESC, created_at DESC, id
            ) AS rn
          FROM questions
          WHERE deleted = FALSE
        )
        UPDATE questions
        SET deleted = TRUE, updated_at = NOW()
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
      `,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS questions_active_text_unique_idx
        ON questions (lower(question_text))
        WHERE deleted = FALSE;
      `,
    ],
  },
  {
    version: '0009',
    name: 'add_candidate_role',
    statements: [
      // Drop every check constraint that targets the `role` column, regardless
      // of name (legacy auto-named `users_role_check`, custom names, multiples
      // from a half-applied previous run). Matching by column via conkey/attname
      // is safer than the previous `pg_get_constraintdef ILIKE '%role%IN%'` and
      // safer than dropping by name without `IF EXISTS`. The block is fully
      // idempotent — safe to re-run after partial failure.
      `
        DO $$
        DECLARE
          constraint_name TEXT;
        BEGIN
          FOR constraint_name IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_attribute att
              ON att.attrelid = con.conrelid
             AND att.attnum = ANY (con.conkey)
            WHERE con.conrelid = 'users'::regclass
              AND con.contype = 'c'
              AND att.attname = 'role'
          LOOP
            EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
          END LOOP;
        END $$;
      `,
      // Belt-and-braces: handles any leftover constraint with the explicit
      // name regardless of column matching above.
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`,
      // ADD CONSTRAINT has no IF NOT EXISTS — wrap in DO block so re-running
      // after a successful run is a no-op rather than an error.
      `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND conname = 'users_role_check'
          ) THEN
            ALTER TABLE users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('super_admin', 'admin', 'hr', 'candidate'));
          END IF;
        END $$;
      `,
    ],
  },
  {
    version: '0010',
    name: 'add_interview_owner_and_candidate_email',
    statements: [
      `
        ALTER TABLE interviews
        ADD COLUMN IF NOT EXISTS created_by_id UUID NULL
        REFERENCES users(id) ON DELETE SET NULL;
      `,
      `
        ALTER TABLE interviews
        ADD COLUMN IF NOT EXISTS candidate_email TEXT NULL;
      `,
      `
        CREATE INDEX IF NOT EXISTS interviews_created_by_idx
        ON interviews (created_by_id)
        WHERE created_by_id IS NOT NULL;
      `,
    ],
  },
  {
    version: '0011',
    name: 'create_feedback_links',
    statements: [
      `
        CREATE TABLE IF NOT EXISTS feedback_links (
          id UUID PRIMARY KEY,
          interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
          created_by_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
          expires_at TIMESTAMPTZ NULL,
          revoked_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS feedback_links_active_per_interview_idx
        ON feedback_links (interview_id)
        WHERE revoked_at IS NULL;
      `,
      `
        CREATE INDEX IF NOT EXISTS feedback_links_interview_idx
        ON feedback_links (interview_id);
      `,
    ],
  },
  {
    version: '0012',
    name: 'feedback_links_random_token',
    statements: [
      // `gen_random_uuid()` lives in `pgcrypto`. Older PG installations don't
      // ship the extension by default — enable it before use so the migration
      // works on a clean database.
      `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
      `ALTER TABLE feedback_links ADD COLUMN IF NOT EXISTS token TEXT;`,
      // Any pre-existing JWT-era links cannot be resolved by random token —
      // revoke them and assign a placeholder token to satisfy NOT NULL.
      `
        UPDATE feedback_links
        SET revoked_at = COALESCE(revoked_at, NOW()),
            token = COALESCE(token, gen_random_uuid()::text)
        WHERE token IS NULL;
      `,
      `ALTER TABLE feedback_links ALTER COLUMN token SET NOT NULL;`,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS feedback_links_token_idx
        ON feedback_links (token);
      `,
    ],
  },
  {
    version: '0013',
    name: 'feedback_links_revoke_pre_hash_tokens',
    statements: [
      // The application now stores sha256 hashes of feedback tokens instead of
      // the plaintext value. Any link rows created prior to this change carry
      // a plaintext token in the column and become unresolvable by the new
      // lookup path (which hashes the incoming token before querying). Revoke
      // every still-active row so its expiry is enforced and a fresh link can
      // be issued by the owner.
      `
        UPDATE feedback_links
        SET revoked_at = NOW()
        WHERE revoked_at IS NULL;
      `,
    ],
  },
  {
    version: '0014',
    name: 'add_questions_usage_count',
    statements: [
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0;`,
      `
        UPDATE questions q
        SET usage_count = sub.cnt
        FROM (
          SELECT (item->>'id')::uuid AS qid, count(*) AS cnt
          FROM interviews i,
               jsonb_array_elements(i.questions_json) item
          WHERE item ? 'id'
            AND item->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          GROUP BY (item->>'id')::uuid
        ) sub
        WHERE q.id = sub.qid;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_usage_count_idx
        ON questions (usage_count DESC)
        WHERE deleted = FALSE;
      `,
    ],
  },
  {
    version: '0015',
    name: 'add_questions_picker_indexes',
    statements: [
      `
        CREATE INDEX IF NOT EXISTS questions_tags_gin_idx
        ON questions USING GIN (tags)
        WHERE deleted = FALSE;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_difficulty_updated_idx
        ON questions (difficulty, updated_at DESC)
        WHERE deleted = FALSE;
      `,
    ],
  },
  {
    version: '0016',
    name: 'add_questions_case_insensitive_filter_indexes',
    statements: [
      `
        CREATE INDEX IF NOT EXISTS questions_category_lower_idx
        ON questions (lower(category))
        WHERE deleted = FALSE AND category IS NOT NULL;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_subcategory_lower_idx
        ON questions (lower(subcategory))
        WHERE deleted = FALSE AND subcategory IS NOT NULL;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_role_lower_idx
        ON questions (lower(role))
        WHERE deleted = FALSE AND role IS NOT NULL;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_output_language_lower_idx
        ON questions (lower(output_language))
        WHERE deleted = FALSE AND output_language IS NOT NULL;
      `,
    ],
  },
  {
    version: '0017',
    name: 'add_tags_lowercase_gin_index',
    statements: [
      `
        CREATE OR REPLACE FUNCTION tags_lowercase(tags TEXT[]) RETURNS TEXT[]
        LANGUAGE SQL IMMUTABLE STRICT AS $$
          SELECT ARRAY(SELECT lower(t) FROM unnest($1) AS t)
        $$;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_tags_lower_gin_idx
        ON questions USING GIN (tags_lowercase(tags))
        WHERE deleted = FALSE;
      `,
    ],
  },
  {
    version: '0018',
    name: 'questions_primary_locale_and_translations',
    rollbackStatements: QUESTIONS_PRIMARY_LOCALE_ROLLBACK_STATEMENTS,
    statements: [
      `
        ALTER TABLE questions
        ADD COLUMN IF NOT EXISTS primary_locale TEXT NULL;
      `,
      `
        ALTER TABLE questions
        ADD COLUMN IF NOT EXISTS translations_json JSONB NOT NULL DEFAULT '{}'::jsonb;
      `,
      `
        UPDATE questions
        SET primary_locale = ${MAP_OUTPUT_LANGUAGE_TO_PRIMARY_LOCALE_SQL}
        WHERE primary_locale IS NULL;
      `,
      `
        UPDATE questions
        SET translations_json = ${BUILD_PRIMARY_TRANSLATION_BLOCK_SQL}
        WHERE ${QUESTIONS_MISSING_PRIMARY_BLOCK_WHERE};
      `,
      `
        ALTER TABLE questions
        ALTER COLUMN primary_locale SET DEFAULT 'en';
      `,
      `
        UPDATE questions
        SET primary_locale = 'en'
        WHERE primary_locale IS NULL;
      `,
      `
        ALTER TABLE questions
        ALTER COLUMN primary_locale SET NOT NULL;
      `,
      `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'questions'::regclass
              AND conname = 'questions_primary_locale_check'
          ) THEN
            ALTER TABLE questions
            ADD CONSTRAINT questions_primary_locale_check
            CHECK (primary_locale IN ('en', 'be', 'ru', 'pl'));
          END IF;
        END $$;
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_primary_locale_idx
        ON questions (primary_locale)
        WHERE deleted = FALSE;
      `,
    ],
  },
  {
    version: '0019',
    name: 'interviews_interview_locale',
    statements: [
      `
        ALTER TABLE interviews
        ADD COLUMN IF NOT EXISTS interview_locale TEXT NULL;
      `,
      `
        UPDATE interviews
        SET interview_locale = 'en'
        WHERE interview_locale IS NULL;
      `,
      `
        ALTER TABLE interviews
        ALTER COLUMN interview_locale SET DEFAULT 'en';
      `,
      `
        ALTER TABLE interviews
        ALTER COLUMN interview_locale SET NOT NULL;
      `,
      `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'interviews'::regclass
              AND conname = 'interviews_interview_locale_check'
          ) THEN
            ALTER TABLE interviews
            ADD CONSTRAINT interviews_interview_locale_check
            CHECK (interview_locale IN ('en', 'be', 'ru', 'pl'));
          END IF;
        END $$;
      `,
    ],
  },
  {
    version: '0020',
    name: 'questions_search_text_trgm',
    statements: [
      `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
      `
        ALTER TABLE questions
        ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';
      `,
      `
        UPDATE questions
        SET search_text = lower(
          trim(
            concat_ws(
              ' ',
              nullif(trim(question_text), ''),
              (
                SELECT string_agg(DISTINCT trim(block->>'questionText'), ' ')
                FROM jsonb_each(translations_json) AS tr(locale_key, block)
                WHERE trim(COALESCE(block->>'questionText', '')) <> ''
              )
            )
          )
        );
      `,
      `
        CREATE INDEX IF NOT EXISTS questions_search_text_trgm_idx
        ON questions USING GIN (search_text gin_trgm_ops)
        WHERE deleted = FALSE;
      `,
    ],
  },
  {
    version: '0021',
    name: 'questions_primary_locale_backfill',
    statements: [
      `
        UPDATE questions
        SET primary_locale = ${MAP_OUTPUT_LANGUAGE_TO_PRIMARY_LOCALE_SQL}
        WHERE primary_locale IS NULL
           OR primary_locale NOT IN ('en', 'be', 'ru', 'pl');
      `,
      `
        UPDATE questions
        SET translations_json = ${BUILD_PRIMARY_TRANSLATION_BLOCK_SQL}
        WHERE ${QUESTIONS_MISSING_PRIMARY_BLOCK_WHERE};
      `,
    ],
  },
];
