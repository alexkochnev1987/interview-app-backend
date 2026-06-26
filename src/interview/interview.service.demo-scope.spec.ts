import { ForbiddenException } from '@nestjs/common';
import { InterviewService } from './interview.service';
import type { DatabaseService } from '../database/database.service';
import type { QuestionService } from '../question/question.service';

describe('InterviewService demo scoping (findAllForActor)', () => {
  function makeService() {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const databaseService = { query } as unknown as DatabaseService;
    const questionService = {} as unknown as QuestionService;
    return {
      service: new InterviewService(databaseService, questionService),
      query,
    };
  }

  it('scopes a demo HR user to demo rows they own', async () => {
    const { service, query } = makeService();
    await service.findAllForActor({ id: 'demo-user', role: 'hr', demo: true });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('demo = $1');
    expect(sql).toContain('created_by_id = $2');
    expect(params).toEqual([true, 'demo-user']);
  });

  it('scopes a real admin to non-demo rows with no owner filter', async () => {
    const { service, query } = makeService();
    await service.findAllForActor({ id: 'admin', role: 'admin', demo: false });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('demo = $1');
    expect(sql).not.toContain('created_by_id = $');
    expect(params).toEqual([false]);
  });

  it('rejects roles without interview access before querying', async () => {
    const { service, query } = makeService();
    await expect(
      service.findAllForActor({ id: 'c1', role: 'candidate', demo: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
});
