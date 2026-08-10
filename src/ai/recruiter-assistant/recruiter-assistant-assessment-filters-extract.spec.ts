import { extractAssessmentFilters } from './recruiter-assistant-assessment-filters-extract';

describe('extractAssessmentFilters', () => {
  it('returns empty filters for a bare list request', () => {
    expect(extractAssessmentFilters('show assessments')).toEqual({});
  });

  it('extracts position from "for" phrasing', () => {
    expect(extractAssessmentFilters('list templates for Java engineer')).toEqual({
      position: 'Java engineer',
    });
  });

  it('extracts known role keywords as position', () => {
    expect(extractAssessmentFilters('show react assessments')).toEqual({
      position: 'React Developer',
    });
  });

  it('extracts quoted assessment names', () => {
    expect(extractAssessmentFilters('show assessments named "Senior React"')).toEqual({
      nameContains: 'Senior React',
    });
  });

  it('extracts named assessment titles', () => {
    expect(extractAssessmentFilters('list templates called Backend Basics')).toEqual({
      nameContains: 'Backend Basics',
    });
  });

  it('extracts both position and name when present', () => {
    expect(
      extractAssessmentFilters('show frontend assessments named Core Skills'),
    ).toEqual({
      position: 'Frontend Developer',
      nameContains: 'Core Skills',
    });
  });
});
