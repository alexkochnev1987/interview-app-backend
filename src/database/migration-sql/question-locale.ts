/** Maps legacy output_language labels to canonical primary_locale codes. */
export const MAP_OUTPUT_LANGUAGE_TO_PRIMARY_LOCALE_SQL = `
  CASE lower(trim(COALESCE(output_language, '')))
    WHEN 'en' THEN 'en'
    WHEN 'english' THEN 'en'
    WHEN 'be' THEN 'be'
    WHEN 'belarusian' THEN 'be'
    WHEN 'belarus' THEN 'be'
    WHEN 'belarussian' THEN 'be'
    WHEN 'ru' THEN 'ru'
    WHEN 'russian' THEN 'ru'
    WHEN 'russia' THEN 'ru'
    WHEN 'pl' THEN 'pl'
    WHEN 'polish' THEN 'pl'
    WHEN 'poland' THEN 'pl'
    ELSE 'en'
  END
`;

/** Builds translations_json primary block from legacy flat question columns. */
export const BUILD_PRIMARY_TRANSLATION_BLOCK_SQL = `
  jsonb_build_object(
    primary_locale,
    jsonb_strip_nulls(
      jsonb_build_object(
        'questionText', COALESCE(NULLIF(trim(question_text), ''), NULLIF(trim(text), '')),
        'followUpQuestions', COALESCE(to_jsonb(follow_up_questions), '[]'::jsonb),
        'expectedConcepts', COALESCE(expected_concepts_json, '[]'::jsonb),
        'redFlags', COALESCE(red_flags_json, '[]'::jsonb),
        'sampleGoodAnswer', sample_good_answer
      )
    )
  )
`;

/** Rows that still need a primary locale block in translations_json. */
export const QUESTIONS_MISSING_PRIMARY_BLOCK_WHERE = `
  (
    translations_json = '{}'::jsonb
    OR NOT translations_json ? primary_locale
    OR COALESCE(trim(translations_json -> primary_locale ->> 'questionText'), '') = ''
  )
  AND COALESCE(NULLIF(trim(question_text), ''), NULLIF(trim(text), ''), '') <> ''
`;

export const QUESTIONS_PRIMARY_LOCALE_ROLLBACK_STATEMENTS = [
  `DROP INDEX IF EXISTS questions_primary_locale_idx;`,
  `
    ALTER TABLE questions
    DROP CONSTRAINT IF EXISTS questions_primary_locale_check;
  `,
  `
    ALTER TABLE questions
    DROP COLUMN IF EXISTS translations_json;
  `,
  `
    ALTER TABLE questions
    DROP COLUMN IF EXISTS primary_locale;
  `,
];

/** Manual rollback for migration 0019 — run before 0018 when reverting locale work. */
export const INTERVIEWS_INTERVIEW_LOCALE_ROLLBACK_STATEMENTS = [
  `
    ALTER TABLE interviews
    DROP CONSTRAINT IF EXISTS interviews_interview_locale_check;
  `,
  `
    ALTER TABLE interviews
    DROP COLUMN IF EXISTS interview_locale;
  `,
];

/** Manual rollback for migration 0020 — run before 0019 when reverting locale work. */
export const QUESTIONS_SEARCH_TEXT_ROLLBACK_STATEMENTS = [
  `DROP INDEX IF EXISTS questions_search_text_trgm_idx;`,
  `
    ALTER TABLE questions
    DROP COLUMN IF EXISTS search_text;
  `,
];

export const QUESTIONS_TRANSLATIONS_PRIMARY_BLOCK_ROLLBACK_STATEMENTS = [
  `
    ALTER TABLE questions
    DROP CONSTRAINT IF EXISTS questions_translations_primary_locale_check;
  `,
];
