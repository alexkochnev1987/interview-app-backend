import { applyCreatePendingActionQuestionOverride } from './recruiter-pending-action-override';

describe('applyCreatePendingActionQuestionOverride', () => {
  const stored = {
    type: 'create_interview' as const,
    position: 'JS Basics',
    candidateName: 'Candy',
    candidateEmail: 'candy@example.com',
    interviewLocale: 'en' as const,
    questions: [
      {
        key: 'template-1',
        questionText: 'Question 1',
        existingQuestionId: '11111111-1111-4111-8111-111111111111',
        existingQuestionText: 'Question 1',
        needsCreation: false,
      },
      {
        key: 'template-2',
        questionText: 'Question 2',
        existingQuestionId: '22222222-2222-4222-8222-222222222222',
        existingQuestionText: 'Question 2',
        needsCreation: false,
      },
    ],
  };

  it('accepts removing questions when the client payload reorders JSON fields', () => {
    const override = {
      ...stored,
      questions: [
        {
          existingQuestionId: '11111111-1111-4111-8111-111111111111',
          existingQuestionText: 'Question 1',
          key: 'template-1',
          needsCreation: false,
          questionText: 'Question 1',
        },
      ],
    };

    expect(applyCreatePendingActionQuestionOverride(stored, override)).toEqual({
      ...stored,
      questions: [stored.questions[0]],
    });
  });

  it('rejects unknown or duplicate question keys', () => {
    expect(
      applyCreatePendingActionQuestionOverride(stored, {
        ...stored,
        questions: [{ key: 'missing', questionText: 'Missing' }],
      }),
    ).toBeNull();

    expect(
      applyCreatePendingActionQuestionOverride(stored, {
        ...stored,
        questions: [stored.questions[0]!, stored.questions[0]!],
      }),
    ).toBeNull();
  });

  it('rejects metadata changes on the override payload', () => {
    expect(
      applyCreatePendingActionQuestionOverride(stored, {
        ...stored,
        candidateEmail: undefined,
        questions: [stored.questions[0]!],
      }),
    ).toBeNull();
  });
});
