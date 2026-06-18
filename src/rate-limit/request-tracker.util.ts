export interface RequestTrackerHeaders {
  readonly 'x-forwarded-for'?: string | readonly string[];
}

export interface RequestTrackerUser {
  readonly id?: string;
}

export interface RequestTrackerCandidatePayload {
  readonly interviewId?: string;
}

export interface RequestTrackerSocket {
  readonly remoteAddress?: string;
}

export interface RequestTrackerRequest {
  readonly headers?: RequestTrackerHeaders;
  readonly ips?: readonly string[];
  readonly ip?: string;
  readonly socket?: RequestTrackerSocket;
  readonly user?: RequestTrackerUser;
  readonly candidatePayload?: RequestTrackerCandidatePayload;
}

export function getRequestClientIp(req: RequestTrackerRequest): string {
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
