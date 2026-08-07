import {
  buildCreatedQuestionCard,
  buildInterviewCardHref,
  buildInterviewRedirect,
  buildQuestionsListRedirect,
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
});
