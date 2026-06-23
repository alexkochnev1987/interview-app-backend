import {
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
    });

    it('rejects active statuses', () => {
      expect(isTerminalInterviewStatus('pending')).toBe(false);
      expect(isTerminalInterviewStatus('in_progress')).toBe(false);
      expect(isTerminalInterviewStatus('processing')).toBe(false);
    });
  });

});
