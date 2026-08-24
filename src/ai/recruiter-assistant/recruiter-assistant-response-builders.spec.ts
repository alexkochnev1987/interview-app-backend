import {
  buildAssessmentsListRedirect,
  buildCreatedQuestionCard,
  buildInterviewCardHref,
  buildInterviewRedirect,
  buildQuestionsListRedirect,
  buildSimilarQuestionMatchCard,
} from './recruiter-assistant-response-builders';

describe('recruiter-assistant-response-builders', () => {
  it('builds a question card href', () => {
    expect(
      buildCreatedQuestionCard({
        id: 'abc',
        questionText: 'Tell me about React hooks.',
      }),
    ).toEqual({
      id: 'abc',
      questionText: 'Tell me about React hooks.',
      href: '/questions/abc',
    });
  });

  it('builds a similar question match card href', () => {
    expect(
      buildSimilarQuestionMatchCard({
        id: 'abc',
        questionText: 'Explain React hooks.',
        score: 0.85,
      }),
    ).toEqual({
      id: 'abc',
      questionText: 'Explain React hooks.',
      score: 0.85,
      href: '/questions/abc',
    });
  });

  it('builds an interview redirect with query params', () => {
    expect(
      buildInterviewRedirect({
        candidateName: 'Alice',
        position: 'Dev',
      }),
    ).toEqual({
      path: '/interviews/new',
      query: {
        candidateName: 'Alice',
        position: 'Dev',
      },
    });
  });

  it('builds an interview card href', () => {
    expect(buildInterviewCardHref('id-1')).toBe('/interviews/id-1');
  });

  it('builds a questions list redirect without filters', () => {
    expect(buildQuestionsListRedirect({})).toEqual({ path: '/questions' });
  });

  it('builds a questions list redirect with valid query params', () => {
    expect(
      buildQuestionsListRedirect({
        difficulty: 'hard',
        role: 'React Developer',
        tags: ['hooks', 'state'],
      }),
    ).toEqual({
      path: '/questions',
      query: {
        difficulty: 'hard',
        role: 'React Developer',
        tags: 'hooks,state',
      },
    });
  });

  it('builds an assessments list redirect with filters', () => {
    expect(buildAssessmentsListRedirect({})).toEqual({ path: '/assessments' });
    expect(
      buildAssessmentsListRedirect({ status: 'ready', q: 'react' }),
    ).toEqual({
      path: '/assessments',
      query: {
        status: 'ready',
        q: 'react',
      },
    });
  });
});
