import type { Interview } from './interfaces/interview.interface';
import {
  getInterviewCompletionBlockReason,
  getSubmittedAnswerCount,
  INTERVIEW_COMPLETE_REQUIRES_ALL_ANSWERS_MESSAGE,
} from './interview-completion-rules';

function interview(
  partial: Pick<Interview, 'answers' | 'questions'>,
): Pick<Interview, 'answers' | 'questions'> {
  return partial;
}

describe('interview-completion-rules', () => {
  it('counts only submitted answers', () => {
    expect(
      getSubmittedAnswerCount(
        interview({
          questions: [{ id: 'q1', questionText: 'One' } as Interview['questions'][0]],
          answers: [
            { status: 'recording' } as Interview['answers'][0],
            { status: 'submitted' } as Interview['answers'][0],
          ],
        }),
      ),
    ).toBe(1);
  });

  it('blocks completion until every question has a submitted answer', () => {
    const incomplete = interview({
      questions: [
        { id: 'q1', questionText: 'One' } as Interview['questions'][0],
        { id: 'q2', questionText: 'Two' } as Interview['questions'][0],
      ],
      answers: [{ status: 'submitted' } as Interview['answers'][0]],
    });

    expect(getInterviewCompletionBlockReason(incomplete)).toBe(
      INTERVIEW_COMPLETE_REQUIRES_ALL_ANSWERS_MESSAGE,
    );

    const complete = interview({
      questions: [{ id: 'q1', questionText: 'One' } as Interview['questions'][0]],
      answers: [{ status: 'submitted' } as Interview['answers'][0]],
    });

    expect(getInterviewCompletionBlockReason(complete)).toBeNull();
  });
});
