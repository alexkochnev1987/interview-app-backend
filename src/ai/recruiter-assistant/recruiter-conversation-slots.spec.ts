import {
  captureAwaitingSlot,
  idleConversationState,
  startConversationFlow,
} from './recruiter-conversation-slots';

describe('recruiter-conversation-slots', () => {
  it('starts a flow with awaiting input', () => {
    expect(startConversationFlow('assign_hr', 'interview')).toEqual({
      flow: 'assign_hr',
      slots: {},
      awaitingInput: 'interview',
    });
  });

  it('captures a slot reply', () => {
    const next = captureAwaitingSlot(
      startConversationFlow('assign_hr', 'hr', { interviewRef: 'Alice' }),
      'Jane Doe',
    );

    expect(next).toEqual({
      flow: 'assign_hr',
      slots: { interviewRef: 'Alice', hrName: 'Jane Doe' },
      awaitingInput: undefined,
    });
  });

  it('returns idle state when finishing a flow', () => {
    expect(idleConversationState()).toEqual({ flow: 'idle', slots: {} });
  });
});
