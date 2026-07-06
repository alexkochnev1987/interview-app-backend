import { InterviewQuestion } from '../interview/interfaces/interview.interface';
import { Interview } from '../interview/interfaces/interview.interface';
import { collectInterviewLocaleWarnings } from '../interview/interview-locale-warnings';
import { buildCandidateQuestionView } from '../take/take-question-view';
import { resolveTakeContentLocale } from '../take/take-locale';

function snapshot(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
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

describe('multilingual locale', () => {
  it('resolves take contentLocale with fallback when translation is missing', () => {
    const view = buildCandidateQuestionView(
      snapshot({ translations: { en: snapshot().translations!.en! } }),
      resolveTakeContentLocale('pl', interview({ interviewLocale: 'pl' })),
    );

    expect(view.text).toBe('English question');
    expect(view.resolvedLocale).toBe('en');
    expect(view.fallbackFromLocale).toBe('pl');
  });

  it('reports localeWarnings when a snapshot lacks interviewLocale content', () => {
    const warnings = collectInterviewLocaleWarnings(
      [snapshot({ translations: { en: snapshot().translations!.en! } })],
      'pl',
    );

    expect(warnings).toEqual([
      { questionId: 'q1', availableLocales: ['en'] },
    ]);
  });

  it('uses interviewLocale when take contentLocale is omitted', () => {
    const resolution = resolveTakeContentLocale(undefined, interview());
    const view = buildCandidateQuestionView(snapshot(), resolution);

    expect(resolution.requestedLocale).toBe('pl');
    expect(view.text).toBe('Polish question');
    expect(view.resolvedLocale).toBe('pl');
    expect(view.fallbackFromLocale).toBeUndefined();
  });
});
