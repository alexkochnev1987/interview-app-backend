import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest } from '../common/errors/api-error';

export function invalidLocaleException() {
  return apiBadRequest(
    ApiErrorCode.INVALID_LOCALE,
    'Invalid X-Locale header. Supported values: en, be, ru, pl',
  );
}
