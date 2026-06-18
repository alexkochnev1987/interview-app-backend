import { DatabaseService } from './database.service';
import { DATABASE_MIGRATIONS } from './migrations';

export async function runMigrations(
  databaseService: DatabaseService,
): Promise<void> {
  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedResult = await databaseService.query<{ version: string }>(
    `
      SELECT version
      FROM schema_migrations
    `,
  );
  const appliedVersions = new Set(
    appliedResult.rows.map((row) => row.version),
  );

  for (const migration of DATABASE_MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    await databaseService.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        for (const statement of migration.statements) {
          await client.query(statement);
        }

        await client.query(
          `
            INSERT INTO schema_migrations (version, name)
            VALUES ($1, $2)
          `,
          [migration.version, migration.name],
        );
        await client.query('COMMIT');
        console.log(
          `Applied migration ${migration.version}_${migration.name}`,
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }
}
