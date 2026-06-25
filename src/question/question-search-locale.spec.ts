import { QuestionService } from './question.service';

describe('GET /questions search (translations)', () => {
  const service = Object.create(QuestionService.prototype) as QuestionService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildFilters = (service as any).buildQuestionFilterClauses.bind(service);

  it('includes translations_json in text search', () => {
    const { whereSql } = buildFilters({ q: 'react' }, { forceActive: true });

    expect(whereSql).toContain('search_text ILIKE');
  });
});
