import {
  CANDIDATE_TOKEN_MISMATCH_MESSAGE,
  getCandidateTokenMismatchReason,
} from './candidate-interview-access';

describe('candidate-interview-access', () => {
  it('allows matching interview ids', () => {
    expect(getCandidateTokenMismatchReason('abc', 'abc')).toBeNull();
  });

  it('blocks mismatched token interview ids', () => {
    expect(getCandidateTokenMismatchReason('interview-b', 'interview-a')).toBe(
      CANDIDATE_TOKEN_MISMATCH_MESSAGE,
    );
  });
});
