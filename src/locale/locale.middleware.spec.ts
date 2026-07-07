import { NextFunction, Request, Response } from 'express';
import { parseLocaleHeader } from './locale.constants';
import { LocaleMiddleware } from './locale.middleware';

describe('LocaleMiddleware', () => {
  let middleware: LocaleMiddleware;
  let req: Request;
  let next: jest.Mock<void, [unknown?]>;

  beforeEach(() => {
    middleware = new LocaleMiddleware();
    req = { headers: {} } as Request;
    next = jest.fn();
  });

  it('sets en when header is missing', () => {
    middleware.use(req, {} as Response, next as NextFunction);
    expect(req.locale).toBe('en');
    expect(next).toHaveBeenCalledWith();
  });

  it('sets en when header is empty', () => {
    req.headers['x-locale'] = '  ';
    middleware.use(req, {} as Response, next as NextFunction);
    expect(req.locale).toBe('en');
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts valid locale ru', () => {
    req.headers['x-locale'] = 'ru';
    middleware.use(req, {} as Response, next as NextFunction);
    expect(req.locale).toBe('ru');
    expect(next).toHaveBeenCalledWith();
  });

  it('normalizes uppercase and regional tags', () => {
    req.headers['x-locale'] = 'EN-US';
    middleware.use(req, {} as Response, next as NextFunction);
    expect(req.locale).toBe('en');
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to en for unrecognized locale on API routes', () => {
    req.headers['x-locale'] = 'xx';
    (req as Request & { path: string }).path = '/questions';
    middleware.use(req, {} as Response, next as NextFunction);
    expect(req.locale).toBe('en');
    expect(next).toHaveBeenCalledWith();
  });

  it('ignores invalid locale on /health', () => {
    req = { headers: { 'x-locale': 'xx' }, path: '/health' } as unknown as Request;
    middleware.use(req, {} as Response, next as NextFunction);
    expect(req.locale).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('does not reject invalid locale on take routes', () => {
    req = {
      headers: { 'x-locale': 'de' },
      path: '/take/550e8400-e29b-41d4-a716-446655440000',
    } as unknown as Request;
    middleware.use(req, {} as Response, next as NextFunction);
    expect(req.locale).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });
});

describe('parseLocaleHeader', () => {
  it('normalizes regional tags and rejects unknown locales', () => {
    expect(parseLocaleHeader('pl-PL')).toBe('pl');
    expect(parseLocaleHeader('invalid')).toBeNull();
  });
});
