export function getRequestClientIp(req: Record<string, any>): string {
  const forwardedFor = req.headers?.['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const firstValue = forwardedFor[0];
    if (typeof firstValue === 'string' && firstValue.trim()) {
      return firstValue.split(',')[0].trim();
    }
  }

  if (Array.isArray(req.ips) && req.ips.length > 0) {
    const [firstIp] = req.ips;
    if (typeof firstIp === 'string' && firstIp.trim()) {
      return firstIp.trim();
    }
  }

  if (typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim();
  }

  if (typeof req.socket?.remoteAddress === 'string') {
    return req.socket.remoteAddress;
  }

  return 'unknown';
}
