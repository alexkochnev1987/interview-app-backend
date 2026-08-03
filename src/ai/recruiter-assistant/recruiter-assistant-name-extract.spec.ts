import {
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
