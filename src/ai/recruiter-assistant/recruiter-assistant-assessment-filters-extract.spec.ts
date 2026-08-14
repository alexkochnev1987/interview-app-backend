import { extractAssessmentFilters } from './recruiter-assistant-assessment-filters-extract';

describe('extractAssessmentFilters', () => {
  it('returns empty filters for a bare list request', () => {
    expect(extractAssessmentFilters('show assessments')).toEqual({});
  });

  it('extracts review status from explicit phrasing', () => {
    expect(
      extractAssessmentFilters('show assessments with status ready'),
    ).toEqual({
      status: 'ready',
    });
  });

  it('extracts review status before assessments', () => {
    expect(extractAssessmentFilters('list scoring assessments')).toEqual({
      status: 'scoring',
    });
  });

  it('extracts search text from implicit phrasing', () => {
    expect(extractAssessmentFilters('show react assessments')).toEqual({
      q: 'react',
    });
  });

  it('extracts quoted search text', () => {
    expect(
      extractAssessmentFilters('show assessments containing "Alice Smith"'),
    ).toEqual({
      q: 'Alice Smith',
    });
  });

  it('extracts both status and search when present', () => {
    expect(extractAssessmentFilters('show ready react assessments')).toEqual({
      status: 'ready',
      q: 'react',
    });
  });
});
