import { DatabaseService } from '../../src/database/database.service';

const TRUNCATE_TABLES = [
  'feedback_links',
  'question_embeddings',
  'interviews',
  'questions',
  'users',
] as const;

export async function truncateIntegrationTables(
  databaseService: DatabaseService,
): Promise<void> {
  await databaseService.query(
    `TRUNCATE TABLE ${TRUNCATE_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  );
}
