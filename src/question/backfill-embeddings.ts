import '../database/load-env';

import { createEmbeddingProvider } from '../ai/embeddings/create-embedding-provider';
import { EmbeddingsService } from '../ai/embeddings/embeddings.service';
import { DatabaseService } from '../database/database.service';
import { runMigrations } from '../database/migration-runner';

const THROTTLE_MS = 100;

interface PendingRow {
  id: string;
  question_text: string;
}

async function main(): Promise<void> {
  const databaseService = new DatabaseService();
  const provider = createEmbeddingProvider();
  const embeddingsService = new EmbeddingsService(databaseService, provider);

  try {
    await runMigrations(databaseService);

    const { rows } = await databaseService.query<PendingRow>(
      `
        SELECT q.id, q.question_text
        FROM questions q
        WHERE NOT EXISTS (
          SELECT 1
          FROM question_embeddings e
          WHERE e.question_id = q.id AND e.model = $1
        )
        ORDER BY q.created_at ASC
      `,
      [provider.model],
    );

    if (rows.length === 0) {
      console.log(`No questions pending for model "${provider.model}".`);
      return;
    }

    console.log(
      `Backfilling ${rows.length} question(s) with model "${provider.model}"...`,
    );

    let succeeded = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await embeddingsService.generateAndStore(row.id, row.question_text);
        succeeded += 1;
        console.log(`  ok   ${row.id}`);
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  fail ${row.id}: ${message}`);
      }
      if (THROTTLE_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
      }
    }

    console.log(`Done. Succeeded: ${succeeded}. Failed: ${failed}.`);
  } finally {
    await databaseService.onModuleDestroy();
  }
}

void main().catch((error) => {
  console.error('Backfill failed');
  console.error(error);
  process.exit(1);
});
