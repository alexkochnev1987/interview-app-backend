import './load-env';

import { DatabaseService } from './database.service';
import { runMigrations } from './migration-runner';

async function main() {
  const databaseService = new DatabaseService();

  try {
    await runMigrations(databaseService);
    console.log('Database migrations completed');
  } finally {
    await databaseService.onModuleDestroy();
  }
}

void main().catch((error) => {
  console.error('Database migration failed');
  console.error(error);
  process.exit(1);
});
