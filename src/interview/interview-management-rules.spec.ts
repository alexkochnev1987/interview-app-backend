import {
  CANCELED_INTERVIEW_TAKE_BLOCKED_MESSAGE,
  getInterviewPendingOnlyBlockReason,
  INTERVIEW_PENDING_ONLY_MESSAGE,
  isTerminalInterviewStatus,
} from './interview-management-rules';

describe('interview-management-rules', () => {
  describe('getInterviewPendingOnlyBlockReason', () => {
    it('allows pending interviews', () => {
      expect(getInterviewPendingOnlyBlockReason('pending')).toBeNull();
    });

    it('blocks non-pending interviews', () => {
      for (const status of [
        'in_progress',
        'processing',
        'completed',
        'failed',
        'canceled',
      ] as const) {
        expect(getInterviewPendingOnlyBlockReason(status)).toBe(
          INTERVIEW_PENDING_ONLY_MESSAGE,
        );
      }
    });
  });

  describe('isTerminalInterviewStatus', () => {
    it('recognizes terminal statuses', () => {
      expect(isTerminalInterviewStatus('completed')).toBe(true);
      expect(isTerminalInterviewStatus('failed')).toBe(true);
      expect(isTerminalInterviewStatus('canceled')).toBe(true);
    });

    it('rejects active statuses', () => {
      expect(isTerminalInterviewStatus('pending')).toBe(false);
      expect(isTerminalInterviewStatus('in_progress')).toBe(false);
      expect(isTerminalInterviewStatus('processing')).toBe(false);
    });
  });

  it('exports canceled take message', () => {
    expect(CANCELED_INTERVIEW_TAKE_BLOCKED_MESSAGE).toBe(
      'This interview has been canceled',
    );
  });
});
