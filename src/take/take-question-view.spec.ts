import { Request } from 'express';
import { DEFAULT_LOCALE } from '../locale/locale.constants';
import { InterviewQuestion } from '../interview/interfaces/interview.interface';
import { buildCandidateQuestionView } from './take-question-view';
import { resolveTakeLocale } from './take-locale';
import { Interview } from '../interview/interfaces/interview.interface';

function question(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    id: 'q1',
    primaryLocale: 'en',
    translations: {
      en: {
        questionText: 'English question',
        followUpQuestions: ['EN follow-up'],
        expectedConcepts: [],
        redFlags: [],
      },
      pl: {
        questionText: 'Polish question',
        followUpQuestions: ['PL follow-up'],
        expectedConcepts: [],
        redFlags: [],
      },
    },
    outputLanguage: 'English',
    questionText: 'English question',
    followUpQuestions: ['EN follow-up'],
    expectedConcepts: [],
    redFlags: [],
    difficulty: 'medium',
    weight: 1,
    minimumPassScore: 0,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

describe('buildCandidateQuestionView', () => {
  it('resolves text for requested locale', () => {
    const view = buildCandidateQuestionView(question(), 'pl');
    expect(view.text).toBe('Polish question');
    expect(view.followUpQuestions).toEqual(['PL follow-up']);
    expect(view.resolvedLocale).toBe('pl');
    expect(view.fallbackFromLocale).toBeUndefined();
  });

  it('sets fallbackFromLocale when falling back', () => {
    const view = buildCandidateQuestionView(
      question({ translations: { en: question().translations!.en! } }),
      'pl',
    );
    expect(view.resolvedLocale).toBe('en');
    expect(view.fallbackFromLocale).toBe('pl');
  });
});

describe('resolveTakeLocale', () => {
  const interview = {
    interviewLocale: 'pl',
  } as Interview;

  it('uses interviewLocale and ignores X-Locale header', () => {
    const locale = resolveTakeLocale(
      { headers: { 'x-locale': 'ru' } } as unknown as Request,
      interview,
    );
    expect(locale).toBe('pl');
  });

  it('uses interviewLocale when header omitted', () => {
    const locale = resolveTakeLocale({ headers: {} } as unknown as Request, interview);
    expect(locale).toBe('pl');
  });

  it('defaults interview locale to en when missing', () => {
    const locale = resolveTakeLocale(
      { headers: {} } as unknown as Request,
      { interviewLocale: undefined } as unknown as Interview,
    );
    expect(locale).toBe(DEFAULT_LOCALE);
  });
});
