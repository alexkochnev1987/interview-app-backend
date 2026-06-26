# Database migrations

Forward migrations run automatically on app start and via CI:

```bash
npm run db:migrate
```

Applied versions are recorded in `schema_migrations`. Each migration runs in a single transaction.

## `0018` — `questions_primary_locale_and_translations`

Adds `questions.primary_locale` and `questions.translations_json`, then backfills from legacy columns:

| Legacy | New |
|--------|-----|
| `output_language` | `primary_locale` (`en` \| `be` \| `ru` \| `pl`; unknown labels → `en`) |
| `question_text`, `text`, rubric JSON/array columns | `translations_json[primary_locale]` block |

Legacy flat columns are kept for compatibility; API reads/writes through `translations_json`.

## `0021` — `questions_primary_locale_backfill`

Idempotent safety net: re-runs the same backfill for any row still missing a non-empty `translations_json[primary_locale].questionText`.

## Rollback (manual)

The migration runner does **not** auto-rollback. When reverting locale/search work, run rollbacks in **reverse version order** and delete matching `schema_migrations` rows.

| Order | Version | What to revert |
|-------|---------|----------------|
| 1 | `0022` | `questions_translations_primary_locale_check` |
| 2 | `0020` | `search_text` column + trigram index |
| 3 | `0019` | `interviews.interview_locale` |
| 4 | `0018` | `questions.primary_locale` + `translations_json` |

SQL for each step lives in `rollbackStatements` on the migration in `src/database/migrations.ts` (or `src/database/migration-sql/question-locale.ts`).

Example for `0018` (schema only — data in `translations_json` is dropped):

```sql
DROP INDEX IF EXISTS questions_primary_locale_idx;

ALTER TABLE questions
DROP CONSTRAINT IF EXISTS questions_primary_locale_check;

ALTER TABLE questions
DROP COLUMN IF EXISTS translations_json;

ALTER TABLE questions
DROP COLUMN IF EXISTS primary_locale;
```

Then remove applied versions, e.g.:

```sql
DELETE FROM schema_migrations WHERE version IN ('0022', '0020', '0019', '0018', '0021');
```

**Note:** Rollback removes the new columns/constraints only. It does not reconstruct `output_language` or flat rubric columns from `translations_json` — restore from backup if you need that data back.

## `0022` — `questions_translations_primary_locale_check`

Adds a check constraint: `translations_json` must contain a non-empty `questionText` block for `primary_locale`.

## `primaryLocale` after migration

`primaryLocale` is set once at create (or by migration for legacy rows) and **cannot be changed** on `PUT/PATCH /questions/:id`. Update rubric text via `translations[primaryLocale]` or other locale keys.
