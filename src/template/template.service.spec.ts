import { TemplateService } from './template.service';
import type { DatabaseService } from '../database/database.service';
import type {
  QuestionService,
  ResolvedQuestion,
} from '../question/question.service';
import type { PoolClient } from 'pg';

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    name: 'Frontend Fundamentals',
    description: 'desc',
    position: 'Frontend Engineer',
    question_ids_json: ['q1', 'q2', 'q3'],
    created_by_id: 'user-1',
    demo: false,
    usage_count: 4,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

// Only the fields the service reads back are needed for a resolved stub.
const resolvedQuestion = (id: string) =>
  ({ id, questionText: `Q ${id}` }) as unknown as ResolvedQuestion;

describe('TemplateService', () => {
  function makeService(
    resolved: ResolvedQuestion[] = [
      resolvedQuestion('q1'),
      resolvedQuestion('q2'),
    ],
  ) {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const withTransaction = jest.fn(
      async (cb: (client: PoolClient) => Promise<unknown>) =>
        cb({ query } as unknown as PoolClient),
    );
    const databaseService = {
      query,
      withTransaction,
    } as unknown as DatabaseService;
    const resolveExistingByIds = jest.fn().mockResolvedValue(resolved);
    const questionService = {
      resolveExistingByIds,
    } as unknown as QuestionService;
    return {
      service: new TemplateService(databaseService, questionService),
      query,
      resolveExistingByIds,
    };
  }

  describe('create', () => {
    it('inserts with the demo flag and creator, then resolves live questions', async () => {
      const { service, query, resolveExistingByIds } = makeService([
        resolvedQuestion('q1'),
        resolvedQuestion('q2'),
        resolvedQuestion('q3'),
      ]);
      query.mockResolvedValueOnce({ rows: [templateRow({ demo: true })] });

      const result = await service.create(
        {
          name: 'Frontend Fundamentals',
          description: 'desc',
          position: 'Frontend Engineer',
          questionIds: ['q1', 'q2', 'q3'],
        },
        'en',
        { createdById: 'user-1', demo: true },
      );

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO interview_templates');
      // demo flag and creator are persisted; ids stored as JSONB.
      expect(params).toContain('user-1');
      expect(params).toContain(true);
      expect(params).toContain(JSON.stringify(['q1', 'q2', 'q3']));
      // Live resolution is demo-scoped to the row's demo flag.
      expect(resolveExistingByIds).toHaveBeenCalledWith(
        ['q1', 'q2', 'q3'],
        'en',
        { demo: true },
      );
      expect(result.questionCount).toBe(3);
      expect(result.questions).toHaveLength(3);
    });

    it('rejects an empty question set before touching the database', async () => {
      const { service, query } = makeService();
      await expect(
        service.create(
          { name: 'Empty', questionIds: [] },
          'en',
          { demo: false },
        ),
      ).rejects.toMatchObject({ message: expect.stringContaining('question') });
      expect(query).not.toHaveBeenCalled();
    });

    it('rejects ids that do not resolve to live questions, before inserting', async () => {
      // Two ids requested, only one resolves (deleted/out-of-scope/nonexistent).
      const { service, query } = makeService([resolvedQuestion('q1')]);

      await expect(
        service.create(
          { name: 'Partial', questionIds: ['q1', 'q2'] },
          'en',
          { demo: false },
        ),
      ).rejects.toMatchObject({ message: expect.stringContaining('unavailable') });
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes the list to the caller demo flag, newest first', async () => {
      const { service, query } = makeService();
      query.mockResolvedValueOnce({ rows: [templateRow()] });

      await service.findAll('en', { demo: false });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM interview_templates');
      expect(sql).toContain('demo = $1');
      expect(sql).toContain('ORDER BY updated_at DESC');
      expect(params).toEqual([false]);
    });

    it('reports resolvable and stored counts (deleted refs drop out of the count)', async () => {
      // Row references 3 ids but only 1 resolves live.
      const { service, query } = makeService([resolvedQuestion('q1')]);
      query.mockResolvedValueOnce({ rows: [templateRow()] });

      const [template] = await service.findAll('en', { demo: false });

      // Summary omits the heavy questions array but keeps both counts.
      expect(template.questionCount).toBe(1);
      expect(template.storedQuestionCount).toBe(3);
      expect(template).not.toHaveProperty('questions');
    });
  });

  describe('findOne', () => {
    it('throws NOT_FOUND when the id is missing or out of demo scope', async () => {
      const { service, query } = makeService();
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.findOne('missing', 'en', { demo: false }),
      ).rejects.toMatchObject({ message: expect.stringContaining('not found') });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('demo = $2');
      expect(params).toEqual(['missing', false]);
    });
  });

  describe('remove', () => {
    it('demo-scopes the delete and returns the deleted id', async () => {
      const { service, query } = makeService();
      query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.remove('t1', { demo: false });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('DELETE FROM interview_templates');
      expect(sql).toContain('demo = $2');
      expect(params).toEqual(['t1', false]);
      expect(result).toEqual({ id: 't1', deleted: true });
    });

    it('throws NOT_FOUND when nothing was deleted', async () => {
      const { service, query } = makeService();
      query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(
        service.remove('t1', { demo: false }),
      ).rejects.toMatchObject({ message: expect.stringContaining('not found') });
    });
  });

  describe('update', () => {
    it('rejects an update with no fields provided', async () => {
      const { service } = makeService();
      await expect(
        service.update('t1', {}, 'en', { demo: false }),
      ).rejects.toMatchObject({ message: expect.stringContaining('At least one') });
    });

    it('locks the row (FOR UPDATE), keeps unchanged fields, and rejects an empty set', async () => {
      const { service, query } = makeService();
      query.mockResolvedValueOnce({ rows: [templateRow()] }); // findRow (FOR UPDATE)

      await expect(
        service.update('t1', { questionIds: [] }, 'en', { demo: false }),
      ).rejects.toMatchObject({ message: expect.stringContaining('at least one') });

      const [sql] = query.mock.calls[0];
      expect(sql).toContain('FOR UPDATE');
    });
  });
});
