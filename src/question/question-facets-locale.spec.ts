import { QuestionService } from './question.service';

describe('GET /questions/facets filters (BE-010)', () => {
  const service = Object.create(QuestionService.prototype) as QuestionService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildFilters = (service as any).buildQuestionFilterClauses.bind(service);

  it('applies locale translation filter like list', () => {
    const { whereSql, params } = buildFilters(
      { locale: 'pl' },
      { forceActive: true },
    );

    expect(whereSql).toContain('translations_json');
    expect(params).toContain('pl');
    expect(whereSql).toContain('deleted = FALSE');
    expect(whereSql).toContain("translations_json -> $");
    expect(whereSql).not.toMatch(/primary_locale = \$1\s*OR/);
  });

  it('keeps locale filter when excluding another facet dimension', () => {
    const { whereSql, params } = buildFilters(
      { locale: 'ru', category: 'backend', difficulty: 'easy' },
      { forceActive: true, excludeField: 'category' },
    );

    expect(params).toContain('ru');
    expect(whereSql).toContain('translations_json');
    expect(whereSql).not.toContain('lower(category)');
    expect(whereSql).toContain('difficulty =');
  });

  it('filters by primaryLocale query param', () => {
    const { whereSql, params } = buildFilters(
      { primaryLocale: 'pl' },
      { forceActive: true },
    );

    expect(params).toContain('pl');
    expect(whereSql).toContain('primary_locale =');
  });

  it('deprecated outputLanguage still maps to primary_locale', () => {
    const { whereSql, params } = buildFilters(
      { outputLanguage: 'English' },
      { forceActive: true },
    );

    expect(params).toContain('en');
    expect(whereSql).toContain('primary_locale');
    expect(whereSql).toContain('output_language');
  });

  it('primaryLocale wins over deprecated outputLanguage', () => {
    const { whereSql, params } = buildFilters(
      { primaryLocale: 'pl', outputLanguage: 'English' },
      { forceActive: true },
    );

    expect(params).toEqual([false, 'pl']);
    expect(whereSql).toContain('primary_locale =');
    expect(whereSql).not.toContain('output_language');
  });
});
