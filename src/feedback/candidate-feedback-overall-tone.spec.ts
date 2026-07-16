import { classifyOverallToneFromQuestionBlocks, resolveOverallFeedbackTone } from './candidate-feedback-overall-tone';
import type { CandidateFeedbackQuestion } from './interfaces/candidate-feedback.interface';
import type { Answer, Interview } from '../interview/interfaces/interview.interface';

describe('candidate-feedback-overall-tone', () => {
  it('classifies mixed interviews without balanced overall praise', () => {
    expect(
      classifyOverallToneFromQuestionBlocks('review', [
        'balanced',
        'no_substantive',
        'honest_weak',
      ]),
    ).toBe('honest_weak');
    expect(
      classifyOverallToneFromQuestionBlocks('proceed', ['balanced', 'no_substantive']),
    ).toBe('growth_focused');
    expect(
      classifyOverallToneFromQuestionBlocks('proceed', ['balanced', 'balanced']),
    ).toBe('balanced');
  });

  it('resolves CF-MIXED metadata from blocks and answers', () => {
    const questionBlocks: CandidateFeedbackQuestion[] = [
      {
        id: 'b0',
        candidateFeedbackId: 'f1',
        questionIndex: 0,
        questionId: 'q-0',
        state: 'generated',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b1',
        candidateFeedbackId: 'f1',
        questionIndex: 1,
        questionId: 'q-1',
        state: 'edited',
        errorMessage: 'unusable_transcript',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b2',
        candidateFeedbackId: 'f1',
        questionIndex: 2,
        questionId: 'q-2',
        state: 'generated',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const interview = {
      questions: [{ id: 'q-0' }, { id: 'q-1' }, { id: 'q-2' }],
      answers: [
        {
          questionIndex: 0,
          questionId: 'q-0',
          status: 'submitted',
          mediaKey: 'm0',
          uploadedAt: new Date(),
          transcript: { text: 'Strong latency troubleshooting answer.' },
          validation: { status: 'completed' },
          evaluation: {
            decisionHint: 'pass',
            overallScore: 90,
            categoryScores: { relevance: 92 },
          },
        },
        {
          questionIndex: 1,
          questionId: 'q-1',
          status: 'submitted',
          mediaKey: 'm1',
          uploadedAt: new Date(),
          transcript: {
            text: 'İzlediğiniz için teşekkür ederim. Bir sonraki videoda görüşürüz.',
          },
          validation: { status: 'completed' },
          evaluation: { decisionHint: 'fail', overallScore: 10 },
        },
        {
          questionIndex: 2,
          questionId: 'q-2',
          status: 'submitted',
          mediaKey: 'm2',
          uploadedAt: new Date(),
          transcript: { text: 'Personal finance vacation planning.' },
          validation: { status: 'completed' },
          evaluation: {
            decisionHint: 'fail',
            overallScore: 18,
            summary: 'Off-topic response.',
            categoryScores: { relevance: 12 },
          },
        },
      ] as Answer[],
      result: { decision: 'review' as const },
    } as Pick<Interview, 'questions' | 'answers' | 'result'>;

    expect(resolveOverallFeedbackTone(interview, questionBlocks)).toEqual({
      toneMode: 'honest_weak',
      mixMetadata: {
        answeredWellCount: 1,
        noSubstantiveAnswerCount: 1,
        weakAnswerCount: 1,
        totalQuestions: 3,
      },
    });
  });

  it('includes failed blocks in overall mix metadata', () => {
    const questionBlocks: CandidateFeedbackQuestion[] = [
      {
        id: 'b0',
        candidateFeedbackId: 'f1',
        questionIndex: 0,
        questionId: 'q-0',
        state: 'generated',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b1',
        candidateFeedbackId: 'f1',
        questionIndex: 1,
        questionId: 'q-1',
        state: 'failed',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b2',
        candidateFeedbackId: 'f1',
        questionIndex: 2,
        questionId: 'q-2',
        state: 'generated',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const interview = {
      questions: [{ id: 'q-0' }, { id: 'q-1' }, { id: 'q-2' }],
      answers: [
        {
          questionIndex: 0,
          questionId: 'q-0',
          status: 'submitted',
          mediaKey: 'm0',
          uploadedAt: new Date(),
          transcript: { text: 'Strong answer on caching.' },
          validation: { status: 'completed' },
          evaluation: {
            decisionHint: 'pass',
            overallScore: 88,
            categoryScores: { relevance: 90 },
          },
        },
        {
          questionIndex: 1,
          questionId: 'q-1',
          status: 'submitted',
          mediaKey: 'm1',
          uploadedAt: new Date(),
          transcript: { text: 'Weak vague answer without depth.' },
          validation: { status: 'completed' },
          evaluation: {
            decisionHint: 'review',
            overallScore: 58,
            categoryScores: { relevance: 55 },
          },
        },
        {
          questionIndex: 2,
          questionId: 'q-2',
          status: 'submitted',
          mediaKey: 'm2',
          uploadedAt: new Date(),
          transcript: { text: 'Another strong answer on indexing.' },
          validation: { status: 'completed' },
          evaluation: {
            decisionHint: 'pass',
            overallScore: 86,
            categoryScores: { relevance: 88 },
          },
        },
      ] as Answer[],
      result: { decision: 'proceed' as const },
    } as Pick<Interview, 'questions' | 'answers' | 'result'>;

    expect(resolveOverallFeedbackTone(interview, questionBlocks)).toEqual({
      toneMode: 'growth_focused',
      mixMetadata: {
        answeredWellCount: 2,
        noSubstantiveAnswerCount: 0,
        weakAnswerCount: 1,
        totalQuestions: 3,
      },
    });
  });
});
