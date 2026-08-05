import { DatabaseService } from '../../database/database.service';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';

describe('RecruiterPendingActionStore', () => {
  const action = {
    type: 'assign_hr' as const,
    interviewId: '11111111-1111-4111-8111-111111111111',
    assignedHrId: '22222222-2222-4222-8222-222222222222',
    assignedHrName: 'Jane Doe',
    interviewLabel: 'Alice Smith (React Developer)',
  };

  const rows: Array<{
    id: string;
    user_id: string;
    action_json: typeof action;
    expires_at: Date;
  }> = [];

  const databaseService = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();

      if (normalized.startsWith('DELETE FROM recruiter_pending_actions WHERE expires_at')) {
        return { rows: [] };
      }

      if (normalized.startsWith('INSERT INTO recruiter_pending_actions')) {
        const [id, userId, actionJson, expiresAt] = params as [
          string,
          string,
          string,
          Date,
        ];
        rows.push({
          id,
          user_id: userId,
          action_json: JSON.parse(actionJson),
          expires_at: expiresAt,
        });
        return { rows: [] };
      }

      if (
        normalized.startsWith(
          'DELETE FROM recruiter_pending_actions WHERE id = $1 AND user_id = $2 AND expires_at > NOW()',
        )
      ) {
        const [id, userId] = params as [string, string];
        const index = rows.findIndex(
          (row) =>
            row.id === id
            && row.user_id === userId
            && row.expires_at.getTime() > Date.now(),
        );
        if (index === -1) {
          return { rows: [] };
        }
        const [row] = rows.splice(index, 1);
        return { rows: [{ action_json: row.action_json }] };
      }

      if (
        normalized.startsWith(
          'DELETE FROM recruiter_pending_actions WHERE id = $1 AND user_id = $2 RETURNING id',
        )
      ) {
        const [id, userId] = params as [string, string];
        const index = rows.findIndex((row) => row.id === id && row.user_id === userId);
        if (index === -1) {
          return { rows: [] };
        }
        rows.splice(index, 1);
        return { rows: [{ id }] };
      }

      if (
        normalized.startsWith('DELETE FROM recruiter_pending_actions WHERE user_id = $1')
      ) {
        const [userId] = params as [string];
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].user_id === userId) {
            rows.splice(index, 1);
          }
        }
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${normalized}`);
    }),
  };

  const store = new RecruiterPendingActionStore(
    databaseService as unknown as DatabaseService,
  );

  beforeEach(() => {
    rows.splice(0, rows.length);
    jest.clearAllMocks();
  });

  it('issues and one-shot consumes a pending action for the same user', async () => {
    const id = await store.issue('user-1', action);

    await expect(store.consume('user-1', id)).resolves.toEqual(action);
    await expect(store.consume('user-1', id)).resolves.toBeNull();
  });

  it('rejects consumption by a different user', async () => {
    const id = await store.issue('user-1', action);

    await expect(store.consume('user-2', id)).resolves.toBeNull();
  });

  it('revokes a pending action without executing it', async () => {
    const id = await store.issue('user-1', action);

    await expect(store.revoke('user-1', id)).resolves.toBe(true);
    await expect(store.consume('user-1', id)).resolves.toBeNull();
  });

  it('revokes all pending actions for a user', async () => {
    const first = await store.issue('user-1', action);
    const second = await store.issue('user-1', action);
    await store.issue('user-2', action);

    await store.revokeAllForUser('user-1');

    await expect(store.consume('user-1', first)).resolves.toBeNull();
    await expect(store.consume('user-1', second)).resolves.toBeNull();
  });
});
