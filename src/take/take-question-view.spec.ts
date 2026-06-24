import { DEFAULT_LOCALE } from '../locale/locale.constants';
import { InterviewQuestion } from '../interview/interfaces/interview.interface';
import { buildCandidateQuestionView } from './take-question-view';
import { resolveTakeContentLocale } from './take-locale';
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

function interview(overrides: Partial<Interview> = {}): Interview {
  return {
    interviewLocale: 'pl',
    ...overrides,
  } as Interview;
}

describe('buildCandidateQuestionView', () => {
  it('resolves text for requested locale', () => {
    const view = buildCandidateQuestionView(
      question(),
      resolveTakeContentLocale('pl', interview()),
    );
    expect(view.text).toBe('Polish question');
    expect(view.followUpQuestions).toEqual(['PL follow-up']);
    expect(view.resolvedLocale).toBe('pl');
    expect(view.fallbackFromLocale).toBeUndefined();
  });

  it('sets fallbackFromLocale when falling back', () => {
    const view = buildCandidateQuestionView(
      question({ translations: { en: question().translations!.en! } }),
      resolveTakeContentLocale('pl', interview({ interviewLocale: 'en' })),
    );
    expect(view.resolvedLocale).toBe('en');
    expect(view.fallbackFromLocale).toBe('pl');
  });

  it('falls back to interviewLocale when contentLocale translation is missing', () => {
    const view = buildCandidateQuestionView(
      question(),
      resolveTakeContentLocale('ru', interview({ interviewLocale: 'pl' })),
    );
    expect(view.text).toBe('Polish question');
    expect(view.resolvedLocale).toBe('pl');
    expect(view.fallbackFromLocale).toBe('ru');
  });
});

describe('resolveTakeContentLocale', () => {
  it('uses interviewLocale when contentLocale is omitted', () => {
    const resolution = resolveTakeContentLocale(undefined, interview());
    expect(resolution.requestedLocale).toBe('pl');
    expect(resolution.localeFallbackChain).toEqual(['pl']);
  });

  it('uses contentLocale when provided', () => {
    const resolution = resolveTakeContentLocale('ru', interview());
    expect(resolution.requestedLocale).toBe('ru');
    expect(resolution.localeFallbackChain).toEqual(['ru', 'pl']);
  });

  it('defaults interview locale to en when missing', () => {
    const resolution = resolveTakeContentLocale(
      undefined,
      interview({ interviewLocale: undefined }),
    );
    expect(resolution.requestedLocale).toBe(DEFAULT_LOCALE);
  });

  it('rejects invalid contentLocale', () => {
    expect(() =>
      resolveTakeContentLocale('de', interview()),
    ).toThrow('Invalid contentLocale query');
  });
});
