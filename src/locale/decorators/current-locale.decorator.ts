import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, Locale } from '../locale.constants';

export const CurrentLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Locale => {
    const request = ctx.switchToHttp().getRequest<{ locale?: Locale }>();
    return request.locale ?? DEFAULT_LOCALE;
  },
);
