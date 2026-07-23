import { ApiErrorCode } from '../common/errors/api-error.codes';
import { parseInterviewFacetsQuery } from './parse-interview-facets-query';

describe('parseInterviewFacetsQuery', () => {
  it('accepts q, position, status, and assignedHrId filters', () => {
    expect(
      parseInterviewFacetsQuery({
        q: 'alice',
        position: 'Engineer',
        status: 'pending',
        assignedHrId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      q: 'alice',
      position: 'Engineer',
      status: 'pending',
      assignedHrId: '00000000-0000-4000-8000-000000000001',
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
