import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../user/interfaces/user.interface';

export function mockExecutionContext(options: {
  user?: { role: UserRole };
  cookies?: Record<string, string>;
  query?: Record<string, string>;
} = {}): ExecutionContext {
  const handler = function handler() {};
  const Controller = class MockController {};
  const request = {
    user: options.user,
    cookies: options.cookies,
    query: options.query,
  };

  return {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
