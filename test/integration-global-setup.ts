import './integration-env';
import { Pool } from 'pg';
import { DatabaseService } from '../src/database/database.service';
import { runMigrations } from '../src/database/migration-runner';

async function ensureTestDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for integration tests');
  }

  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, '');
  if (!databaseName || databaseName === 'postgres') {
    return;
  }

  url.pathname = '/postgres';
  const adminPool = new Pool({ connectionString: url.toString() });

  try {
    const exists = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (exists.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await adminPool.end();
  }
}

export default async function globalSetup(): Promise<void> {
  await ensureTestDatabase();

  const databaseService = new DatabaseService();
  try {
    await runMigrations(databaseService);
  } finally {
    await databaseService.onModuleDestroy();
  }
}
