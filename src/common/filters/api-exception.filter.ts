import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorCode, isApiErrorCode } from '../errors/api-error.codes';
import { API_ERROR_CODE_BY_CODE } from '../errors/api-error.registry';

interface NormalizedApiError {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  params?: Record<string, unknown>;
}

const DEFAULT_CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ApiErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ApiErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ApiErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ApiErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ApiErrorCode.CONFLICT,
  [HttpStatus.SERVICE_UNAVAILABLE]: ApiErrorCode.SERVICE_UNAVAILABLE,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ApiErrorCode.INTERNAL_SERVER_ERROR,
};

const ALLOWED_ERROR_PARAM_KEYS = new Set([
  'cause',
  'candidateName',
  'errors',
  'existingId',
  'externalId',
  'field',
  'id',
  'interviewId',
  'mode',
  'primaryLocale',
  'questionId',
  'questionIndex',
  'sourceLocale',
  'status',
  'targetLocale',
]);

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = this.normalize(exception);

    response.status(normalized.statusCode).json({
      statusCode: normalized.statusCode,
      code: normalized.code,
      message: normalized.message,
      ...(normalized.params !== undefined ? { params: normalized.params } : {}),
      path: this.sanitizePath(request.url),
    });
  }

  private sanitizePath(url: string): string {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) {
      return url;
    }
    const pathname = url.slice(0, queryIndex);
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    if (params.has('token')) {
      params.set('token', '[redacted]');
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  private normalize(exception: unknown): NormalizedApiError {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      };
    }

    const statusCode = exception.getStatus();
    const raw = exception.getResponse();

    if (typeof raw === 'string') {
      return {
        statusCode,
        code: this.defaultCode(statusCode),
        message: raw,
      };
    }

    if (typeof raw !== 'object' || raw === null) {
      return {
        statusCode,
        code: this.defaultCode(statusCode),
        message: 'Request failed',
      };
    }

    const body = raw as Record<string, unknown>;
    const validation = this.normalizeValidationError(statusCode, body);
    if (validation) {
      return validation;
    }

    const code = this.resolveCode(body.code, statusCode);
    const message = this.resolveMessage(body, statusCode, code);

    const params = this.sanitizeParams(body.params);

    return { statusCode, code, message, params };
  }

  private normalizeValidationError(
    statusCode: number,
    body: Record<string, unknown>,
  ): NormalizedApiError | null {
    if (statusCode !== HttpStatus.BAD_REQUEST) {
      return null;
    }

    if (!Array.isArray(body.message)) {
      return null;
    }

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      params: { errors: body.message },
    };
  }

  private resolveCode(code: unknown, statusCode: number): ApiErrorCode {
    if (typeof code === 'string' && isApiErrorCode(code)) {
      return code;
    }
    return this.defaultCode(statusCode);
  }

  private resolveMessage(
    body: Record<string, unknown>,
    statusCode: number,
    code: ApiErrorCode,
  ): string {
    const explicit = this.extractMessage(body.message ?? body.error);
    if (explicit !== 'Request failed') {
      return explicit;
    }

    return API_ERROR_CODE_BY_CODE[code].defaultMessage;
  }

  private defaultCode(statusCode: number): ApiErrorCode {
    return DEFAULT_CODE_BY_STATUS[statusCode] ?? ApiErrorCode.BAD_REQUEST;
  }

  private sanitizeParams(
    value: unknown,
  ): Record<string, unknown> | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, paramValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!ALLOWED_ERROR_PARAM_KEYS.has(key)) {
        continue;
      }
      if (this.isSafeParamValue(paramValue)) {
        sanitized[key] = paramValue;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private isSafeParamValue(value: unknown): boolean {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every(
        (item) =>
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean',
      );
    }
    return false;
  }

  private extractMessage(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join('; ');
    }
    return 'Request failed';
  }
}
