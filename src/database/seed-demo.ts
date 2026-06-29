import './load-env';

import { DatabaseService } from './database.service';
import { runMigrations } from './migration-runner';
import { isDemoSeedAllowed, seedDemoData } from './demo-seed-core';

function assertSeedAllowed(): void {
  if (isDemoSeedAllowed()) {
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
    const counts = await seedDemoData(databaseService);
    console.log(
      `Seeded demo data: ${counts.users} user, ${counts.questions} questions, ${counts.interviews} interviews`,
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
