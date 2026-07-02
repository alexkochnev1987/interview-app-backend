import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiErrorCode } from './api-error.codes';

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  params?: Record<string, unknown>;
}

function createException<T extends HttpException>(
  ExceptionType: new (response: ApiErrorPayload) => T,
  payload: ApiErrorPayload,
): T {
  return new ExceptionType(payload);
}

export function apiBadRequest(
  code: ApiErrorCode,
  message: string,
  params?: Record<string, unknown>,
): BadRequestException {
  return createException(BadRequestException, { code, message, params });
}

export function apiUnauthorized(
  code: ApiErrorCode,
  message: string,
  params?: Record<string, unknown>,
): UnauthorizedException {
  return createException(UnauthorizedException, { code, message, params });
}

export function apiForbidden(
  code: ApiErrorCode,
  message: string,
  params?: Record<string, unknown>,
): ForbiddenException {
  return createException(ForbiddenException, { code, message, params });
}

export function apiNotFound(
  code: ApiErrorCode,
  message: string,
  params?: Record<string, unknown>,
): NotFoundException {
  return createException(NotFoundException, { code, message, params });
}

export function apiConflict(
  code: ApiErrorCode,
  message: string,
  params?: Record<string, unknown>,
): ConflictException {
  return createException(ConflictException, { code, message, params });
}

export function apiServiceUnavailable(
  code: ApiErrorCode,
  message: string,
  params?: Record<string, unknown>,
): ServiceUnavailableException {
  return createException(ServiceUnavailableException, { code, message, params });
}
