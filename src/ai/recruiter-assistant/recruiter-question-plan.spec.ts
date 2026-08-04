import { buildQuestionSuggestions } from './recruiter-question-plan';

describe('buildQuestionSuggestions', () => {
  it('pads backend-specific topics from the generic pool', () => {
    const suggestions = buildQuestionSuggestions({
      position: 'Backend Developer',
      count: 6,
      locale: 'en',
    });

    expect(suggestions).toHaveLength(6);
    expect(suggestions[0].subcategory).toBe('api-design');
    expect(suggestions[5].subcategory).toBe('code-review');
  });
});
