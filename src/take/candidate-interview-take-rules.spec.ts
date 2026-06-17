import { CANCELED_INTERVIEW_TAKE_BLOCKED_MESSAGE } from '../interview/interview-management-rules';
import { getCanceledInterviewTakeBlockReason } from './candidate-interview-take-rules';

describe('candidate-interview-take-rules', () => {
  it('allows non-canceled interviews', () => {
    for (const status of [
      'pending',
      'in_progress',
      'processing',
      'completed',
      'failed',
    ] as const) {
      expect(getCanceledInterviewTakeBlockReason(status)).toBeNull();
    }
  });

  it('blocks canceled interviews', () => {
    expect(getCanceledInterviewTakeBlockReason('canceled')).toBe(
      CANCELED_INTERVIEW_TAKE_BLOCKED_MESSAGE,
    );
  });
});
