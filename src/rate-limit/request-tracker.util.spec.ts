import { getRequestClientIp } from './request-tracker.util';

describe('request-tracker.util', () => {
  it('resolves client IP from proxy headers and fallbacks', () => {
    expect(
      getRequestClientIp({
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
      }),
    ).toBe('203.0.113.1');
    expect(getRequestClientIp({ ip: '192.0.2.7' })).toBe('192.0.2.7');
    expect(
      getRequestClientIp({ socket: { remoteAddress: '127.0.0.1' } }),
    ).toBe('127.0.0.1');
    expect(getRequestClientIp({})).toBe('unknown');
  });
});
