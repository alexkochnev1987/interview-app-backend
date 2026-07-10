import { ForbiddenException } from '@nestjs/common';
import { InterviewService } from './interview.service';
import type { DatabaseService } from '../database/database.service';
import type { QuestionService } from '../question/question.service';
import type { UploadService } from '../upload/upload.service';

describe('InterviewService demo scoping (findAllPaginated)', () => {
  function makeService() {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)::text AS total')) {
        return Promise.resolve({ rows: [{ total: '0' }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const databaseService = { query } as unknown as DatabaseService;
    const questionService = {} as unknown as QuestionService;
    const uploadService = {
      deleteInterviewMedia: jest.fn(),
    } as unknown as UploadService;
    return {
      service: new InterviewService(
        databaseService,
        questionService,
        uploadService,
      ),
      query,
    };
  }

  it('scopes a demo HR user to demo rows they own', async () => {
    const { service, query } = makeService();
    await service.findAllPaginated(
      {},
      { id: 'demo-user', role: 'hr', demo: true },
    );

    const dataCall = query.mock.calls.find(
      ([sql]) => !sql.includes('COUNT(*)::text AS total'),
    );
    expect(dataCall).toBeDefined();
    const [sql, params] = dataCall!;
    expect(sql).toContain('demo = $1');
    expect(sql).toContain('created_by_id = $2');
    expect(params).toEqual([true, 'demo-user', 20, 0]);
  });

  it('scopes a real admin to non-demo rows with no owner filter', async () => {
    const { service, query } = makeService();
    await service.findAllPaginated(
      {},
      { id: 'admin', role: 'admin', demo: false },
    );

    const dataCall = query.mock.calls.find(
      ([sql]) => !sql.includes('COUNT(*)::text AS total'),
    );
    expect(dataCall).toBeDefined();
    const [sql, params] = dataCall!;
    expect(sql).toContain('demo = $1');
    expect(sql).not.toContain('created_by_id = $');
    expect(params).toEqual([false, 20, 0]);
  });

  it('rejects roles without interview access before querying', async () => {
    const { service, query } = makeService();
    await expect(
      service.findAllPaginated(
        {},
        { id: 'c1', role: 'candidate', demo: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
});
