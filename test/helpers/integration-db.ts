import { DatabaseService } from '../../src/database/database.service';
import type { InterviewStatus } from '../../src/interview/interfaces/interview.interface';

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

export async function updateInterviewStatus(
  databaseService: DatabaseService,
  interviewId: string,
  status: InterviewStatus,
): Promise<void> {
  await databaseService.query(
    `UPDATE interviews SET status = $2, updated_at = NOW() WHERE id = $1`,
    [interviewId, status],
  );
}
