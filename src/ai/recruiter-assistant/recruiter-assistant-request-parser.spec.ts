import {
  extractCandidateEmail,
  extractQuestionCount,
  parseRecruiterRequest,
} from './recruiter-assistant-request-parser';

describe('extractQuestionCount', () => {
  it('defaults to 10 when no question count is mentioned', () => {
    expect(
      extractQuestionCount(
        'prepare questions for a senior React role, we have 2 weeks before the interview',
      ),
    ).toBe(10);
  });

  it('reads counts tied to question wording', () => {
    expect(extractQuestionCount('prepare 8 questions for React')).toBe(8);
    expect(extractQuestionCount('questions count of 5')).toBe(5);
    expect(extractQuestionCount('generate 6 questions')).toBe(6);
  });

  it('clamps counts to the supported range', () => {
    expect(extractQuestionCount('prepare 0 questions')).toBe(1);
    expect(extractQuestionCount('prepare 99 questions')).toBe(12);
  });
});

describe('extractCandidateEmail', () => {
  it('returns undefined when no candidate email context is present', () => {
    expect(
      extractCandidateEmail(
        'prepare questions for React and cc hr@company.com for visibility',
      ),
    ).toBeUndefined();
  });

  it('reads emails with explicit candidate email phrasing', () => {
    expect(
      extractCandidateEmail('candidate email: alice@example.com for React'),
    ).toBe('alice@example.com');
    expect(extractCandidateEmail('candidate alice@example.com for React')).toBe(
      'alice@example.com',
    );
    expect(
      extractCandidateEmail('for candidate bob@example.com prepare questions'),
    ).toBe('bob@example.com');
  });
});

describe('parseRecruiterRequest', () => {
  it('combines contextual parsing for create requests', () => {
    expect(
      parseRecruiterRequest(
        'prepare 7 questions for a React developer, candidate email: alice@example.com',
        'en',
      ),
    ).toEqual(
      expect.objectContaining({
        position: 'React Developer',
        count: 7,
        candidateEmail: 'alice@example.com',
        locale: 'en',
      }),
    );
  });
});
