import {
  extractCandidateNameFromCreateRequest,
  extractHrUserName,
  extractInterviewCandidateName,
} from './recruiter-assistant-name-extract';

describe('extractInterviewCandidateName', () => {
  it('captures the full candidate name in assign phrasing', () => {
    expect(
      extractInterviewCandidateName(
        'assign the interview for Alice Smith to Jane Doe please',
      ),
    ).toBe('Alice Smith');
  });
});

describe('extractHrUserName', () => {
  it('captures the HR reviewer without trailing filler words', () => {
    expect(
      extractHrUserName(
        'assign the interview for Alice Smith to Jane Doe please',
      ),
    ).toBe('Jane Doe');
  });
});

describe('extractCandidateNameFromCreateRequest', () => {
  it('does not treat role phrases after for as candidate names', () => {
    expect(
      extractCandidateNameFromCreateRequest(
        'prepare questions for a React developer',
      ),
    ).toBeUndefined();
  });

  it('captures explicit candidate names', () => {
    expect(
      extractCandidateNameFromCreateRequest('prepare interview for Alice Smith'),
    ).toBe('Alice Smith');
  });
});
