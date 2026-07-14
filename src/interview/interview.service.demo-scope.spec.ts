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
    await service.findAllForActor(
      { id: 'demo-user', role: 'hr', demo: true },
      { unbounded: true },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('demo = $1');
    expect(sql).toContain('created_by_id = $2');
    expect(params).toEqual([true, 'demo-user']);
  });

  it('scopes a real admin to non-demo rows with no owner filter', async () => {
    const { service, query } = makeService();
    await service.findAllForActor(
      { id: 'admin', role: 'admin', demo: false },
      { unbounded: true },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('demo = $1');
    expect(sql).not.toContain('created_by_id = $');
    expect(sql).not.toContain('onboarding-starter.sample');
    expect(params).toEqual([false]);
  });

  it('excludes onboarding starter rows after onboarding is completed', async () => {
    const { service, query } = makeService();
    await service.findAllForActor(
      {
        id: 'admin',
        role: 'admin',
        demo: false,
        onboardingCompletedAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      { unbounded: true },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('NOT LIKE');
    expect(params).toEqual([false, '%@onboarding-starter.sample']);
  });

  it('rejects roles without interview access before querying', async () => {
    const { service, query } = makeService();
    await expect(
      service.findAllForActor({ id: 'c1', role: 'candidate', demo: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
});
