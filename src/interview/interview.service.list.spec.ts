import { InterviewService } from './interview.service';
import type { DatabaseService } from '../database/database.service';
import type { QuestionService } from '../question/question.service';

describe('InterviewService list query (findAllPaginated)', () => {
  function makeService() {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const hydrateStoredQuestionCore = jest.fn();
    const databaseService = { query } as unknown as DatabaseService;
    const questionService = {
      hydrateStoredQuestionCore,
    } as unknown as QuestionService;
    return {
      service: new InterviewService(databaseService, questionService),
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

    const [sql] = query.mock.calls[0];
    expect(sql).toContain('jsonb_array_length(questions_json)');
    expect(sql).toContain("jsonb_array_elements(COALESCE(answers_json");
    expect(sql).toContain("result_json->>'overallScore'");
    expect(sql).toContain("result_json->>'decision'");
    expect(sql).not.toContain('workflow_json');
    expect(sql).not.toContain('interview_locale');
  });

  it('maps list rows without hydrating interviews', async () => {
    const { service, query, hydrateStoredQuestionCore } = makeService();
    query.mockResolvedValue({
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
          __total: '1',
        },
      ],
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
});
