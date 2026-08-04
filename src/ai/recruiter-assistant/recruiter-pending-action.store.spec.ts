import { RecruiterPendingActionStore } from './recruiter-pending-action.store';

describe('RecruiterPendingActionStore', () => {
  const store = new RecruiterPendingActionStore();
  const action = {
    type: 'assign_hr' as const,
    interviewId: '11111111-1111-4111-8111-111111111111',
    assignedHrId: '22222222-2222-4222-8222-222222222222',
    assignedHrName: 'Jane Doe',
    interviewLabel: 'Alice Smith (React Developer)',
  };

  it('issues and one-shot consumes a pending action for the same user', () => {
    const id = store.issue('user-1', action);

    expect(store.consume('user-1', id)).toEqual(action);
    expect(store.consume('user-1', id)).toBeNull();
  });

  it('rejects consumption by a different user', () => {
    const id = store.issue('user-1', action);

    expect(store.consume('user-2', id)).toBeNull();
  });

  it('revokes a pending action without executing it', () => {
    const id = store.issue('user-1', action);

    expect(store.revoke('user-1', id)).toBe(true);
    expect(store.consume('user-1', id)).toBeNull();
  });

  it('revokes all pending actions for a user', () => {
    const first = store.issue('user-1', action);
    const second = store.issue('user-1', action);
    store.issue('user-2', action);

    store.revokeAllForUser('user-1');

    expect(store.consume('user-1', first)).toBeNull();
    expect(store.consume('user-1', second)).toBeNull();
  });
});
