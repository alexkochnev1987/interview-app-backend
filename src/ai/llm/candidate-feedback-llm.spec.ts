import { classifyQuestionFeedbackToneMode } from '../../feedback/candidate-feedback-eligibility';
import { getCandidateFeedbackQuestionSystemPrompt } from './candidate-feedback-llm';

describe('candidate-feedback-llm', () => {
  it('uses honest_weak prompts for failed evaluations', () => {
    const toneMode = classifyQuestionFeedbackToneMode({
      validation: { status: 'completed' },
      evaluation: {
        decisionHint: 'fail',
        overallScore: 18,
        summary: 'Did not address the question.',
        categoryScores: { relevance: 12 },
      },
    });

    expect(toneMode).toBe('honest_weak');
    expect(getCandidateFeedbackQuestionSystemPrompt(toneMode)).toContain(
      'Do NOT invent strengths',
    );
  });
});
