import {
  getInterviewPendingOnlyBlockReason,
  getInterviewPendingOnlyBlockReasonForFields,
  getInterviewTerminalOnlyBlockReason,
  getInterviewDemoDeleteBlockReason,
  hasInterviewPendingOnlyFieldUpdates,
  INTERVIEW_PENDING_ONLY_MESSAGE,
  INTERVIEW_TERMINAL_ONLY_MESSAGE,
  INTERVIEW_DEMO_DELETE_BLOCKED_MESSAGE,
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

  describe('hasInterviewPendingOnlyFieldUpdates', () => {
    it('detects pending-only field updates', () => {
      expect(
        hasInterviewPendingOnlyFieldUpdates({ candidateName: 'Ada' }),
      ).toBe(true);
      expect(
        hasInterviewPendingOnlyFieldUpdates({
          candidateName: undefined,
        }),
      ).toBe(false);
    });

    it('returns false when no fields are present', () => {
      expect(hasInterviewPendingOnlyFieldUpdates({})).toBe(false);
    });
  });

  describe('getInterviewPendingOnlyBlockReasonForFields', () => {
    it('allows HR-only updates on non-pending interviews', () => {
      for (const status of [
        'in_progress',
        'processing',
        'completed',
        'failed',
      ] as const) {
        expect(
          getInterviewPendingOnlyBlockReasonForFields(status, false),
        ).toBeNull();
      }
    });

    it('still blocks non-HR field updates on non-pending interviews', () => {
      for (const status of [
        'in_progress',
        'processing',
        'completed',
        'failed',
      ] as const) {
        expect(getInterviewPendingOnlyBlockReasonForFields(status, true)).toBe(
          INTERVIEW_PENDING_ONLY_MESSAGE,
        );
      }
    });

    it('allows non-HR field updates on pending interviews', () => {
      expect(
        getInterviewPendingOnlyBlockReasonForFields('pending', true),
      ).toBeNull();
    });
  });

  describe('getInterviewTerminalOnlyBlockReason', () => {
    it('allows terminal interviews', () => {
      expect(getInterviewTerminalOnlyBlockReason('completed')).toBeNull();
      expect(getInterviewTerminalOnlyBlockReason('failed')).toBeNull();
    });

    it('blocks active interviews', () => {
      for (const status of ['pending', 'in_progress', 'processing'] as const) {
        expect(getInterviewTerminalOnlyBlockReason(status)).toBe(
          INTERVIEW_TERMINAL_ONLY_MESSAGE,
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

  describe('getInterviewDemoDeleteBlockReason', () => {
    it('allows non-demo interviews', () => {
      expect(getInterviewDemoDeleteBlockReason({ demo: false })).toBeNull();
    });

    it('blocks demo interviews', () => {
      expect(getInterviewDemoDeleteBlockReason({ demo: true })).toBe(
        INTERVIEW_DEMO_DELETE_BLOCKED_MESSAGE,
      );
    });
  });
});
