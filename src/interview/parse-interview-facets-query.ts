import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest } from '../common/errors/api-error';
import { QueryInterviewFacetsDto } from './dto/query-interview-facets.dto';

const FACETS_QUERY_KEYS = new Set(['q', 'position', 'status']);

function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): Array<{ property: string; constraints: Record<string, string> }> {
  return errors.flatMap((error) => {
    const property = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ property, constraints: error.constraints }]
      : [];
    const nested = error.children?.length
      ? flattenValidationErrors(error.children, property)
      : [];
    return [...own, ...nested];
  });
}

export function parseInterviewFacetsQuery(
  raw: Record<string, unknown>,
): QueryInterviewFacetsDto {
  const unknownKeys = Object.keys(raw).filter((key) => !FACETS_QUERY_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw apiBadRequest(ApiErrorCode.VALIDATION_ERROR, 'Validation failed', {
      errors: unknownKeys.map((property) => ({
        property,
        constraints: {
          whitelistValidation: 'property should not exist',
        },
      })),
    });
  }

  const query = plainToInstance(QueryInterviewFacetsDto, raw, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(query, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    throw apiBadRequest(ApiErrorCode.VALIDATION_ERROR, 'Validation failed', {
      errors: flattenValidationErrors(errors),
    });
  }

  return query;
}
