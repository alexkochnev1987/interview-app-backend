import { QuestionService } from '../../question/question.service';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

describe('RecruiterQuestionMatcherService', () => {
  const user = {
    id: 'admin-1',
    role: 'admin' as const,
    demo: false,
    email: 'admin@example.com',
    name: 'Admin',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };

  const questionService = {
    findSimilar: vi.fn(),
    findAll: vi.fn(),
  };

  const service = new RecruiterQuestionMatcherService(
    questionService as unknown as QuestionService,
  );

  const match = (score: number, id: string, questionText: string) => ({
    question: { id, questionText },
    score,
    reasons: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    questionService.findAll.mockResolvedValue({ items: [] });
  });

  describe('findSimilarMatchesOverThreshold', () => {
    it('returns only matches at or above 80%', async () => {
      questionService.findSimilar.mockResolvedValue([
        match(0.9, 'q1', 'React hooks'),
        match(0.75, 'q2', 'React state'),
        match(0.5, 'q3', 'Vue basics'),
      ]);

      const results = await service.findSimilarMatchesOverThreshold(
        'React hooks',
        user,
        'en',
      );

      expect(results).toHaveLength(1);
      expect(results[0].question.id).toBe('q1');
    });

    it('returns empty when all scores are below 80%', async () => {
      questionService.findSimilar.mockResolvedValue([
        match(0.79, 'q1', 'React hooks'),
      ]);

      const results = await service.findSimilarMatchesOverThreshold(
        'React hooks',
        user,
        'en',
      );

      expect(results).toEqual([]);
    });

    it('falls back to literal match when embeddings fail', async () => {
      questionService.findSimilar.mockRejectedValue(
        new Error('embeddings down'),
      );
      questionService.findAll.mockResolvedValue({
        items: [{ id: 'exact-1', questionText: 'React hooks' }],
      });

      const results = await service.findSimilarMatchesOverThreshold(
        'React hooks',
        user,
        'en',
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        score: 1,
        question: { id: 'exact-1' },
      });
    });

    it('returns empty for blank input', async () => {
      await expect(
        service.findSimilarMatchesOverThreshold('   ', user, 'en'),
      ).resolves.toEqual([]);
      expect(questionService.findSimilar).not.toHaveBeenCalled();
    });
  });
});
