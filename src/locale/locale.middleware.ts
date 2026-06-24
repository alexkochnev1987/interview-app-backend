import '../types/express-augment';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_HEADER,
} from './locale.constants';
import { invalidLocaleException } from './locale.exceptions';

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

    const value = (Array.isArray(raw) ? raw[0] : raw).trim();

    if (value === '') {
      req.locale = DEFAULT_LOCALE;
      next();
      return;
    }

    if (!isLocale(value)) {
      if (isLenientLocalePath(path)) {
        // Take resolves contentLocale in resolveTakeContentLocale; do not force req.locale to en.
        next();
        return;
      }
      next(invalidLocaleException());
      return;
    }

    req.locale = value;
    next();
  }
}
