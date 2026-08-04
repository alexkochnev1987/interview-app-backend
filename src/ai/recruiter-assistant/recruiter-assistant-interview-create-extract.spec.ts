import { extractCreateInterviewFields } from './recruiter-assistant-interview-create-extract';

describe('recruiter-assistant-interview-create-extract', () => {
  it('extracts candidate and position from create interview phrasing', () => {
    expect(
      extractCreateInterviewFields(
        'create interview for Alice for a React developer role',
      ),
    ).toEqual({
      candidateName: 'Alice',
      position: 'React Developer',
    });
  });

  it('returns undefined position when none is mentioned', () => {
    expect(extractCreateInterviewFields('create a new interview')).toEqual({
      candidateName: undefined,
      position: undefined,
    });
  });
});
