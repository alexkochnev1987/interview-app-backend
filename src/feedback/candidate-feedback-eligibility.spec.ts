import {
  classifyOverallFeedbackToneMode,
  classifyQuestionFeedbackGeneration,
  classifyQuestionFeedbackToneMode,
  getCandidateFeedbackInterviewStatusBlockReason,
  isUnusableTranscript,
} from './candidate-feedback-eligibility';
import type { Answer, Interview, InterviewQuestion } from '../interview/interfaces/interview.interface';

function baseInterview(questionCount = 1): Pick<Interview, 'questions'> {
  return {
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: `q-${index}`,
      primaryLocale: 'en',
      translations: {},
      followUpQuestions: [],
      redFlags: [],
      weight: 1,
      minimumPassScore: 60,
      tags: [],
      metadata: {},
      questionText: `Question ${index}`,
      role: 'engineer',
      focus: 'backend',
      category: 'technical',
      subcategory: 'api',
      difficulty: 'medium',
      expectedConcepts: [],
      outputLanguage: 'en',
    })) as InterviewQuestion[],
  };
}

function submittedAnswer(overrides: Partial<Answer> = {}): Answer {
  return {
    questionIndex: 0,
    questionId: 'q-0',
    status: 'submitted',
    mediaKey: 'media',
    uploadedAt: new Date(),
    transcript: { text: 'I explained caching and database indexing in detail.' },
    validation: { status: 'completed' },
    evaluation: {
      overallScore: 82,
      decisionHint: 'pass',
      summary: 'Strong, on-topic answer.',
      categoryScores: { relevance: 85, depth: 80, communication: 78 },
    },
    ...overrides,
  };
}

describe('candidate-feedback-eligibility', () => {
  it('detects unusable transcripts including multilingual outros', () => {
    expect(isUnusableTranscript('Thanks for watching! Like and subscribe.')).toBe(
      true,
    );
    expect(
      isUnusableTranscript(
        'Thanks for watching! Like and subscribe for more videos.',
      ),
    ).toBe(true);
    expect(
      isUnusableTranscript(
        'İzlediğiniz için teşekkür ederim. Bir sonraki videoda görüşürüz.',
      ),
    ).toBe(true);
    expect(
      isUnusableTranscript('We used Redis cache layers for hot reads.'),
    ).toBe(false);
    expect(
      isUnusableTranscript(
        'I used Redis caching for hot reads. Thanks for watching the demo.',
      ),
    ).toBe(false);
  });

  it('classifies per-question generation: skip garbage, generate on-topic', () => {
    expect(
      classifyQuestionFeedbackGeneration(
        baseInterview(),
        submittedAnswer({
          transcript: {
            text: 'İzlediğiniz için teşekkür ederim. Bir sonraki videoda görüşürüz.',
          },
        }),
        0,
      ),
    ).toEqual({ action: 'skip', reason: 'unusable_transcript' });

    expect(
      classifyQuestionFeedbackGeneration(baseInterview(), submittedAnswer(), 0),
    ).toEqual({
      action: 'generate',
      toneMode: 'balanced',
      transcriptText: submittedAnswer().transcript!.text!.trim(),
    });

    expect(
      classifyQuestionFeedbackGeneration(
        baseInterview(),
        submittedAnswer({
          selectedVersionNumber: 2,
          versions: [
            {
              versionNumber: 1,
              mediaKey: 'media-v1',
              uploadedAt: new Date(),
            },
            {
              versionNumber: 2,
              mediaKey: 'media-v2',
              uploadedAt: new Date(),
              behaviorSignals: {
                tabHiddenCount: 1,
                windowBlurCount: 0,
                pasteCount: 0,
                keydownCount: 0,
                copyCount: 0,
                resizeCount: 0,
              },
            },
          ],
          validation: {
            status: 'completed',
            sourceVersionNumber: 1,
          },
        }),
        0,
      ),
    ).toEqual({ action: 'skip', reason: 'stale_validation' });

    expect(
      classifyQuestionFeedbackGeneration(
        baseInterview(),
        submittedAnswer({
          evaluation: {
            decisionHint: 'fail',
            overallScore: 25,
            summary: 'Off-topic response.',
            categoryScores: { relevance: 20 },
          },
        }),
        0,
      ),
    ).toMatchObject({ action: 'generate', toneMode: 'honest_weak' });
  });

  it('allows feedback for completed and failed interviews only', () => {
    expect(getCandidateFeedbackInterviewStatusBlockReason('completed')).toBeNull();
    expect(getCandidateFeedbackInterviewStatusBlockReason('failed')).toBeNull();
    expect(getCandidateFeedbackInterviewStatusBlockReason('in_progress')).toBeTruthy();
  });

  it('falls back to decision-only overall tone when no blocks exist', () => {
    expect(classifyOverallFeedbackToneMode('proceed')).toBe('balanced');
    expect(classifyOverallFeedbackToneMode('review')).toBe('growth_focused');
    expect(classifyOverallFeedbackToneMode('reject')).toBe('honest_weak');
  });

  it('uses transcript_only without evaluation and honors pass hint over medium score', () => {
    expect(
      classifyQuestionFeedbackToneMode({
        validation: { status: 'completed' },
        evaluation: undefined,
      }),
    ).toBe('transcript_only');

    expect(
      classifyQuestionFeedbackToneMode({
        validation: { status: 'completed' },
        evaluation: {
          decisionHint: 'pass',
          overallScore: 65,
          categoryScores: { relevance: 62 },
        },
      }),
    ).toBe('balanced');

    expect(
      classifyQuestionFeedbackGeneration(
        baseInterview(),
        submittedAnswer({
          evaluation: {
            decisionHint: 'fail',
            overallScore: 25,
            summary: 'Ответ не по теме вопроса.',
            categoryScores: { relevance: 20 },
          },
        }),
        0,
      ),
    ).toMatchObject({ action: 'generate', toneMode: 'honest_weak' });
  });
});
