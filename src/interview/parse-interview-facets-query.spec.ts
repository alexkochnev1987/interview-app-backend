import { ApiErrorCode } from '../common/errors/api-error.codes';
import { parseInterviewFacetsQuery } from './parse-interview-facets-query';

describe('parseInterviewFacetsQuery', () => {
  it('accepts q, position, and status filters', () => {
    expect(
      parseInterviewFacetsQuery({
        q: 'alice',
        position: 'Engineer',
        status: 'pending',
      }),
    ).toEqual({
      q: 'alice',
      position: 'Engineer',
      status: 'pending',
    });
  });

  it('rejects pagination and sort params', () => {
    expect(() =>
      parseInterviewFacetsQuery({
        page: '1',
        sortBy: 'updatedAt',
      }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: ApiErrorCode.VALIDATION_ERROR,
          params: {
            errors: expect.arrayContaining([
              expect.objectContaining({ property: 'page' }),
              expect.objectContaining({ property: 'sortBy' }),
            ]),
          },
        }),
      }),
    );
  });
});
