import { slugifyExpectedConceptId } from './recruiter-question-create-dto.mapper';

describe('slugifyExpectedConceptId', () => {
  it('falls back to an indexed id for non-Latin labels', () => {
    expect(slugifyExpectedConceptId('изоляция транзакций', 2)).toBe('concept_3');
  });

  it('keeps ASCII slugs when possible', () => {
    expect(slugifyExpectedConceptId('Rate Limiting', 0)).toBe('rate_limiting');
  });
});
