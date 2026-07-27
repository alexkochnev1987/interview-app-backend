import { toUserProfileForActor } from './user-profile';
import { UserRole } from './interfaces/user.interface';

describe('toUserProfileForActor', () => {
  const target = {
    id: 'target-id',
    name: 'Jane Doe',
    role: 'hr' as UserRole,
    email: 'jane@example.com',
  };

  it('includes email for self', () => {
    expect(
      toUserProfileForActor({ id: 'target-id', role: 'hr' }, target),
    ).toEqual({
      id: 'target-id',
      name: 'Jane Doe',
      role: 'hr',
      email: 'jane@example.com',
    });
  });

  it('includes email for super_admin viewers', () => {
    expect(
      toUserProfileForActor({ id: 'other-id', role: 'super_admin' }, target),
    ).toEqual({
      id: 'target-id',
      name: 'Jane Doe',
      role: 'hr',
      email: 'jane@example.com',
    });
  });

  it('includes email for admin viewers below super_admin', () => {
    expect(
      toUserProfileForActor({ id: 'other-id', role: 'admin' }, target),
    ).toEqual({
      id: 'target-id',
      name: 'Jane Doe',
      role: 'hr',
      email: 'jane@example.com',
    });
  });

  it('omits email for hr viewers of another hr profile', () => {
    expect(
      toUserProfileForActor({ id: 'other-id', role: 'hr' }, target),
    ).toEqual({
      id: 'target-id',
      name: 'Jane Doe',
      role: 'hr',
    });
  });
});
