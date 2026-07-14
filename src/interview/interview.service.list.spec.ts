import { InterviewService } from './interview.service';
import type { DatabaseService } from '../database/database.service';
import type { QuestionService } from '../question/question.service';
import type { MediaCleanupService } from '../upload/media-cleanup.service';

describe('InterviewService list query (findAllPaginated)', () => {
  function makeService() {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)::text AS total')) {
        return Promise.resolve({ rows: [{ total: '0' }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const hydrateStoredQuestionCore = jest.fn();
    const databaseService = { query } as unknown as DatabaseService;
    const questionService = {
      hydrateStoredQuestionCore,
    } as unknown as QuestionService;
    const mediaCleanupService = {
      deleteInterviewMedia: jest.fn(),
    } as unknown as MediaCleanupService;
    return {
      service: new InterviewService(
        databaseService,
        questionService,
        mediaCleanupService,
      ),
      query,
      hydrateStoredQuestionCore,
    };
  }

  it('selects lightweight list columns and derived SQL aggregates', async () => {
    const { service, query } = makeService();
    await service.findAllPaginated(
      {},
      { id: 'admin', role: 'admin', demo: false },
    );

    const dataCall = query.mock.calls.find(([sql]) =>
      sql.includes('jsonb_array_length(questions_json)'),
    );
    expect(dataCall).toBeDefined();
    const [sql] = dataCall!;
    expect(sql).toContain('jsonb_array_length(questions_json)');
    expect(sql).toContain("answer.value->>'status' = 'submitted'");
    expect(sql).not.toContain("COALESCE(answer.value->>'status', 'submitted')");
    expect(sql).toContain("result_json->>'overallScore'");
    expect(sql).toContain("result_json->>'decision'");
    expect(sql).not.toContain('workflow_json');
    expect(sql).not.toContain('interview_locale');
  });

  it('maps list rows without hydrating interviews', async () => {
    const { service, query, hydrateStoredQuestionCore } = makeService();
    query.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)::text AS total')) {
        return Promise.resolve({ rows: [{ total: '1' }] });
      }
      return Promise.resolve({
        rows: [
          {
            id: 'interview-1',
            candidate_name: 'Alice',
            candidate_email: 'alice@test.local',
            position: 'Engineer',
            status: 'completed',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-02T00:00:00.000Z'),
            question_count: 3,
            submitted_answer_count: 2,
            overall_score: 88,
            decision: 'proceed',
          },
        ],
      });
    });

    const result = await service.findAllPaginated(
      {},
      { id: 'admin', role: 'admin', demo: false },
    );

    expect(hydrateStoredQuestionCore).not.toHaveBeenCalled();
    expect(result.items).toEqual([
      {
        id: 'interview-1',
        candidateName: 'Alice',
        candidateEmail: 'alice@test.local',
        position: 'Engineer',
        status: 'completed',
        questionCount: 3,
        submittedAnswerCount: 2,
        overallScore: 88,
        decision: 'proceed',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    expect(result.total).toBe(1);
  });

  it('returns the real total when the requested page is beyond the last page', async () => {
    const { service, query } = makeService();
    query.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)::text AS total')) {
        return Promise.resolve({ rows: [{ total: '25' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.findAllPaginated(
      { page: 3, limit: 10 },
      { id: 'admin', role: 'admin', demo: false },
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(25);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });
});

describe('InterviewService facets query (getFacets)', () => {
  function makeService() {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const databaseService = { query } as unknown as DatabaseService;
    const questionService = {
      hydrateStoredQuestionCore: jest.fn(),
    } as unknown as QuestionService;
    const mediaCleanupService = {
      deleteInterviewMedia: jest.fn(),
    } as unknown as MediaCleanupService;
    return {
      service: new InterviewService(
        databaseService,
        questionService,
        mediaCleanupService,
      ),
      query,
    };
  }

  it('sums question counts with all current filters applied', async () => {
    const { service, query } = makeService();
    query.mockImplementation((sql: string) => {
      if (sql.includes('SUM(COALESCE(jsonb_array_length(questions_json), 0))')) {
        return Promise.resolve({ rows: [{ total: '5' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.getFacets(
      { status: 'completed', position: 'Engineer' },
      { id: 'admin', role: 'admin', demo: false },
    );

    const totalCall = query.mock.calls.find(([sql]) =>
      sql.includes('SUM(COALESCE(jsonb_array_length(questions_json), 0))'),
    );
    expect(totalCall).toBeDefined();
    const [sql, params] = totalCall!;
    expect(sql).toContain('status = $');
    expect(sql).toContain('lower(position) = $');
    expect(params).toEqual(expect.arrayContaining(['completed', 'engineer']));
    expect(result.totalQuestionCount).toBe(5);
  });
});
