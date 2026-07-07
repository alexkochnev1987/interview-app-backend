import { ServiceUnavailableException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

describe('AuthService demoLogin', () => {
  function buildService(userService: Partial<UserService>) {
    return Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'unit-test-jwt-secret' })],
      providers: [AuthService, { provide: UserService, useValue: userService }],
    }).compile();
  }

  it('returns the public demo user when one exists', async () => {
    const demoUser = {
      id: 'demo-1',
      email: 'demo@interview-app.com',
      name: 'Demo HR',
      role: 'hr' as const,
      demo: true,
      passwordHash: 'hash',
      createdAt: new Date(),
    };
    const publicUser = { ...demoUser } as Omit<typeof demoUser, 'passwordHash'>;
    const moduleRef = await buildService({
      findDemoUser: jest.fn().mockResolvedValue(demoUser),
      toPublicUser: jest.fn().mockReturnValue(publicUser),
    });
    const authService = moduleRef.get(AuthService);

    await expect(authService.demoLogin()).resolves.toEqual(publicUser);
  });

  it('throws when no demo user is seeded', async () => {
    const moduleRef = await buildService({
      findDemoUser: jest.fn().mockResolvedValue(undefined),
    });
    const authService = moduleRef.get(AuthService);

    await expect(authService.demoLogin()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
