import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database/database.service';
import type { AvatarService } from './avatar/avatar.service';
import type { UserRole } from './interfaces/user.interface';
import { UserService } from './user.service';

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin' as UserRole,
    organization_id: null,
    password_hash: 'hash',
    demo: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    onboarding_completed_at: null,
    onboarding_status: null,
    avatar_source: 'none',
    avatar_key: null,
    google_picture_url: null,
    ...overrides,
  };
}

function makeService() {
  const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const withTransaction = jest.fn(
    async (cb: (client: PoolClient) => Promise<unknown>) =>
      cb({ query } as unknown as PoolClient),
  );
  const databaseService = {
    query,
    withTransaction,
  } as unknown as DatabaseService;
  const avatarService = {
    deleteObjectQuietly: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvatarService;
  return {
    service: new UserService(databaseService, avatarService),
    query,
    avatarService,
  };
}

describe('UserService.updateUser', () => {
  it('allows self-edit', async () => {
    const { service, query } = makeService();
    query
      .mockResolvedValueOnce({ rows: [userRow()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [userRow({ name: 'New Name', email: 'new@example.com' })],
      });

    const result = await service.updateUser(
      { id: 'admin-1', role: 'admin' },
      'admin-1',
      { name: 'New Name', email: 'new@example.com' },
    );

    expect(result.name).toBe('New Name');
    expect(result.email).toBe('new@example.com');
  });

  it('forbids peer updates', async () => {
    const { service, query } = makeService();
    query.mockResolvedValueOnce({
      rows: [userRow({ id: 'admin-2', email: 'peer@example.com' })],
    });

    await expect(
      service.updateUser(
        { id: 'admin-1', role: 'admin' },
        'admin-2',
        { name: 'Nope' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate email', async () => {
    const { service, query } = makeService();
    query
      .mockResolvedValueOnce({ rows: [userRow()] })
      .mockResolvedValueOnce({ rows: [{ id: 'other-1' }] });

    await expect(
      service.updateUser(
        { id: 'admin-1', role: 'admin' },
        'admin-1',
        { email: 'taken@example.com' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('forbids updating a demo user', async () => {
    const { service, query } = makeService();
    query.mockResolvedValueOnce({
      rows: [
        userRow({
          id: 'demo-1',
          email: 'demo@example.com',
          role: 'hr',
          demo: true,
        }),
      ],
    });

    await expect(
      service.updateUser(
        { id: 'sa-1', role: 'super_admin' },
        'demo-1',
        { name: 'Nope' },
      ),
    ).rejects.toMatchObject({
      message: 'Cannot modify the demo account',
    });
  });

  it('keeps role when email changes to a SUPER_ADMIN_EMAILS address', async () => {
    const previous = process.env.SUPER_ADMIN_EMAILS;
    process.env.SUPER_ADMIN_EMAILS = 'privileged@interview-app.com';
    const { service, query } = makeService();
    query
      .mockResolvedValueOnce({
        rows: [userRow({ id: 'hr-1', email: 'hr@example.com', role: 'hr' })],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          userRow({
            id: 'hr-1',
            email: 'privileged@interview-app.com',
            role: 'hr',
          }),
        ],
      });

    try {
      const result = await service.updateUser(
        { id: 'admin-1', role: 'admin' },
        'hr-1',
        { email: 'privileged@interview-app.com' },
      );

      expect(result.role).toBe('hr');
      const updateCall = query.mock.calls.find(([sql]: [string]) =>
        sql.includes('UPDATE users'),
      );
      expect(updateCall?.[0]).not.toMatch(/role\s*=/);
    } finally {
      if (previous === undefined) {
        delete process.env.SUPER_ADMIN_EMAILS;
      } else {
        process.env.SUPER_ADMIN_EMAILS = previous;
      }
    }
  });
});

describe('UserService.deleteUser', () => {
  it('forbids self-delete', async () => {
    const { service } = makeService();

    await expect(
      service.deleteUser({ id: 'admin-1', role: 'admin' }, 'admin-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin to delete a lower-ranked user', async () => {
    const { service, query } = makeService();
    query
      .mockResolvedValueOnce({
        rows: [
          userRow({
            id: 'hr-1',
            email: 'hr@example.com',
            name: 'HR User',
            role: 'hr',
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await service.deleteUser({ id: 'admin-1', role: 'admin' }, 'hr-1');

    expect(
      query.mock.calls.some(([sql]: [string]) =>
        sql.includes('DELETE FROM users'),
      ),
    ).toBe(true);
  });

  it('forbids admin from deleting a demo user', async () => {
    const { service, query } = makeService();
    query.mockResolvedValueOnce({
      rows: [
        userRow({
          id: 'demo-1',
          email: 'demo@example.com',
          role: 'hr',
          demo: true,
        }),
      ],
    });

    await expect(
      service.deleteUser({ id: 'admin-1', role: 'admin' }, 'demo-1'),
    ).rejects.toMatchObject({
      message: 'Cannot delete the demo account',
    });
  });

  it('allows super_admin to delete a demo user', async () => {
    const { service, query } = makeService();
    query
      .mockResolvedValueOnce({
        rows: [
          userRow({
            id: 'demo-1',
            email: 'demo@example.com',
            role: 'hr',
            demo: true,
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await service.deleteUser({ id: 'sa-1', role: 'super_admin' }, 'demo-1');

    expect(
      query.mock.calls.some(([sql]: [string]) =>
        sql.includes('DELETE FROM users'),
      ),
    ).toBe(true);
  });

  it('quietly deletes avatar storage after removing the user row', async () => {
    const { service, query, avatarService } = makeService();
    query
      .mockResolvedValueOnce({
        rows: [
          userRow({
            id: 'hr-1',
            email: 'hr@example.com',
            role: 'hr',
            avatar_source: 'upload',
            avatar_key: 'uploads/avatars/hr-1.png',
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await service.deleteUser({ id: 'admin-1', role: 'admin' }, 'hr-1');

    expect(avatarService.deleteObjectQuietly).toHaveBeenCalledWith(
      'uploads/avatars/hr-1.png',
    );
  });
});
