import { RecruiterConversationStore } from './recruiter-conversation.store';

describe('RecruiterConversationStore', () => {
  const store = new RecruiterConversationStore();

  it('issues a session with idle default state', () => {
    const id = store.issue('user-1');

    expect(store.get('user-1', id)).toEqual({ flow: 'idle', slots: {} });
  });

  it('rejects get by a different user', () => {
    const id = store.issue('user-1');

    expect(store.get('user-2', id)).toBeNull();
  });

  it('updates and returns persisted state', () => {
    const id = store.issue('user-1');
    const next = { flow: 'assign_hr' as const, slots: { hrName: 'Jane' } };

    expect(store.update('user-1', id, next)).toBe(true);
    expect(store.get('user-1', id)).toEqual(next);
  });

  it('clears a session', () => {
    const id = store.issue('user-1');

    expect(store.clear('user-1', id)).toBe(true);
    expect(store.get('user-1', id)).toBeNull();
  });

  it('clears all sessions for a user', () => {
    const first = store.issue('user-1');
    const second = store.issue('user-1');
    const otherUserSession = store.issue('user-2');

    store.clearAllForUser('user-1');

    expect(store.get('user-1', first)).toBeNull();
    expect(store.get('user-1', second)).toBeNull();
    expect(store.get('user-2', otherUserSession)).toEqual({
      flow: 'idle',
      slots: {},
    });
  });
});
