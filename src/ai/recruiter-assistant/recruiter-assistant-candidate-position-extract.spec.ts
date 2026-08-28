import {
  extractCandidateInterviewPosition,
  isCandidateLatestInterviewQuery,
} from './recruiter-assistant-candidate-position-extract';

describe('recruiter-assistant-candidate-position-extract', () => {
  it('extracts position from my <role> interview phrasing', () => {
    expect(
      extractCandidateInterviewPosition(
        'what is the status of my React Developer interview',
      ),
    ).toBe('React Developer');
  });

  it('falls back to keyword extraction when only a role keyword is present', () => {
    expect(
      extractCandidateInterviewPosition(
        'did my backend interview get reviewed',
      ),
    ).toBe('Backend Developer');
  });

  it('does not treat latest as a position', () => {
    expect(
      extractCandidateInterviewPosition(
        'what is the status of my latest interview',
      ),
    ).toBeUndefined();
  });

  it('detects latest-interview qualifiers', () => {
    expect(
      isCandidateLatestInterviewQuery(
        'what is the status of my most recent interview',
      ),
    ).toBe(true);
  });
});
