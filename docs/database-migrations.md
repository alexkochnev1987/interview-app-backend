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

The migration runner does **not** auto-rollback. To revert `0018` on a database (schema only — data in `translations_json` is dropped):

1. Connect to the target database.
2. Run the SQL in `rollbackStatements` for migration `0018` (see `src/database/migrations.ts`), in order:

```sql
DROP INDEX IF EXISTS questions_primary_locale_idx;

ALTER TABLE questions
DROP CONSTRAINT IF EXISTS questions_primary_locale_check;

ALTER TABLE questions
DROP COLUMN IF EXISTS translations_json;

ALTER TABLE questions
DROP COLUMN IF EXISTS primary_locale;
```

3. Remove the row from `schema_migrations`:

```sql
DELETE FROM schema_migrations WHERE version = '0018';
```

If `0021` was applied, delete that version too:

```sql
DELETE FROM schema_migrations WHERE version IN ('0018', '0021');
```

**Note:** Rollback removes the new columns only. It does not reconstruct `output_language` or flat rubric columns from `translations_json` — restore from backup if you need that data back.

## `primaryLocale` after migration

`primaryLocale` is set once at create (or by migration for legacy rows) and **cannot be changed** on `PUT/PATCH /questions/:id`. Update rubric text via `translations[primaryLocale]` or other locale keys.
