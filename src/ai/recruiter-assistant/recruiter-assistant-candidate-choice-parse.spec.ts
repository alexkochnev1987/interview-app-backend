import {
  parseCandidateChoice,
  parseRegisteredCandidateConfirmation,
} from './recruiter-assistant-candidate-choice-parse';

describe('parseCandidateChoice', () => {
  it('recognizes a registered candidate id', () => {
    expect(
      parseCandidateChoice('a1b2c3d4-e5f6-4789-a012-3456789abcde'),
    ).toEqual({
      kind: 'registered',
      id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    });
  });

  it('treats free text as a new candidate name', () => {
    expect(parseCandidateChoice('Alice Smith')).toEqual({
      kind: 'new',
      name: 'Alice Smith',
    });
  });

  it('returns null for empty or new-candidate phrasing', () => {
    expect(parseCandidateChoice('')).toBeNull();
    expect(parseCandidateChoice('new candidate')).toBeNull();
  });
});

describe('parseRegisteredCandidateConfirmation', () => {
  it('parses yes/no replies', () => {
    expect(parseRegisteredCandidateConfirmation('yes')).toBe('yes');
    expect(parseRegisteredCandidateConfirmation('no')).toBe('no');
    expect(parseRegisteredCandidateConfirmation('maybe')).toBeNull();
  });
});
