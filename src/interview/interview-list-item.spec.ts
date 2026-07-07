import type { Interview } from './interfaces/interview.interface';
import {
  fromInterviewListRow,
  toInterviewListItem,
  type InterviewListRow,
} from './interview-list-item';

function listRow(partial: Partial<InterviewListRow> = {}): InterviewListRow {
  return {
    id: 'interview-1',
    candidate_name: 'Alice',
    candidate_email: 'alice@test.local',
    position: 'Engineer',
    status: 'pending',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    question_count: 2,
    submitted_answer_count: 0,
    overall_score: null,
    decision: null,
    ...partial,
  };
}

function interview(partial: Partial<Interview>): Interview {
  return {
    id: 'interview-1',
    candidateName: 'Alice',
    position: 'Engineer',
    interviewLocale: 'en',
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

describe('fromInterviewListRow', () => {
  it('maps core list fields from a list row', () => {
    const item = fromInterviewListRow(listRow());

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

  it('includes result summary fields when present on the row', () => {
    const item = fromInterviewListRow(
      listRow({
        status: 'completed',
        overall_score: 82,
        decision: 'proceed',
      }),
    );

    expect(item.overallScore).toBe(82);
    expect(item.decision).toBe('proceed');
  });

  it('defaults overall score to zero when result exists without a score', () => {
    const item = fromInterviewListRow(
      listRow({
        status: 'completed',
        overall_score: 0,
      }),
    );

    expect(item.overallScore).toBe(0);
  });

  it('ignores invalid decision values', () => {
    const item = fromInterviewListRow(
      listRow({
        decision: 'maybe',
      }),
    );

    expect(item.decision).toBeUndefined();
  });
});

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
          interviewLocale: 'en',
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
