import { extractQuestionName } from './recruiter-assistant-question-name-extract';

describe('recruiter-assistant-question-name-extract', () => {
  it('extracts quoted names', () => {
    expect(extractQuestionName('create question "React hooks"')).toBe('React hooks');
  });

  it('extracts names from create-question phrasing', () => {
    expect(extractQuestionName('create a question about React hooks')).toBe(
      'React hooks',
    );
  });

  it('returns undefined when no name is present', () => {
    expect(extractQuestionName('create a question')).toBeUndefined();
  });
});
