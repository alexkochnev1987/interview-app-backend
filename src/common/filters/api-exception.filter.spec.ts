import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { ApiErrorCode } from '../errors/api-error.codes';
import { apiNotFound } from '../errors/api-error';
import { ApiExceptionFilter } from './api-exception.filter';

function createHost(): ArgumentsHost {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status };
  const request = { url: '/questions/1?token=secret' };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  it('drops unknown error codes from third-party exceptions', () => {
    const host = createHost();
    const exception = new NotFoundException({
      code: 'SOME_THIRD_PARTY_CODE',
      message: 'missing',
      params: { id: '1', secret: 'nope' },
    });

    filter.catch(exception, host);
    const response = host.switchToHttp().getResponse() as {
      status: jest.Mock;
    };
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ApiErrorCode.NOT_FOUND,
        params: { id: '1' },
      }),
    );
  });

  it('keeps registry codes from api helpers', () => {
    const host = createHost();
    filter.catch(
      apiNotFound(ApiErrorCode.QUESTION_NOT_FOUND, 'missing', { id: 'q1' }),
      host,
    );
    const response = host.switchToHttp().getResponse() as {
      status: jest.Mock;
    };
    expect(response.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ApiErrorCode.QUESTION_NOT_FOUND,
        params: { id: 'q1' },
      }),
    );
  });

  it('maps validation pipe errors to VALIDATION_ERROR', () => {
    const host = createHost();
    filter.catch(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );
    const response = host.switchToHttp().getResponse() as {
      status: jest.Mock;
    };
    expect(response.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ApiErrorCode.VALIDATION_ERROR,
        params: { errors: ['email must be an email'] },
      }),
    );
  });
});
