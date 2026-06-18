import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { mockExecutionContext } from '../../test/mock-execution-context';

describe('PermissionsGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('allows when the role has every required permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['questions:read']);
    const context = mockExecutionContext({ user: { role: 'hr' } });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids when the role lacks a required permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['questions:create']);
    const context = mockExecutionContext({ user: { role: 'hr' } });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('requires authentication when permissions are declared', () => {
    reflector.getAllAndOverride.mockReturnValue(['questions:read']);
    const context = mockExecutionContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('passes through when no permissions metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = mockExecutionContext();
    expect(guard.canActivate(context)).toBe(true);
  });
});
