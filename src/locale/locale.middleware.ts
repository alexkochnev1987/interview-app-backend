import '../types/express-augment';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  parseLocaleHeader,
} from './locale.constants';

const LENIENT_LOCALE_PATHS = new Set(['/health', '/openapi.json']);
const TAKE_PATH_PREFIX = '/take';

function isLenientLocalePath(path: string): boolean {
  return LENIENT_LOCALE_PATHS.has(path) || path.startsWith(TAKE_PATH_PREFIX);
}

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const path = req.path ?? '';
    const raw = req.headers[LOCALE_HEADER];

    if (raw === undefined) {
      req.locale = DEFAULT_LOCALE;
      next();
      return;
    }

    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = parseLocaleHeader(value);

    if (parsed) {
      req.locale = parsed;
      next();
      return;
    }

    if (isLenientLocalePath(path)) {
      // Take resolves contentLocale in resolveTakeContentLocale; do not force req.locale to en.
      next();
      return;
    }

    req.locale = DEFAULT_LOCALE;
    next();
  }
}
