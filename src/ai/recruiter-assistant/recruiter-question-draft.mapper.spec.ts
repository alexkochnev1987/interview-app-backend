import { mapDraftGenerateToCreateQuestionDto } from './recruiter-question-draft.mapper';
import { QuestionDraftGenerate } from '../question-draft-content';

describe('recruiter-question-draft.mapper', () => {
  it('maps a generated draft to CreateQuestionDto', () => {
    const draft: QuestionDraftGenerate = {
      questionText: 'Explain React hooks.',
      followUpQuestions: ['Which hook would you use?'],
      expectedConcepts: [{ id: 'hooks', label: 'Hooks', weight: 1, description: 'Uses hooks' }],
      redFlags: [{ id: 'vague', label: 'Vague', severity: 'medium' }],
      difficulty: 'medium',
      weight: 1,
      sampleGoodAnswer: 'Hooks let you use state in function components.',
      minimumPassScore: 3,
      tags: ['react'],
      role: 'Frontend Developer',
    };

    expect(mapDraftGenerateToCreateQuestionDto(draft, 'en')).toEqual({
      primaryLocale: 'en',
      translations: {
        en: {
          questionText: draft.questionText,
          followUpQuestions: draft.followUpQuestions,
          expectedConcepts: draft.expectedConcepts,
          redFlags: draft.redFlags,
          sampleGoodAnswer: draft.sampleGoodAnswer,
        },
      },
      role: 'Frontend Developer',
      difficulty: 'medium',
      weight: 1,
      minimumPassScore: 3,
      tags: ['react'],
      metadata: { source: 'recruiter-assistant' },
    });
  });
});
