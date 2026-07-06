import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest } from '../common/errors/api-error';

export function invalidContentLocaleException() {
  return apiBadRequest(
    ApiErrorCode.INVALID_LOCALE,
    'Invalid contentLocale query. Supported values: en, be, ru, pl',
  );
}
