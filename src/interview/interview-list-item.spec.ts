import type { Interview } from './interfaces/interview.interface';
import { toInterviewListItem } from './interview-list-item';

function interview(partial: Partial<Interview>): Interview {
  return {
    id: 'interview-1',
    candidateName: 'Alice',
    position: 'Engineer',
    questions: [
      { id: 'q1', questionText: 'One' } as Interview['questions'][0],
      { id: 'q2', questionText: 'Two' } as Interview['questions'][0],
    ],
    answers: [],
    status: 'pending',
    demo: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...partial,
  };
}

describe('toInterviewListItem', () => {
  it('maps core list fields from an interview', () => {
    const item = toInterviewListItem(
      interview({
        candidateEmail: 'alice@test.local',
      }),
    );

    expect(item).toEqual({
      id: 'interview-1',
      candidateName: 'Alice',
      candidateEmail: 'alice@test.local',
      position: 'Engineer',
      status: 'pending',
      questionCount: 2,
      submittedAnswerCount: 0,
      overallScore: undefined,
      decision: undefined,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
  });

  it('includes result summary fields when a result exists', () => {
    const item = toInterviewListItem(
      interview({
        status: 'completed',
        result: {
          overallScore: 82,
          summary: 'Strong answers.',
          categoryScores: {},
          completedAt: new Date('2026-01-03T00:00:00.000Z'),
          decision: 'proceed',
        },
      }),
    );

    expect(item.overallScore).toBe(82);
    expect(item.decision).toBe('proceed');
  });

  it('counts only submitted answers', () => {
    const item = toInterviewListItem(
      interview({
        answers: [
          { status: 'recording' } as Interview['answers'][0],
          { status: 'submitted' } as Interview['answers'][0],
          { status: 'submitted' } as Interview['answers'][0],
        ],
      }),
    );

    expect(item.submittedAnswerCount).toBe(2);
  });

  it('does not include questions, answers, or workflow fields', () => {
    const item = toInterviewListItem(
      interview({
        workflow: { status: 'idle', lastUpdatedAt: new Date() },
        answers: [{ status: 'submitted' } as Interview['answers'][0]],
      }),
    );

    expect(item).not.toHaveProperty('questions');
    expect(item).not.toHaveProperty('answers');
    expect(item).not.toHaveProperty('workflow');
    expect(item).not.toHaveProperty('result');
  });
});
