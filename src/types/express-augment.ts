import { Locale } from '../locale/locale.constants';

declare module 'express-serve-static-core' {
  interface Request {
    locale: Locale;
  }
}
