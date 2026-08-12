import { extractQuestionFilters } from './recruiter-assistant-question-filters-extract';

describe('extractQuestionFilters', () => {
  it('returns empty filters for a bare count request', () => {
    expect(extractQuestionFilters('how many questions do we have')).toEqual({});
  });

  it('extracts difficulty', () => {
    expect(
      extractQuestionFilters('how many hard questions do we have'),
    ).toEqual({
      difficulty: 'hard',
    });
  });

  it('extracts role from known keywords', () => {
    expect(extractQuestionFilters('how many react questions')).toEqual({
      role: 'React Developer',
    });
  });

  it('extracts role from "for" phrasing', () => {
    expect(extractQuestionFilters('count questions for Java engineer')).toEqual(
      {
        role: 'Java engineer',
      },
    );
  });

  it('extracts tags', () => {
    expect(
      extractQuestionFilters('how many questions tagged hooks,state'),
    ).toEqual({
      tags: ['hooks', 'state'],
    });
  });

  it('extracts quoted search text', () => {
    expect(
      extractQuestionFilters('how many questions containing "async await"'),
    ).toEqual({
      q: 'async await',
    });
  });

  it('extracts status and eligible-for-interview flags', () => {
    expect(
      extractQuestionFilters(
        'how many inactive questions eligible for interview',
      ),
    ).toEqual({
      status: 'inactive',
      eligibleForInterview: true,
    });
  });

  it('ignores invalid difficulty values', () => {
    expect(extractQuestionFilters('how many expert questions')).toEqual({});
  });
});
